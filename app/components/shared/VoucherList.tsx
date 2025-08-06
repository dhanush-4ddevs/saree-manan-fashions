'use client';

import { useState } from 'react';
import { Voucher } from '@/types/voucher';
import { Search, Filter, SortAsc, SortDesc, Eye, Printer, Edit, Trash, AlertCircle, Calendar, Package, User, Truck } from 'lucide-react';
import { db } from '@/config/firebase';
import { PrintPreviewModal } from './PrintPreviewModal';

interface VoucherListProps {
  vouchers: Voucher[];
  onEdit?: (voucher: Voucher) => void;
  onDelete?: (voucher: Voucher) => void;
  onPrintAll?: () => void;
  onViewWorkflow?: (voucher: Voucher) => void;
  onViewDetails?: (voucher: Voucher) => void;
}

export function VoucherList({ vouchers, onEdit, onDelete, onPrintAll, onViewWorkflow, onViewDetails }: VoucherListProps) {
  const totalQuantity = vouchers.reduce((sum, voucher) => sum + voucher.item_details.initial_quantity, 0);
  const totalValue = vouchers.reduce((sum, voucher) => sum + (voucher.item_details.initial_quantity * voucher.item_details.supplier_price_per_piece), 0);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<keyof Voucher>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<Voucher | null>(null);

  // Filter vouchers based on search term and status
  const filteredVouchers = vouchers.filter(voucher => {
    const matchesSearch = searchTerm === '' ||
      // Basic voucher info
      voucher.voucher_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voucher.voucher_status.toLowerCase().includes(searchTerm.toLowerCase()) ||

      // Item details
      voucher.item_details.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voucher.item_details.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voucher.item_details.initial_quantity.toString().includes(searchTerm.toLowerCase()) ||
      voucher.item_details.supplier_price_per_piece.toString().includes(searchTerm.toLowerCase()) ||

      // Date fields
      new Date(voucher.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toLowerCase().includes(searchTerm.toLowerCase()) ||

      // Search in all events for comprehensive coverage
      voucher.events.some(event => {
        // Job work details
        const jobWorkMatch = event.details?.jobWork?.toLowerCase().includes(searchTerm.toLowerCase());

        // Transport details
        const transportMatch =
          event.details?.transport?.transporter_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.details?.transport?.lr_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.details?.transport?.lr_date?.toLowerCase().includes(searchTerm.toLowerCase());

        // Quantity details
        const quantityMatch =
          event.details?.quantity_dispatched?.toString().includes(searchTerm.toLowerCase()) ||
          event.details?.quantity_expected?.toString().includes(searchTerm.toLowerCase()) ||
          event.details?.quantity_received?.toString().includes(searchTerm.toLowerCase()) ||
          event.details?.quantity_before_job?.toString().includes(searchTerm.toLowerCase()) ||
          event.details?.quantity_forwarded?.toString().includes(searchTerm.toLowerCase()) ||
          event.details?.price_per_piece?.toString().includes(searchTerm.toLowerCase());

        // Discrepancy details
        const discrepancyMatch =
          event.details?.discrepancies?.missing?.toString().includes(searchTerm.toLowerCase()) ||
          event.details?.discrepancies?.damaged_on_arrival?.toString().includes(searchTerm.toLowerCase()) ||
          event.details?.discrepancies?.damaged_after_job?.toString().includes(searchTerm.toLowerCase()) ||
          event.details?.discrepancies?.damage_reason?.toLowerCase().includes(searchTerm.toLowerCase());

        // Event metadata
        const eventMetaMatch =
          event.event_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.comment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.event_id?.toLowerCase().includes(searchTerm.toLowerCase());

        return jobWorkMatch || transportMatch || quantityMatch || discrepancyMatch || eventMetaMatch;
      }) ||

      // Voucher totals and status tracking
      voucher.total_dispatched?.toString().includes(searchTerm.toLowerCase()) ||
      voucher.total_received?.toString().includes(searchTerm.toLowerCase()) ||
      voucher.total_forwarded?.toString().includes(searchTerm.toLowerCase()) ||
      voucher.total_missing_on_arrival?.toString().includes(searchTerm.toLowerCase()) ||
      voucher.total_damaged_on_arrival?.toString().includes(searchTerm.toLowerCase()) ||
      voucher.total_damaged_after_work?.toString().includes(searchTerm.toLowerCase()) ||
      voucher.admin_received_quantity?.toString().includes(searchTerm.toLowerCase()) ||

      // User and creation details
      voucher.created_by_user_id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || voucher.voucher_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Sort vouchers
  const sortedVouchers = [...filteredVouchers].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    if (sortField === 'voucher_no') {
      aValue = a.voucher_no;
      bValue = b.voucher_no;
    } else if (sortField === 'created_at') {
      aValue = new Date(a.created_at);
      bValue = new Date(b.created_at);
    } else if (sortField === 'voucher_status') {
      aValue = a.voucher_status;
      bValue = b.voucher_status;
    } else {
      aValue = a[sortField];
      bValue = b[sortField];
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: keyof Voucher) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Dispatched':
        return 'bg-yellow-100 text-yellow-800';
      case 'Received':
        return 'bg-blue-100 text-blue-800';
      case 'Forwarded':
        return 'bg-indigo-100 text-indigo-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLatestTransportInfo = (voucher: Voucher) => {
    const dispatchEvents = voucher.events.filter(event =>
      event.event_type === 'dispatch' || event.event_type === 'forward'
    );
    const latestEvent = dispatchEvents[dispatchEvents.length - 1];
    return latestEvent?.details?.transport;
  };

  const handlePrint = (voucher: Voucher) => {
    setSelectedVoucherForPrint(voucher);
    setShowPrintPreview(true);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header with stats */}
      <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-blue-900">Vouchers</h3>
            <p className="text-sm text-blue-600">
              {filteredVouchers.length} voucher{filteredVouchers.length !== 1 ? 's' : ''} •
              Total Qty: {totalQuantity} pieces •
              Total Value: ₹{totalValue.toFixed(2)}
            </p>
          </div>
          {onPrintAll && (
            <button
              onClick={onPrintAll}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print All
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search vouchers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    // Trigger search on Enter key
                  }
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Received">Received</option>
              <option value="Forwarded">Forwarded</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('voucher_no')}
              >
                <div className="flex items-center">
                  Voucher No
                  {sortField === 'voucher_no' && (
                    sortDirection === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <SortDesc className="ml-1 h-4 w-4" />
                  )}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('created_at')}
              >
                <div className="flex items-center">
                  Date
                  {sortField === 'created_at' && (
                    sortDirection === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <SortDesc className="ml-1 h-4 w-4" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('voucher_status')}
              >
                <div className="flex items-center">
                  Status
                  {sortField === 'voucher_status' && (
                    sortDirection === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <SortDesc className="ml-1 h-4 w-4" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transport
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Events
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedVouchers.map((voucher, index) => {
              const transportInfo = getLatestTransportInfo(voucher);
              return (
                <tr key={voucher.voucher_no} className="hover:bg-blue-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-900">
                      {voucher.voucher_no}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{formatDate(voucher.created_at)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start">
                      <Package className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                          {voucher.item_details.item_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          Supplier: {voucher.item_details.supplier_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 font-medium">
                      {voucher.item_details.initial_quantity}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">pieces</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      ₹{(voucher.item_details.initial_quantity * voucher.item_details.supplier_price_per_piece).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      ₹{voucher.item_details.supplier_price_per_piece}/piece
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(voucher.voucher_status)}`}>
                      {voucher.voucher_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {transportInfo ? (
                      <div className="flex items-start">
                        <Truck className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                        <div className="text-sm text-gray-500">
                          <div>LR: {transportInfo.lr_no}</div>
                          <div className="truncate max-w-24">{transportInfo.transporter_name}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500">
                      {voucher.events.length} event{voucher.events.length !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {onViewDetails && (
                        <button
                          onClick={() => onViewDetails(voucher)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      {onViewWorkflow && (
                        <button
                          onClick={() => onViewWorkflow(voucher)}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
                          title="View Workflow"
                        >
                          <AlertCircle className="h-4 w-4" />
                        </button>
                      )}
                      {onEdit && voucher.voucher_status === 'Dispatched' && (
                        <button
                          onClick={() => onEdit(voucher)}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Edit Voucher"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handlePrint(voucher)}
                        className="text-gray-600 hover:text-gray-900 p-1"
                        title="Print Preview"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      {onDelete && voucher.voucher_status === 'Dispatched' && (
                        <button
                          onClick={() => onDelete(voucher)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete Voucher"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {sortedVouchers.length === 0 && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No vouchers found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by creating your first voucher.'
            }
          </p>
        </div>
      )}

      {/* Print Preview Modal */}
      <PrintPreviewModal
        voucher={selectedVoucherForPrint}
        isOpen={showPrintPreview}
        onClose={() => {
          setShowPrintPreview(false);
          setSelectedVoucherForPrint(null);
        }}
      />
    </div>
  );
}
