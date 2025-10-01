import { useEffect, useState, useCallback } from 'react';
import { db, getCurrentUser, User } from '../../config/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { Printer, CheckCircle, CreditCard, IndianRupee, Filter, SortAsc, SortDesc, Search, Calendar, DollarSign, TrendingUp, TrendingDown, RefreshCw, Download, Eye, MoreHorizontal, Clock, Info } from 'lucide-react';
import { addDoc, serverTimestamp, collection as fsCollection, getDocs as fsGetDocs, query as fsQuery, where as fsWhere } from 'firebase/firestore';
import { Dialog } from '@headlessui/react';
import { notificationService } from '../../utils/notificationService';
import { useRouter } from 'next/navigation';
import { VoucherStatus } from '../../types/voucher';
import { getStatusBackgroundColor } from '../../utils/voucherStatusManager';
import { PaymentPrintPreviewModal } from './PaymentPrintPreviewModal';
import VoucherDetails from '../shared/VoucherDetails';
import { Voucher } from '../../types/voucher';

interface Vendor {
  id: string;
  userCode: string;
  firstName: string;
  surname: string;
  companyName: string;
  vendorJobWork?: string;
}

interface PaymentRow {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  voucherId: string;
  voucherNo: string;
  voucherDate: string;
  itemName: string;
  jobWorkDone: string;
  pricePerPiece: number;
  netQty: number;
  totalAmount: number;
  amountPaid: number;
  pendingAmount: number;
  status: 'Paid' | 'Partially Paid' | 'Unpaid';
  voucherStatus: VoucherStatus;
}

type SortField = 'voucherNo' | 'vendorName' | 'voucherDate' | 'totalAmount' | 'pendingAmount' | 'status' | 'voucherStatus';
type SortDirection = 'asc' | 'desc';

