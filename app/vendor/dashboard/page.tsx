'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  CheckCircle,
  Package,
  Clock,
  User,
  ExternalLink,
  Calendar,
  Box,
  Tag,
  RefreshCw
} from 'lucide-react';
import { getCurrentUser } from '../../config/firebase';
import VendorProtectedRoute from '../../components/vendor/VendorProtectedRoute';
import VendorNavbar from '../../components/vendor/VendorNavbar';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, limit, orderBy, Timestamp, or } from 'firebase/firestore';
import Image from 'next/image';
import { getStatusBackgroundColor } from '@/utils/voucherStatusManager';
import { ImageContainer } from '../../components/shared/ImageContainer';

export default function VendorDashboard() {
  const router = useRouter();
  const [vendorData, setVendorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [latestVouchers, setLatestVouchers] = useState<any[]>([]);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState({
    totalVouchers: 0,
    pendingVouchers: 0,
    completedVouchers: 0,
    newVouchers: 0
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Get current vendor data
    const loadVendorData = async () => {
      try {
        const userData = await getCurrentUser();
        if (userData) {
          setVendorData(userData);
          await fetchVoucherData(userData.uid);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading vendor data:', error);
        setLoading(false);
      }
    };

    loadVendorData();
  }, []);

  const handleRefresh = async () => {
    if (!vendorData?.uid) return;

    setRefreshing(true);
    try {
      await fetchVoucherData(vendorData.uid);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchVoucherData = async (vendorUserId: string) => {
    try {
      console.log('Fetching voucher data for vendor:', vendorUserId);
      const vouchersRef = collection(db, 'vouchers');

      // Get all vouchers and filter by vendor involvement in events
      const allVouchersQuery = query(vouchersRef);
      const snapshot = await getDocs(allVouchersQuery);

      console.log('Total vouchers found:', snapshot.docs.length);

      const allVouchers = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as any[];

      // Debug: Log first few vouchers to understand structure
      if (allVouchers.length > 0) {
        console.log('Sample voucher structure:', allVouchers[0]);
        console.log('Sample voucher events:', allVouchers[0].events);
      } else {
        console.log('No vouchers found in database');
      }

      // Filter vouchers where this vendor is involved
      const vendorVouchers = allVouchers.filter(voucher => {
        // Check if vendor is involved in any events
        const hasInvolvement = voucher.events && voucher.events.some((event: any) =>
          event.user_id === vendorUserId ||
          event.details?.receiver_id === vendorUserId ||
          event.details?.sender_id === vendorUserId
        );

        if (hasInvolvement) {
          console.log('Vendor involved in voucher:', voucher.voucher_no, 'Events:', voucher.events?.length);
          console.log('Voucher events:', voucher.events);
        }

        return hasInvolvement;
      });

      console.log('Vouchers where vendor is involved:', vendorVouchers.length);

      // Calculate stats based on vendor involvement
      let totalVouchers = 0;
      let pendingCount = 0;
      let completedCount = 0;
      let newCount = 0;

      vendorVouchers.forEach(voucher => {
        const voucherData = voucher as any;

        // Check if vendor has received this voucher (has receive event)
        const hasReceived = voucherData.events?.some((event: any) =>
          event.event_type === 'receive' &&
          (event.user_id === vendorUserId || event.details?.receiver_id === vendorUserId)
        );

        // Check if vendor has forwarded this voucher (has forward event)
        const hasForwarded = voucherData.events?.some((event: any) =>
          event.event_type === 'forward' &&
          (event.user_id === vendorUserId || event.details?.sender_id === vendorUserId)
        );

        // Check if vendor is the current holder (last event involves this vendor)
        const sortedEvents = voucherData.events?.sort((a: any, b: any) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ) || [];

        const lastEvent = sortedEvents[sortedEvents.length - 1];
        const isCurrentHolder = lastEvent && (
          lastEvent.user_id === vendorUserId ||
          lastEvent.details?.receiver_id === vendorUserId
        );

        // Total vouchers: All vouchers this vendor has been involved with
        if (hasReceived || hasForwarded || isCurrentHolder) {
          totalVouchers++;
        }

        // Completed: All vouchers where vendor is sender (user_id) and event is forward
        if (voucherData.events?.some((event: any) =>
          event.event_type === 'forward' && event.user_id === vendorUserId
        )) {
          completedCount++;
        }

        // Pending: All vouchers where vendor is receiver (receiver_id) in non-receive events
        // AND there is no forward event with current vendor as sender
        const isReceiverInNonReceiveEvent = voucherData.events?.some((event: any) =>
          event.event_type !== 'receive' && event.details?.receiver_id === vendorUserId
        );

        const hasForwardedAsSender = voucherData.events?.some((event: any) =>
          event.event_type === 'forward' && event.user_id === vendorUserId
        );

        if (isReceiverInNonReceiveEvent && !hasForwardedAsSender) {
          pendingCount++;
        }

        // New: Pending or forwarded vouchers in last 24 hours
        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);

        const hasRecentActivity = voucherData.events?.some((event: any) => {
          const eventTime = new Date(event.timestamp);
          const isRecent = eventTime >= last24Hours;
          const isPendingOrForwarded = event.event_type === 'forward' ||
            (event.event_type !== 'receive' && event.details?.receiver_id === vendorUserId);

          return isRecent && isPendingOrForwarded;
        });

        if (hasRecentActivity) {
          newCount++;
        }
      });

      console.log('Dashboard stats calculated:', {
        totalVouchers,
        pendingCount,
        completedCount,
        newCount
      });

      setDashboardStats({
        totalVouchers,
        pendingVouchers: pendingCount,
        completedVouchers: completedCount,
        newVouchers: newCount
      });

      // Get latest vouchers for display (vouchers where vendor is involved, sorted by most recent)
      const receivedVouchers = vendorVouchers
        .filter(voucher => {
          const voucherData = voucher as any;
          // Include vouchers where vendor has received, forwarded, or is current holder
          const hasReceived = voucherData.events?.some((event: any) =>
            event.event_type === 'receive' &&
            (event.user_id === vendorUserId || event.details?.receiver_id === vendorUserId)
          );
          const hasForwarded = voucherData.events?.some((event: any) =>
            event.event_type === 'forward' &&
            (event.user_id === vendorUserId || event.details?.sender_id === vendorUserId)
          );
          const sortedEvents = voucherData.events?.sort((a: any, b: any) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          ) || [];
          const lastEvent = sortedEvents[sortedEvents.length - 1];
          const isCurrentHolder = lastEvent && (
            lastEvent.user_id === vendorUserId ||
            lastEvent.details?.receiver_id === vendorUserId
          );

          return hasReceived || hasForwarded || isCurrentHolder;
        })
        .sort((a, b) => {
          // Use created_at for sorting (new voucher structure)
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 6)
        .map(voucher => ({
          ...voucher,
          // Ensure we have the correct date format for display
          createdAt: voucher.created_at
        }));

      console.log('Latest vouchers for display:', receivedVouchers.length);
      setLatestVouchers(receivedVouchers);

    } catch (error) {
      console.error('Error fetching voucher data:', error);
      // Set default stats on error
      setDashboardStats({
        totalVouchers: 0,
        pendingVouchers: 0,
        completedVouchers: 0,
        newVouchers: 0
      });
      setLatestVouchers([]);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeColor = (status: string) => {
    return getStatusBackgroundColor(status as any) || 'bg-gray-100 text-gray-800';
  };

  // Tooltip data
  const tooltips = {
    total: "All vouchers you have been involved with - whether you sent them, received them, or currently hold them",
    pending: "Vouchers that have been sent to you but you haven't forwarded them to someone else yet",
    completed: "Vouchers that you have successfully forwarded to other vendors or parties",
    new: "Vouchers with recent activity in the last 24 hours - either pending or recently forwarded"
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-800">Loading vendor dashboard...</p>
        </div>
      </div>
    );
  }

  const dashboardContent = (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-blue-800 mb-2">Vendor Dashboard</h1>
          <p className="text-blue-600 mb-4">Hello, {vendorData?.firstName}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stats Cards - Now using dynamic data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Total Vouchers */}
        <div
          className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-blue-100 hover:shadow-md transition-shadow relative"
          onMouseEnter={() => setHoveredCard('total')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div className="flex items-center">
            <div className="bg-indigo-50 p-2 md:p-3 rounded-lg mr-3">
              <FileText className="h-5 w-5 md:h-6 md:w-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-medium text-gray-700">Total Vouchers</h2>
              <p className="text-lg md:text-2xl font-bold text-gray-900">{dashboardStats.totalVouchers}</p>
            </div>
          </div>
          {hoveredCard === 'total' && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10 whitespace-nowrap">
              {tooltips.total}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
            </div>
          )}
        </div>

        {/* Pending Vouchers */}
        <div
          className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-blue-100 hover:shadow-md transition-shadow relative"
          onMouseEnter={() => setHoveredCard('pending')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div className="flex items-center">
            <div className="bg-amber-50 p-2 md:p-3 rounded-lg mr-3">
              <Package className="h-5 w-5 md:h-6 md:w-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-medium text-gray-700">Pending</h2>
              <p className="text-lg md:text-2xl font-bold text-gray-900">{dashboardStats.pendingVouchers}</p>
            </div>
          </div>
          {hoveredCard === 'pending' && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10 whitespace-nowrap">
              {tooltips.pending}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
            </div>
          )}
        </div>

        {/* Completed Vouchers */}
        <div
          className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-blue-100 hover:shadow-md transition-shadow relative"
          onMouseEnter={() => setHoveredCard('completed')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div className="flex items-center">
            <div className="bg-green-50 p-2 md:p-3 rounded-lg mr-3">
              <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-medium text-gray-700">Completed</h2>
              <p className="text-lg md:text-2xl font-bold text-gray-900">{dashboardStats.completedVouchers}</p>
            </div>
          </div>
          {hoveredCard === 'completed' && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10 whitespace-nowrap">
              {tooltips.completed}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
            </div>
          )}
        </div>

        {/* New Vouchers */}
        <div
          className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-blue-100 hover:shadow-md transition-shadow relative"
          onMouseEnter={() => setHoveredCard('new')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div className="flex items-center">
            <div className="bg-blue-50 p-2 md:p-3 rounded-lg mr-3">
              <Clock className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-medium text-gray-700">New</h2>
              <p className="text-lg md:text-2xl font-bold text-gray-900">{dashboardStats.newVouchers}</p>
            </div>
          </div>
          {hoveredCard === 'new' && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-10 whitespace-nowrap">
              {tooltips.new}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
            </div>
          )}
        </div>
      </div>

      {/* Latest Received Vouchers Section */}
      <div>
        <h2 className="text-lg md:text-xl font-bold text-blue-800 mb-3">Recently Received Vouchers</h2>

        {latestVouchers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {latestVouchers.map((voucher) => (
              <div key={voucher.id} className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden transition-all hover:shadow-md">
                <div className="relative h-36 md:h-40 w-full bg-gray-100">
                  {voucher.item_details?.images?.[0] ? (
                    <ImageContainer
                      images={voucher.item_details.images}
                      size="lg"
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <FileText className="h-12 w-12 text-gray-300" />
                    </div>
                  )}
                </div>

                <div className="p-3 md:p-4">
                  <div className="mb-2">
                    <h3 className="font-semibold text-base text-gray-800 truncate">{voucher.item_details?.item_name || 'No item name'}</h3>
                  </div>

                  <div className="space-y-1 mb-3">
                    <div className="flex items-center text-xs md:text-sm text-gray-600">
                      <Tag className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
                      <span className="truncate">Voucher No: {voucher.voucher_no || 'N/A'}</span>
                    </div>
                    <div className="flex items-center text-xs md:text-sm text-gray-600">
                      <Box className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
                      <span>Qty: {voucher.item_details?.initial_quantity || 0}</span>
                    </div>
                    <div className="flex items-center text-xs md:text-sm text-gray-600">
                      <Calendar className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
                      <span>Voucher Date: {formatDate(voucher.created_at)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/vendor/receive-report?voucherId=${voucher.id}`)}
                    className="w-full flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium py-1.5 px-3 rounded-md transition-colors text-sm"
                  >
                    <span>View Details</span>
                    <ExternalLink className="ml-1 h-3 w-3 md:h-4 md:w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-blue-100 text-center">
            <FileText className="h-10 w-10 text-blue-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No vouchers found</p>
            <p className="text-sm text-gray-500">
              {dashboardStats.totalVouchers === 0
                ? "You haven't been assigned any vouchers yet. Vouchers will appear here once they are dispatched to you."
                : "No recently received vouchers to display."
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <VendorProtectedRoute>
      <VendorNavbar>
        {dashboardContent}
      </VendorNavbar>
    </VendorProtectedRoute>
  );
}
