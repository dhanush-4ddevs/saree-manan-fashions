'use client';

import { useState, useEffect } from 'react';
import { Calendar, FileText, ArrowLeft, Printer, RefreshCw, ActivitySquare, Eye, Package, Wrench, Truck, User, DollarSign, AlertTriangle, MessageSquare, Edit, Split, ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { VoucherCardGrid } from './VoucherCardGrid';
import { Voucher } from '@/types/voucher';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where, Timestamp, doc, getDoc } from 'firebase/firestore';
import VoucherWorkflowTracker from './VoucherWorkflowTracker';
import VoucherDetails from './VoucherDetails';
import { PrintPreviewModal } from './PrintPreviewModal';

export default function TodayVouchers() {
  const router = useRouter();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'details' | 'workflow'>('list');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<Voucher | null>(null);
  const [activeTab, setActiveTab] = useState('Overview');

  // Capitalize first letter
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Dispatched': return 'text-yellow-600';
      case 'Received': return 'text-blue-600';
      case 'Forwarded': return 'text-indigo-600';
      case 'Completed': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  useEffect(() => {
    fetchTodayVouchers();
  }, []);

  const fetchTodayVouchers = async () => {
    try {
      setLoading(true);
      const vouchersRef = collection(db, 'vouchers');

      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Query for vouchers created today
      const todayQuery = query(
        vouchersRef,
        where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
        where('createdAt', '<', Timestamp.fromDate(endOfDay))
      );

      const querySnapshot = await getDocs(todayQuery);
      const vouchersList: Voucher[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        vouchersList.push({
          ...(data as Omit<Voucher, 'id'>),
          id: doc.id,
          // Convert Firestore timestamp to ISO string
          created_at: data.createdAt instanceof Timestamp ?
            data.createdAt.toDate().toISOString() :
            data.created_at || new Date().toISOString()
        });
      });

      // Fetch vendor details for each voucher
      const vouchersWithVendors = await Promise.all(
        vouchersList.map(async (voucher) => {
          let vendorName = 'N/A';
          const dispatchEvent = voucher.events.find(e => e.event_type === 'dispatch');
          if (dispatchEvent && dispatchEvent.details.receiver_id) {
            try {
              const vendorDoc = await getDoc(doc(db, 'users', dispatchEvent.details.receiver_id));
              if (vendorDoc.exists()) {
                const vendorData = vendorDoc.data();
                vendorName = vendorData.companyName || `${vendorData.firstName} ${vendorData.surname}`;
              }
            } catch (error) {
              console.error(`Error fetching vendor for voucher ${voucher.id}:`, error);
            }
          }
          return { ...voucher, vendorName };
        })
      );

      // Sort by creation time (newest first)
      vouchersWithVendors.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setVouchers(vouchersWithVendors);
    } catch (error) {
      console.error('Error fetching today\'s vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setViewMode('details');
  };

  const handlePrint = (voucher: Voucher) => {
    setSelectedVoucherForPrint(voucher);
    setShowPrintPreview(true);
  };

  const handleTrack = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setViewMode('workflow');
  };

  const handleEdit = (voucher: Voucher) => {
    router.push(`/admin-dashboard/vouchers/edit/${voucher.id}`);
  };

  const calculateStats = () => {
    const totalQuantity = vouchers.reduce((sum, voucher) => sum + voucher.item_details.initial_quantity, 0);
    const totalValue = vouchers.reduce((sum, voucher) =>
      sum + (voucher.item_details.initial_quantity * voucher.item_details.supplier_price_per_piece), 0
    );

    const statusCounts = vouchers.reduce((acc, voucher) => {
      acc[voucher.voucher_status] = (acc[voucher.voucher_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { totalQuantity, totalValue, statusCounts };
  };

  const stats = calculateStats();

  return (
    <div className="bg-white rounded-lg shadow-md border border-blue-100 overflow-hidden">
      <div className="p-4 bg-blue-50 border-b border-blue-100">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center mb-1">
              <Calendar className="h-5 w-5 text-blue-600 mr-2" />
              <h2 className="text-lg font-semibold text-blue-800">TODAY'S VOUCHERS</h2>
            </div>
            <p className="text-blue-600 text-xs">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchTodayVouchers}
              className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 text-sm"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        {vouchers.length > 0 && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-2.5 border border-blue-200">
              <div className="text-xs text-blue-600">Total Vouchers</div>
              <div className="text-sm font-bold text-blue-800">{vouchers.length}</div>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-blue-200">
              <div className="text-xs text-blue-600">Total Quantity</div>
              <div className="text-sm font-bold text-blue-800">{stats.totalQuantity} pieces</div>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-blue-200">
              <div className="text-xs text-blue-600">Total Value</div>
              <div className="text-sm font-bold text-blue-800">₹{stats.totalValue.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-blue-200">
              <div className="text-xs text-blue-600">Status Breakdown</div>
              <div className="text-xs text-blue-700">
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <div key={status}>
                    {capitalize(status.replace('_', ' '))}: {count}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : viewMode === 'workflow' && selectedVoucher ? (
          <VoucherWorkflowTracker voucherId={selectedVoucher.id} />
        ) : viewMode === 'details' && selectedVoucher ? (
          <VoucherDetails
            voucher={selectedVoucher}
            onClose={() => setViewMode('list')}
          />
        ) : vouchers.length === 0 ? (
          <div className="bg-blue-50 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center justify-center">
              <FileText className="h-12 w-12 text-blue-300 mb-3" />
              <h3 className="text-lg font-medium text-blue-800 mb-1">No vouchers created today</h3>
              <p className="text-blue-600 mb-4 text-sm">All today's activity will appear here</p>
            </div>
          </div>
        ) : (
          <VoucherCardGrid
            vouchers={vouchers}
            onView={handleView}
            onPrint={handlePrint}
            onTrack={handleTrack}
            onEdit={handleEdit}
          />
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
    </div>
  );
}