export default function AdminPaymentComponent() {
  const router = useRouter();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupByVoucher, setGroupByVoucher] = useState(false);
  const [payModal, setPayModal] = useState<{ open: boolean, row: PaymentRow | null }>({ open: false, row: null });
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);

  // Print preview modal states
  const [printPreviewModal, setPrintPreviewModal] = useState<{ open: boolean, reportType: 'single' | 'all', singleRow?: PaymentRow }>({ open: false, reportType: 'all' });

  // Enhanced filter and sort states
  const [statusFilter, setStatusFilter] = useState<'all' | 'Paid' | 'Partially Paid' | 'Unpaid'>('all');
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<'all' | VoucherStatus>('all');
  const [vendorFilter, setVendorFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [amountRangeFilter, setAmountRangeFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortField, setSortField] = useState<SortField>('voucherDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Inline voucher details modal state
  const [voucherModal, setVoucherModal] = useState<{ open: boolean; voucher: Voucher | null }>({ open: false, voucher: null });
  const [voucherDetailsRefreshKey, setVoucherDetailsRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Fetch vendors
    const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'vendor')));
    const vendors: Record<string, Vendor> = {};
    usersSnapshot.forEach(docSnap => {
      const d = docSnap.data();
      vendors[docSnap.id] = {
        id: docSnap.id,
        userCode: d.userCode || '',
        firstName: d.firstName || '',
        surname: d.surname || '',
        companyName: d.companyName || '',
        vendorJobWork: d.vendorJobWork || '',
      };
    });
    // Fetch vouchers
    const vouchersSnapshot = await getDocs(query(collection(db, 'vouchers')));
    // Fetch payments
    const paymentsSnapshot = await fsGetDocs(fsQuery(fsCollection(db, 'payments')));
    const payments: Record<string, number> = {};
    paymentsSnapshot.forEach(docSnap => {
      const d = docSnap.data();
      // Key: voucherId_vendorId_jobWork
      const key = `${d.voucherId}_${d.vendorId}_${d.jobWorkDone}`;
      payments[key] = (payments[key] || 0) + (d.amountPaid || 0);
    });
    const paymentRows: PaymentRow[] = [];
    vouchersSnapshot.forEach(voucherDoc => {
      const voucher = voucherDoc.data();
      const voucherId = voucherDoc.id;
      const voucherNo = voucher.voucherNo || voucher.voucher_no || `V-${voucherId.substring(0, 6)}`;
      const voucherStatus = voucher.voucher_status || 'Dispatched'; // Default to Dispatched if not set

      if (Array.isArray(voucher.events)) {
        voucher.events.forEach((event: any, idx: number) => {
          if (
            event.event_type === 'forward' &&
            event.details &&
            typeof event.details.price_per_piece === 'number' &&
            typeof event.details.quantity_forwarded === 'number' &&
            vendors[event.details.sender_id]  // Changed from receiver_id to sender_id
          ) {
            const vendor = vendors[event.details.sender_id];  // Changed from receiver_id to sender_id
            const pricePerPiece = event.details.price_per_piece;
            const netQty = event.details.quantity_forwarded;
            const totalAmount = pricePerPiece * netQty;
            const jobWorkDone = event.details.jobWork || vendor.vendorJobWork || 'N/A';
            const key = `${voucherId}_${event.details.sender_id}_${jobWorkDone}`;  // Changed from receiver_id to sender_id
            const amountPaid = payments[key] || 0;
            const pendingAmount = totalAmount - amountPaid;
            let status: PaymentRow['status'] = 'Unpaid';
            // Consider zero-total rows as Paid and allow marking paid via action
            if (totalAmount === 0) {
              status = 'Paid';
            } else if (pendingAmount <= 0) {
              status = 'Paid';
            } else if (amountPaid === 0) {
              status = 'Unpaid';
            } else {
              status = 'Partially Paid';
            }
            paymentRows.push({
              id: `${voucherId}_${event.details.sender_id}_${idx}`,  // Changed from receiver_id to sender_id
              vendorId: event.details.sender_id,  // Changed from receiver_id to sender_id
              vendorName: vendor.companyName || `${vendor.firstName} ${vendor.surname}`,
              vendorCode: vendor.userCode,
              voucherId,
              voucherNo,
              voucherDate: event.timestamp || voucher.createdAt?.toDate?.()?.toISOString()?.split('T')[0] || voucher.created_at || '',
              itemName: voucher.item || voucher.item_details?.item_name || '',
              jobWorkDone,
              pricePerPiece,
              netQty,
              totalAmount,
              amountPaid,
              pendingAmount,
              status,
              voucherStatus,
            });
          }
        });
      }
    });
    setRows(paymentRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, saving]);

  useEffect(() => {
    // Fetch current admin user on mount
    getCurrentUser().then(user => {
      setAdminUser(user);
    });
  }, []);

  // Summary calculations
  const totalToBePaid = rows.filter(r => r.status !== 'Paid').reduce((sum, r) => sum + r.pendingAmount, 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.amountPaid, 0);
  const totalAmount = rows.reduce((sum, r) => sum + r.totalAmount, 0);
  const unpaidCount = rows.filter(r => r.status === 'Unpaid').length;
  const partiallyPaidCount = rows.filter(r => r.status === 'Partially Paid').length;
  const paidCount = rows.filter(r => r.status === 'Paid').length;

  // Enhanced filtering and sorting
  const getFilteredAndSortedRows = (): PaymentRow[] => {
    let filtered = rows.filter(r => {
      // Search filter
      const searchMatch = r.vendorName.toLowerCase().includes(search.toLowerCase()) ||
        r.voucherNo.toLowerCase().includes(search.toLowerCase()) ||
        r.vendorCode.toLowerCase().includes(search.toLowerCase()) ||
        r.jobWorkDone.toLowerCase().includes(search.toLowerCase());

      // Status filter
      const statusMatch = statusFilter === 'all' || r.status === statusFilter;

      // Voucher status filter
      const voucherStatusMatch = voucherStatusFilter === 'all' || r.voucherStatus === voucherStatusFilter;

      // Vendor filter
      const vendorMatch = !vendorFilter || r.vendorName.toLowerCase().includes(vendorFilter.toLowerCase());

      // Date range filter
      const dateMatch = !dateRangeFilter.start || !dateRangeFilter.end ||
        (r.voucherDate >= dateRangeFilter.start && r.voucherDate <= dateRangeFilter.end);

      // Amount range filter
      const amountMatch = !amountRangeFilter.min || !amountRangeFilter.max ||
        (r.totalAmount >= Number(amountRangeFilter.min) && r.totalAmount <= Number(amountRangeFilter.max));

      return searchMatch && statusMatch && voucherStatusMatch && vendorMatch && dateMatch && amountMatch;
    });

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date sorting
      if (sortField === 'voucherDate') {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      }

      // Handle string sorting
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Group by voucher if enabled
    if (groupByVoucher) {
      return filtered.sort((a, b) => {
        if (a.voucherNo < b.voucherNo) return -1;
        if (a.voucherNo > b.voucherNo) return 1;
        return 0;
      });
    }

    return filtered;
  };

  const displayRows = getFilteredAndSortedRows();

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setVoucherStatusFilter('all');
    setVendorFilter('');
    setDateRangeFilter({ start: '', end: '' });
    setAmountRangeFilter({ min: '', max: '' });
  };

  // Print preview handlers
  const handlePrintRow = (row: PaymentRow) => {
    setPrintPreviewModal({ open: true, reportType: 'single', singleRow: row });
  };

  const handlePrintAll = () => {
    setPrintPreviewModal({ open: true, reportType: 'all' });
  };

  const handleRowClick = async (row: PaymentRow, event: React.MouseEvent) => {
    // Prevent navigation if clicking on action buttons
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('.action-buttons')) {
      return;
    }

    // Open inline voucher details modal on the same page
    try {
      const voucherRef = doc(db, 'vouchers', row.voucherId);
      const voucherSnap = await getDoc(voucherRef);
      if (voucherSnap.exists()) {
        const data = voucherSnap.data() as any;
        const voucher: Voucher = {
          id: voucherSnap.id,
          ...data,
        } as Voucher;
        setVoucherModal({ open: true, voucher });
      }
    } catch (err) {
      console.error('Failed to open voucher details:', err);
    }
  };

  return (
    <div className="p-0 lg:p-4 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Accounts & Payments</h1>
              <p className="text-gray-600 text-sm">Manage vendor payments and financial transactions</p>
            </div>
            <div className="flex items-center space-x-3 mt-3 lg:mt-0">
              <button
                onClick={fetchData}
                disabled={loading}
                className={`flex items-center px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm disabled:opacity-60`}
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
              >
                <Filter className="h-4 w-4 mr-2" />
                Advanced Filters
              </button>
              <button
                onClick={handlePrintAll}
                className="flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Print All
              </button>
            </div>
          </div>

          {/* Search Box - Always Visible */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by vendor name, voucher number, vendor code, or job work..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-200 rounded-lg p-3 text-gray-800 border-2 border-blue-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-xs font-medium">Total Pending</p>
                  <p className="text-xl font-bold">₹{totalToBePaid.toLocaleString('en-IN')}</p>
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-lg flex items-center justify-center border border-blue-300">
                  <TrendingDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="bg-gray-200 rounded-lg p-3 text-gray-800 border-2 border-blue-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-xs font-medium">Total Paid</p>
                  <p className="text-xl font-bold">₹{totalPaid.toLocaleString('en-IN')}</p>
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-lg flex items-center justify-center border border-blue-300">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="bg-gray-200 rounded-lg p-3 text-gray-800 border-2 border-blue-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-xs font-medium">Total Amount</p>
                  <p className="text-xl font-bold">₹{totalAmount.toLocaleString('en-IN')}</p>
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-lg flex items-center justify-center border border-blue-300">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="bg-gray-200 rounded-lg p-3 text-gray-800 border-2 border-blue-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-xs font-medium">Pending Items</p>
                  <p className="text-xl font-bold">{unpaidCount + partiallyPaidCount}</p>
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-lg flex items-center justify-center border border-blue-300">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Payment Status</option>
                  <option value="Unpaid">Unpaid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Status</label>
                <select
                  value={voucherStatusFilter}
                  onChange={e => setVoucherStatusFilter(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Voucher Status</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Received">Received</option>
                  <option value="Forwarded">Forwarded</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <input
                  type="text"
                  placeholder="Filter by vendor"
                  value={vendorFilter}
                  onChange={e => setVendorFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Range</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={amountRangeFilter.min}
                    onChange={e => setAmountRangeFilter(prev => ({ ...prev, min: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={amountRangeFilter.max}
                    onChange={e => setAmountRangeFilter(prev => ({ ...prev, max: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-4">
                <label className="flex items-center text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupByVoucher}
                    onChange={e => setGroupByVoucher(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">Group by Voucher</span>
                </label>
              </div>
              <button
                onClick={clearFilters}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Table Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { field: 'voucherNo', label: 'Voucher No' },
                    { field: 'vendorName', label: 'Vendor' },
                    { field: 'vendorCode', label: 'Vendor Code' },
                    { field: 'voucherDate', label: 'Voucher Date' },
                    { field: 'jobWorkDone', label: 'Job Work' },
                    { field: 'totalAmount', label: 'Total Amount' },
                    { field: 'pendingAmount', label: 'Pending Amount' },
                    { field: 'voucherStatus', label: 'Voucher Status' },
                    { field: 'status', label: 'Payment Status' },
                    { field: 'actions', label: 'Actions' }
                  ].map(({ field, label }) => (
                    <th key={field} className="px-4 py-3 text-left">
                      <button
                        onClick={() => field !== 'actions' && handleSort(field as SortField)}
                        className={`flex items-center text-xs font-semibold text-gray-700 uppercase tracking-wider ${field !== 'actions' ? 'hover:text-blue-600 cursor-pointer' : ''
                          }`}
                      >
                        {label}
                        {field !== 'actions' && sortField === field && (
                          sortDirection === 'asc' ?
                            <SortAsc className="h-3 w-3 ml-1" /> :
                            <SortDesc className="h-3 w-3 ml-1" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="h-6 w-6 text-blue-500 animate-spin mr-2" />
                        <span className="text-gray-600">Loading payment records...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8">
                      <div className="text-center">
                        <CreditCard className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">No payment records found.</p>
                        <p className="text-gray-500 text-sm mt-1">Try adjusting your filters or search terms.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayRows.map(row => {
                    const statusColors = {
                      'Paid': 'bg-green-100 text-green-800 border-green-200',
                      'Partially Paid': 'bg-yellow-100 text-yellow-800 border-yellow-200',
                      'Unpaid': 'bg-red-100 text-red-800 border-red-200'
                    };

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                        onClick={(event) => handleRowClick(row, event)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            {row.voucherNo}
                            <div title="Click to view voucher details">
                              <Eye className="h-3 w-3 text-blue-500 opacity-60" />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{row.vendorName}</div>
                          <div className="text-sm text-gray-500">{row.vendorCode}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {row.vendorCode}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {row.voucherDate ? new Date(row.voucherDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          }) : ''}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{row.jobWorkDone}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">₹{row.totalAmount.toLocaleString('en-IN')}</div>
                          <div className="text-sm text-gray-500">₹{row.pricePerPiece} × {row.netQty}</div>
                          <div className="text-sm text-green-600">Paid: ₹{row.amountPaid.toLocaleString('en-IN')}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className={`text-sm font-medium ${row.pendingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ₹{row.pendingAmount.toLocaleString('en-IN')}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusBackgroundColor(row.voucherStatus)}`}>
                            {row.voucherStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${statusColors[row.status]}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center space-x-1 action-buttons">
                            {row.pendingAmount > 0 ? (
                              <button
                                onClick={() => {
                                  setPayModal({ open: true, row });
                                  setPayAmount(row.pendingAmount.toString());
                                  setPayDate(new Date().toISOString().slice(0, 10));
                                }}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors"
                                title="Pay"
                              >
                                Pay
                              </button>
                            ) : (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium border border-green-200">
                                Paid
                              </span>
                            )}
                            <button
                              onClick={() => handlePrintRow(row)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Print"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mt-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between text-gray-600 text-xs lg:text-sm">
            <div className="flex items-center space-x-1 lg:space-x-4">
              <span>Showing {displayRows.length} of {rows.length} records</span>
              <span>•</span>
              <span>Unpaid: {unpaidCount}</span>
              <span>•</span>
              <span>Partially Paid: {partiallyPaidCount}</span>
              <span>•</span>
              <span>Paid: {paidCount}</span>
            </div>
            <div className="mt-1 md:mt-0">
              <span className="text-xs">Sorted by {sortField} ({sortDirection})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={payModal.open} onClose={() => setPayModal({ open: false, row: null })} className="fixed z-50 inset-0 overflow-y-auto">
        {payModal.open && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
            <Dialog.Panel className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-auto z-10 border border-gray-200">
              <Dialog.Title className="text-xl font-bold mb-4 text-gray-900">Pay Vendor</Dialog.Title>
              <form onSubmit={async e => {
                e.preventDefault();
                if (!payModal.row) return;
                if (!adminUser) {
                  alert('Admin user not loaded. Please try again.');
                  return;
                }
                setSaving(true);
                await addDoc(fsCollection(db, 'payments'), {
                  vendorId: payModal.row.vendorId,
                  vendorName: payModal.row.vendorName,
                  vendorCode: payModal.row.vendorCode,
                  voucherId: payModal.row.voucherId,
                  voucherNo: payModal.row.voucherNo,
                  jobWorkDone: payModal.row.jobWorkDone,
                  pricePerPiece: payModal.row.pricePerPiece,
                  netQty: payModal.row.netQty,
                  totalAmount: payModal.row.totalAmount,
                  amountPaid: Number(payAmount),
                  paymentDate: new Date().toISOString().slice(0, 10),
                  createdAt: serverTimestamp(),
                  paymentFrom: adminUser?.firstName && adminUser?.surname ? `${adminUser.firstName} ${adminUser.surname}` : adminUser?.email,
                  adminId: adminUser?.uid,
                });
                // Send payment notification to vendor
                await notificationService.sendPaymentNotification({
                  vendorUserId: payModal.row.vendorId,
                  paymentAmount: Number(payAmount),
                  voucherNo: payModal.row.voucherNo,
                  voucherId: payModal.row.voucherId,
                  workDescription: payModal.row.jobWorkDone
                });
                setSaving(false);
                setPayModal({ open: false, row: null });
                setPayAmount('');
                // Trigger refresh of VoucherDetails payments if open
                setVoucherDetailsRefreshKey(prev => prev + 1);
              }}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount to Pay</label>
                  <input
                    type="number"
                    min={payModal.row && payModal.row.totalAmount === 0 ? 0 : 1}
                    max={payModal.row ? payModal.row.pendingAmount : undefined}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={saving}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Pending amount: ₹{payModal.row ? payModal.row.pendingAmount.toLocaleString('en-IN') : 0}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPayModal({ open: false, row: null })}
                    className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
                    disabled={saving}
                  >
                    {saving ? 'Processing...' : 'Save Payment'}
                  </button>
                </div>
              </form>
            </Dialog.Panel>
          </div>
        )}
      </Dialog>

      {/* Payment Print Preview Modal */}
      <PaymentPrintPreviewModal
        paymentRows={displayRows}
        isOpen={printPreviewModal.open}
        onClose={() => setPrintPreviewModal({ open: false, reportType: 'all' })}
        reportType={printPreviewModal.reportType}
        singleRow={printPreviewModal.singleRow}
      />

      {/* Voucher Details Modal */}
      {voucherModal.open && voucherModal.voucher && (
        <VoucherDetails
          voucher={voucherModal.voucher}
          onClose={() => setVoucherModal({ open: false, voucher: null })}
          refreshKey={voucherDetailsRefreshKey}
        />
      )}
    </div>
  );
}
