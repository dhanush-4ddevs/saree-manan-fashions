'use client';

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, doc, getDoc, updateDoc, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Voucher, VoucherEvent, generateEventId } from '@/types/voucher';
import { getCurrentUser } from '@/config/firebase';
import { Package, Truck, MapPin, AlertCircle, Clock, User, Calendar, Check, Eye, FileText, Save, AlertTriangle, X, Search, Filter, SortAsc, SortDesc, RotateCcw, ArrowUpDown } from 'lucide-react';
import { analyzeVoucherCompletion, manuallyMarkVoucherComplete } from '@/utils/voucherCompletionUtils';
import { formatDate, getCurrentISTTime } from '@/utils/dateFormatter';
import { getDoc as firestoreGetDoc, doc as firestoreDoc, collection as firestoreCollection } from 'firebase/firestore';
import { notificationService } from '@/utils/notificationService';
import { determineNewStatus, updateVoucherStatus } from '@/utils/voucherStatusManager';
import { getNextEventSerialNumber } from '@/utils/voucherNumberGenerator';

export default function AdminReceiveVoucher() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<VoucherEvent | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Table state for search/sort/filter
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('voucherDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [jobWorkFilter, setJobWorkFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const [allVouchers, setAllVouchers] = useState<Voucher[]>([]);
  const [adminUid, setAdminUid] = useState<string | null>(null);

  // Cache for sender vendorJobWork and name/company
  const [senderJobWorks, setSenderJobWorks] = useState<{ [uid: string]: string }>({});
  const [senderNames, setSenderNames] = useState<{ [uid: string]: string }>({});

  // On mount, set adminUid
  useEffect(() => {
    getCurrentUser().then(user => {
      if (user) setAdminUid(user.uid);
    });
  }, []);

  // Split for display using normal event structure
  const pendingVouchers = React.useMemo(() => {
    if (!adminUid) return allVouchers;
    return allVouchers.filter(voucher => {
      // Get forward events to generic 'admin' that haven't been received yet
      const forwardEventsToAdmin = voucher.events.filter((event: VoucherEvent) =>
        event.event_type === 'forward' &&
        event.details &&
        event.details.receiver_id === 'admin'
      );

      // Check which forward events have corresponding receive events (by ANY admin)
      const receivedForwardEventIds = new Set(
        voucher.events
          .filter((event: VoucherEvent) => event.event_type === 'receive')
          .map((event: VoucherEvent) => event.parent_event_id)
      );

      // Return true if there are any forward events that haven't been received
      return forwardEventsToAdmin.some(event => !receivedForwardEventIds.has(event.event_id));
    });
  }, [allVouchers, adminUid]);

  const alreadyReceived = React.useMemo(() => {
    if (!adminUid) return [];
    return allVouchers.filter(voucher => {
      // Get forward events to generic 'admin'
      const forwardEventsToAdmin = voucher.events.filter((event: VoucherEvent) =>
        event.event_type === 'forward' &&
        event.details &&
        event.details.receiver_id === 'admin'
      );

      // Check which forward events have corresponding receive events (by ANY admin)
      const receivedForwardEventIds = new Set(
        voucher.events
          .filter((event: VoucherEvent) => event.event_type === 'receive')
          .map((event: VoucherEvent) => event.parent_event_id)
      );

      // Return true if all forward events have been received
      return forwardEventsToAdmin.length > 0 && forwardEventsToAdmin.every(event => receivedForwardEventIds.has(event.event_id));
    });
  }, [allVouchers, adminUid]);

  useEffect(() => {
    fetchPendingVouchers();
  }, []);

  // Fetch sender vendorJobWork and name/company for all visible rows
  useEffect(() => {
    const fetchJobWorks = async () => {
      const toFetch = new Set<string>();

      // Collect all sender user IDs from pending vouchers
      pendingVouchers.forEach(voucher => {
        const forwardEventsToAdmin = voucher.events.filter((event: VoucherEvent) =>
          event.event_type === 'forward' &&
          event.details &&
          event.details.receiver_id === 'admin'
        );

        forwardEventsToAdmin.forEach(event => {
          if (event.details.sender_id && (!senderJobWorks[event.details.sender_id] || !senderNames[event.details.sender_id])) {
            toFetch.add(event.details.sender_id);
          }
        });
      });

      if (toFetch.size === 0) return;
      const jobWorkUpdates: { [uid: string]: string } = {};
      const nameUpdates: { [uid: string]: string } = {};
      for (const uid of toFetch) {
        try {
          const userDoc = await firestoreGetDoc(firestoreDoc(firestoreCollection(db, 'users'), uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            jobWorkUpdates[uid] = data.vendorJobWork || '-';
            let name = (data.firstName || '') + (data.surname ? ' ' + data.surname : '');
            name = name.trim();
            if (data.companyName) {
              nameUpdates[uid] = name ? `${name} (${data.companyName})` : data.companyName;
            } else {
              nameUpdates[uid] = name || '-';
            }
          } else {
            jobWorkUpdates[uid] = '-';
            nameUpdates[uid] = '-';
          }
        } catch {
          jobWorkUpdates[uid] = '-';
          nameUpdates[uid] = '-';
        }
      }
      setSenderJobWorks(prev => ({ ...prev, ...jobWorkUpdates }));
      setSenderNames(prev => ({ ...prev, ...nameUpdates }));
    };
    fetchJobWorks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVouchers, adminUid]);

  const handleForceRefresh = () => {
    setRefreshing(true);
    setError(null);
    fetchPendingVouchers()
      .finally(() => setRefreshing(false));
  };

  const fetchPendingVouchers = async (): Promise<void> => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('Unauthorized access');
      }

      setLoading(true);
      setError(null);

      // First, fetch all admin users to get their UIDs (kept for potential future use)
      const usersRef = collection(db, 'users');
      const adminQuery = query(usersRef, where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      const adminUids = adminSnapshot.docs.map(doc => doc.id);

      // Fetch from main vouchers collection
      const vouchersRef = collection(db, 'vouchers');
      const vouchersQuery = query(vouchersRef);
      const vouchersSnapshot = await getDocs(vouchersQuery);
      const vouchers: Voucher[] = [];

      for (const docSnap of vouchersSnapshot.docs) {
        const voucherData = docSnap.data() as Voucher;
        if (!voucherData.events || !Array.isArray(voucherData.events)) continue;

        // Only include vouchers that have forward events to the generic 'admin'
        const hasForwardEventsToAdmin = voucherData.events.some((event: VoucherEvent) =>
          event.event_type === 'forward' &&
          event.details &&
          event.details.receiver_id === 'admin'
        );

        if (hasForwardEventsToAdmin) {
          vouchers.push({
            ...voucherData,
            id: docSnap.id
          });
        }
      }

      setAllVouchers(vouchers);
      return;
    } catch (error) {
      console.error('Error fetching pending vouchers:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch pending vouchers');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveVoucher = async (voucher: Voucher, forwardEvent: VoucherEvent) => {
    let originalVoucherSnapForMessage: any = null;
    let finalStatus: string = '';

    try {
      // Get current user before transaction
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Get the original voucher reference
      const originalVoucherId = voucher.id;
      if (!originalVoucherId) {
        throw new Error('Voucher ID not found');
      }

      const originalVoucherRef = doc(db, 'vouchers', originalVoucherId);
      const originalVoucherSnap = await getDoc(originalVoucherRef);

      if (!originalVoucherSnap.exists()) {
        throw new Error('Original voucher not found');
      }

      // Store for later use outside transaction
      originalVoucherSnapForMessage = originalVoucherSnap;

      // Use a transaction to ensure atomic updates
      await runTransaction(db, async (transaction) => {
        // Get the latest state of the original voucher
        const latestVoucherSnap = await transaction.get(originalVoucherRef);

        if (!latestVoucherSnap.exists()) {
          throw new Error('Voucher no longer exists');
        }

        const originalVoucherData = latestVoucherSnap.data() as Voucher;

        // Get next event serial number
        const eventSerialNo = await getNextEventSerialNumber(originalVoucherData.voucher_no);

        // Create admin receive event
        const adminReceiveEvent: VoucherEvent = {
          event_id: generateEventId(originalVoucherData.voucher_no, eventSerialNo),
          parent_event_id: forwardEvent.event_id,
          event_type: 'receive',
          timestamp: getCurrentISTTime(),
          user_id: currentUser.uid,
          comment: 'Admin received completion request',
          details: {
            receiver_id: currentUser.uid,
            quantity_received: forwardEvent.details.quantity_forwarded || 0
          }
        };

        // Update voucher with new event and status
        const updatedEvents = [...originalVoucherData.events, adminReceiveEvent];

        // Create updated voucher data with new events for proper totals calculation
        const updatedVoucherData = {
          ...originalVoucherData,
          events: updatedEvents
        };

        const newStatus = determineNewStatus(updatedVoucherData, 'receive', adminReceiveEvent);
        const statusUpdate = updateVoucherStatus(updatedVoucherData, newStatus);

        // Store the final status for use outside transaction
        finalStatus = newStatus;

        // Update the original voucher
        transaction.update(originalVoucherRef, {
          events: updatedEvents,
          ...statusUpdate,
          updatedAt: serverTimestamp()
        });

        console.log(`📋 Voucher ${originalVoucherData.voucher_no} status updated to: ${newStatus}`);

        // Send notifications based on completion status
        if (newStatus === 'Completed') {
          // Send completion notifications
          if (forwardEvent.details.sender_id) {
            await notificationService.sendVoucherCompletionNotification({
              vendorUserId: forwardEvent.details.sender_id,
              voucherNo: originalVoucherData.voucher_no,
              voucherId: originalVoucherId,
              itemName: originalVoucherData.item_details?.item_name || '',
              quantity: forwardEvent.details.quantity_forwarded || 0,
              isCompleted: true
            });
          }
        } else {
          // Send received notifications for partial completion
          console.log(`📬 Voucher received but not completed yet`);
          if (forwardEvent.details.sender_id) {
            await notificationService.sendVoucherCompletionNotification({
              vendorUserId: forwardEvent.details.sender_id,
              voucherNo: originalVoucherData.voucher_no,
              voucherId: originalVoucherId,
              itemName: originalVoucherData.item_details?.item_name || '',
              quantity: forwardEvent.details.quantity_forwarded || 0,
              isCompleted: false
            });
          }
        }
      });

      // Refresh the list after successful transaction
      fetchPendingVouchers();

      // Show appropriate success message
      const message = finalStatus === 'Completed'
        ? 'Voucher completion confirmed! All work is now completed.'
        : 'Voucher received! Note: Some partial quantities may still be pending with other vendors.';

      alert(message);
    } catch (error) {
      console.error('Error receiving voucher:', error);
      alert('Failed to receive voucher: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleViewDetails = (voucher: Voucher, forwardEvent: VoucherEvent) => {
    setSelectedVoucher(voucher);
    setSelectedEvent(forwardEvent);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedVoucher(null);
    setSelectedEvent(null);
  };

  // Helper function to check if a forward event has been received
  const isForwardEventReceived = (voucher: Voucher, forwardEvent: VoucherEvent): boolean => {
    if (!adminUid) return false;
    // For generic 'admin' forwards, check if ANY admin has received it
    return voucher.events.some((event: VoucherEvent) =>
      event.event_type === 'receive' &&
      event.parent_event_id === forwardEvent.event_id
    );
  };

  // Helper function to get pending forward events for a voucher
  const getPendingForwardEvents = (voucher: Voucher): VoucherEvent[] => {
    if (!adminUid) return [];

    const forwardEventsToAdmin = voucher.events.filter((event: VoucherEvent) =>
      event.event_type === 'forward' &&
      event.details &&
      event.details.receiver_id === 'admin'
    );

    // For generic 'admin' forwards, check if ANY admin has received it
    const receivedForwardEventIds = new Set(
      voucher.events
        .filter((event: VoucherEvent) => event.event_type === 'receive')
        .map((event: VoucherEvent) => event.parent_event_id)
    );

    return forwardEventsToAdmin.filter(event => !receivedForwardEventIds.has(event.event_id));
  };

  // Helper function to get received forward events for a voucher
  const getReceivedForwardEvents = (voucher: Voucher): VoucherEvent[] => {
    if (!adminUid) return [];

    const forwardEventsToAdmin = voucher.events.filter((event: VoucherEvent) =>
      event.event_type === 'forward' &&
      event.details &&
      event.details.receiver_id === 'admin'
    );

    const receivedForwardEventIds = new Set(
      voucher.events
        .filter((event: VoucherEvent) => event.event_type === 'receive')
        .map((event: VoucherEvent) => event.parent_event_id)
    );

    return forwardEventsToAdmin.filter(event => receivedForwardEventIds.has(event.event_id));
  };

  // Filtering and sorting logic
  const uniqueStatuses = Array.from(new Set(pendingVouchers.map(v => v.voucher_status))).sort();
  const uniqueJobWorks = Array.from(new Set(
    pendingVouchers.flatMap(voucher =>
      getPendingForwardEvents(voucher).map(event => event.details.jobWork || '')
    )
  )).filter(Boolean).sort();

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim() || !text) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\\]/g, '\\$&')})`, 'gi');
    return text.split(regex).map((part, index) =>
      regex.test(part) ? <mark key={index} className="bg-yellow-200 px-1 rounded">{part}</mark> : part
    );
  };

  const clearSearch = () => setSearchTerm('');

  const applyFiltersAndSearch = () => {
    let filtered = [...pendingVouchers];

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(voucher => {
        // Enhanced search across all relevant fields
        const searchMatch =
          // Basic voucher info
          voucher.voucher_no?.toLowerCase().includes(searchLower) ||
          voucher.voucher_status?.toLowerCase().includes(searchLower) ||

          // Item details
          voucher.item_details?.item_name?.toLowerCase().includes(searchLower) ||
          voucher.item_details?.supplier_name?.toLowerCase().includes(searchLower) ||
          voucher.item_details?.initial_quantity?.toString().includes(searchLower) ||
          voucher.item_details?.supplier_price_per_piece?.toString().includes(searchLower) ||

          // Date fields
          new Date(voucher.created_at).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }).toLowerCase().includes(searchLower) ||

          // Search in all events for comprehensive coverage
          voucher.events?.some(event => {
            // Job work details
            const jobWorkMatch = event.details?.jobWork?.toLowerCase().includes(searchLower);

            // Transport details
            const transportMatch =
              event.details?.transport?.transporter_name?.toLowerCase().includes(searchLower) ||
              event.details?.transport?.lr_no?.toLowerCase().includes(searchLower) ||
              event.details?.transport?.lr_date?.toLowerCase().includes(searchLower);

            // Quantity details
            const quantityMatch =
              event.details?.quantity_dispatched?.toString().includes(searchLower) ||
              event.details?.quantity_expected?.toString().includes(searchLower) ||
              event.details?.quantity_received?.toString().includes(searchLower) ||
              event.details?.quantity_before_job?.toString().includes(searchLower) ||
              event.details?.quantity_forwarded?.toString().includes(searchLower) ||
              event.details?.price_per_piece?.toString().includes(searchLower);

            // Discrepancy details
            const discrepancyMatch =
              event.details?.discrepancies?.missing?.toString().includes(searchLower) ||
              event.details?.discrepancies?.damaged_on_arrival?.toString().includes(searchLower) ||
              event.details?.discrepancies?.damaged_after_job?.toString().includes(searchLower) ||
              event.details?.discrepancies?.damage_reason?.toLowerCase().includes(searchLower);

            // Event metadata
            const eventMetaMatch =
              event.event_type?.toLowerCase().includes(searchLower) ||
              event.comment?.toLowerCase().includes(searchLower) ||
              event.event_id?.toLowerCase().includes(searchLower);

            return jobWorkMatch || transportMatch || quantityMatch || discrepancyMatch || eventMetaMatch;
          }) ||

          // Voucher totals and status tracking
          voucher.total_dispatched?.toString().includes(searchLower) ||
          voucher.total_received?.toString().includes(searchLower) ||
          voucher.total_forwarded?.toString().includes(searchLower) ||
          voucher.total_missing_on_arrival?.toString().includes(searchLower) ||
          voucher.total_damaged_on_arrival?.toString().includes(searchLower) ||
          voucher.total_damaged_after_work?.toString().includes(searchLower) ||
          voucher.admin_received_quantity?.toString().includes(searchLower) ||

          // User and creation details
          voucher.created_by_user_id?.toLowerCase().includes(searchLower);

        return searchMatch;
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(voucher => voucher.voucher_status === statusFilter);
    }

    // Filter by job work
    if (jobWorkFilter !== 'all') {
      filtered = filtered.filter(voucher =>
        getPendingForwardEvents(voucher).some(event => event.details.jobWork === jobWorkFilter)
      );
    }

    // Filter by date range
    if (startDate || endDate) {
      filtered = filtered.filter(voucher => {
        const voucherDate = new Date(voucher.created_at);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        if (start && end) {
          return voucherDate >= start && voucherDate <= end;
        } else if (start) {
          return voucherDate >= start;
        } else if (end) {
          return voucherDate <= end;
        }
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortField === 'created_at') {
        aValue = new Date(a.created_at || '1900-01-01');
        bValue = new Date(b.created_at || '1900-01-01');
      } else if (sortField === 'voucher_no') {
        aValue = a.voucher_no || '';
        bValue = b.voucher_no || '';
      } else if (sortField === 'item_details.item_name') {
        aValue = a.item_details?.item_name || '';
        bValue = b.item_details?.item_name || '';
      } else {
        aValue = a[sortField as keyof Voucher] || '';
        bValue = b[sortField as keyof Voucher] || '';
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue || '').toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return filtered;
  };

  const filteredVouchers = applyFiltersAndSearch();

  // Debug logging
  React.useEffect(() => {
    console.log('Admin UID:', adminUid);
    console.log('All Vouchers:', allVouchers);
    console.log('Pending Vouchers:', pendingVouchers);
    console.log('Already Received:', alreadyReceived);
  }, [adminUid, allVouchers, pendingVouchers, alreadyReceived]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-blue-600">Loading vouchers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        <AlertCircle className="inline-block mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-blue-100  lg:p-4">
      <div className="p-3 sm:p-4 bg-blue-600 text-white rounded-t-lg mb-4 flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center items-start justify-between">
        <div className="flex items-center">
          <FileText className="h-6 w-6 mr-2" />
          <h1 className="text-xl sm:text-2xl p-2 font-bold">ADMIN RECEIVE VOUCHERS</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          {/* Summary Statistics */}
          {/* <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
              <span>Pending: {pendingVouchers.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <span>Received: {alreadyReceived.length}</span>
            </div>
          </div> */}
          <button
            onClick={handleForceRefresh}
            disabled={refreshing}
            className="flex items-center justify-center px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-500 rounded-md transition-colors w-full sm:w-auto"
          >
            <RotateCcw className={`h-5 w-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      {!adminUid && (
        <div className="text-center p-8 text-red-600 font-bold">Admin UID not set. Are you logged in?</div>
      )}
      {adminUid && allVouchers.length === 0 && (
        <div className="text-center p-8 text-orange-600 font-bold">No vouchers found for admin. Check Firestore data and fetch logic.</div>
      )}
      {adminUid && allVouchers.length > 0 && (
        <>
          {/* Search and Filter Controls */}
          <div className="mb-4 p-2 sm:p-4 bg-gray-50 rounded-lg">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
                    className={`w-full pl-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!showFilters ? 'pr-24 sm:pr-20' : 'pr-10 sm:pr-4'}`}
                  />
                  {!showFilters && (
                    <button
                      onClick={() => {
                        // Trigger search when button is clicked
                      }}
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Search
                    </button>
                  )}
                  {searchTerm && (
                    <button
                      onClick={clearSearch}
                      className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 ${!showFilters ? 'right-20 sm:right-16' : 'right-10 sm:right-3'}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Right controls: Filters + Sort */}
              <div className="flex items-center gap-2 sm:gap-3 justify-end w-full sm:w-auto">
                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </button>

                {/* Sort Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    Sort
                  </button>
                  {showSortMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-md shadow-lg z-20">
                      <div className="p-2">
                        <div className="text-sm font-medium text-gray-700 mb-2">Sort by:</div>
                        {[
                          { field: 'created_at', label: 'Voucher Date' },
                          { field: 'voucher_no', label: 'Voucher No' },
                          { field: 'item_details.item_name', label: 'Item' }
                        ].map(({ field, label }) => (
                          <button
                            key={field}
                            onClick={() => {
                              setSortField(field);
                              setSortDirection(sortField === field && sortDirection === 'asc' ? 'desc' : 'asc');
                              setShowSortMenu(false);
                            }}
                            className={`w-full text-left px-2 py-1 rounded text-sm ${sortField === field ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                          >
                            {label} {sortField === field && (sortDirection === 'asc' ? <SortAsc className="inline h-3 w-3" /> : <SortDesc className="inline h-3 w-3" />)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium text-gray-700">Active Filters</h3>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-100"
                    title="Close filters"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Statuses</option>
                      {uniqueStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Work</label>
                    <select
                      value={jobWorkFilter}
                      onChange={(e) => setJobWorkFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Job Works</option>
                      {uniqueJobWorks.map(jobWork => (
                        <option key={jobWork} value={jobWork}>{jobWork}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vouchers Table - Desktop */}
          <div className="hidden lg:block relative border p-2 lg:p-0 border-blue-200 rounded-lg overflow-auto max-h-[70vh]">
            <div className="p-4 bg-blue-50 border-b border-blue-200">
              <h2 className="text-lg font-semibold text-blue-800 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                PENDING VOUCHERS TO RECEIVE ({filteredVouchers.length})
              </h2>
            </div>
            <table className="min-w-full bg-white">
              <thead className="bg-blue-50 sticky top-0 z-10">
                <tr>
                  {['SN', 'Voucher No', 'Voucher Dt', 'Item', 'LR Date', 'LR No', 'Sender', 'Sender Job Work', 'Sent Qty', 'Comment', 'Action'].map(header => (
                    <th key={header} className="border border-blue-200 p-2 text-blue-700 bg-blue-50">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.flatMap((voucher, voucherIndex) => {
                  const pendingEvents = getPendingForwardEvents(voucher);
                  return pendingEvents.map((event, eventIndex) => {
                    const senderId = event.details.sender_id || '';
                    return (
                      <tr key={`${voucher.id}-${event.event_id}`} className={(voucherIndex + eventIndex) % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                        <td className="border p-2">{voucherIndex + eventIndex + 1}</td>
                        <td className="border p-2">{highlightSearchTerm(voucher.voucher_no, searchTerm)}</td>
                        <td className="border p-2">{formatDate(voucher.created_at)}</td>
                        <td className="border p-2">{highlightSearchTerm(voucher.item_details?.item_name || '', searchTerm)}</td>
                        <td className="border p-2">{event.details.transport?.lr_date || '-'}</td>
                        <td className="border p-2">{event.details.transport?.lr_no || '-'}</td>
                        <td className="border p-2">{senderId ? (senderNames[senderId] ?? 'Loading...') : '-'}</td>
                        <td className="border p-2">{senderId ? (senderJobWorks[senderId] ?? 'Loading...') : '-'}</td>
                        <td className="border p-2">{event.details.quantity_forwarded || 'N/A'}</td>
                        <td className="border p-2">{event.comment || '-'}</td>
                        <td className="border p-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReceiveVoucher(voucher, event)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                            >
                              Receive
                            </button>
                            <button
                              onClick={() => handleViewDetails(voucher, event)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>

          {/* Vouchers Cards - Mobile/Tablet */}
          <div className="block lg:hidden p-2">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-3">
              <h2 className="text-base sm:text-lg font-semibold text-blue-800 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                PENDING VOUCHERS TO RECEIVE ({filteredVouchers.length})
              </h2>
            </div>
            <div className="space-y-3">
              {filteredVouchers.flatMap((voucher) => {
                const pendingEvents = getPendingForwardEvents(voucher);
                return pendingEvents.map((event) => {
                  const senderId = event.details.sender_id || '';
                  return (
                    <div key={`${voucher.id}-${event.event_id}`} className="bg-white border border-blue-200 rounded-md shadow-sm p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-gray-500">Voucher No</div>
                          <div className="text-sm font-semibold">{highlightSearchTerm(voucher.voucher_no, searchTerm)}</div>
                        </div>
                        <button
                          onClick={() => handleViewDetails(voucher, event)}
                          className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div>
                          <div className="text-gray-500">Date</div>
                          <div className="font-medium">{formatDate(voucher.created_at)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Item</div>
                          <div className="font-medium">{highlightSearchTerm(voucher.item_details?.item_name || '', searchTerm)}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Sender</div>
                          <div className="font-medium">{senderId ? (senderNames[senderId] ?? 'Loading...') : '-'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Job Work</div>
                          <div className="font-medium">{senderId ? (senderJobWorks[senderId] ?? 'Loading...') : '-'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">LR No</div>
                          <div className="font-medium">{event.details.transport?.lr_no || '-'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">LR Date</div>
                          <div className="font-medium">{event.details.transport?.lr_date || '-'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Sent Qty</div>
                          <div className="font-medium">{event.details.quantity_forwarded || 'N/A'}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-gray-500">Comment</div>
                          <div className="font-medium truncate">{event.comment || '-'}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col xs:flex-row gap-2">
                        <button
                          onClick={() => handleReceiveVoucher(voucher, event)}
                          className="w-full xs:w-auto px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          Receive
                        </button>
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>

          {/* No results message */}
          {filteredVouchers.length === 0 && pendingVouchers.length === 0 && (
            <div className="text-center p-8 text-gray-500">
              {searchTerm || statusFilter !== 'all' || jobWorkFilter !== 'all'
                ? 'No pending vouchers match your current filters.'
                : 'No pending vouchers found.'}
            </div>
          )}

          {/* No filtered results message */}
          {filteredVouchers.length === 0 && pendingVouchers.length > 0 && (
            <div className="text-center p-8 text-gray-500">
              No pending vouchers match your current filters.
            </div>
          )}

          {/* Already Received Vouchers Section */}
          {alreadyReceived.length > 0 && (
            <div className="mt-8">
              <div className="p-3 sm:p-4 bg-green-600 text-white rounded-t-lg mb-4 flex items-center justify-center">
                <Check className="h-6 w-6 mr-2" />
                <h1 className="text-xl sm:text-2xl font-bold text-center">ALREADY RECEIVED VOUCHERS ({alreadyReceived.length})</h1>
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block relative border border-green-200 rounded-lg overflow-auto max-h-[70vh]">
                <table className="min-w-full bg-white">
                  <thead className="bg-green-50 sticky top-0 z-10">
                    <tr>
                      {['SN', 'Voucher No', 'Voucher Dt', 'Item', 'LR Date', 'LR No', 'Sender', 'Sender Job Work', 'Received Qty', 'Receive Date', 'Status', 'Action'].map(header => (
                        <th key={header} className="border border-green-200 p-2 text-green-700 bg-green-50">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alreadyReceived.flatMap((voucher, voucherIndex) => {
                      // Get all forward events to admin that have been received
                      const receivedEvents = getReceivedForwardEvents(voucher);

                      return receivedEvents.map((event, eventIndex) => {
                        const senderId = event.details.sender_id || '';
                        const receiveEvent = voucher.events.find((e: VoucherEvent) =>
                          e.event_type === 'receive' &&
                          e.user_id === adminUid &&
                          e.parent_event_id === event.event_id
                        );

                        return (
                          <tr key={`${voucher.id}-${event.event_id}`} className={(voucherIndex + eventIndex) % 2 === 0 ? 'bg-white' : 'bg-green-50'}>
                            <td className="border p-2">{voucherIndex + eventIndex + 1}</td>
                            <td className="border p-2">{voucher.voucher_no}</td>
                            <td className="border p-2">{formatDate(voucher.created_at)}</td>
                            <td className="border p-2">{voucher.item_details?.item_name || ''}</td>
                            <td className="border p-2">{event.details.transport?.lr_date || '-'}</td>
                            <td className="border p-2">{event.details.transport?.lr_no || '-'}</td>
                            <td className="border p-2">{senderId ? (senderNames[senderId] ?? 'Loading...') : '-'}</td>
                            <td className="border p-2">{senderId ? (senderJobWorks[senderId] ?? 'Loading...') : '-'}</td>
                            <td className="border p-2">{receiveEvent?.details.quantity_received || 'N/A'}</td>
                            <td className="border p-2">{formatDate(receiveEvent?.timestamp || '')}</td>
                            <td className="border p-2">
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                Received
                              </span>
                            </td>
                            <td className="border p-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleViewDetails(voucher, event)}
                                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile/Tablet Cards */}
              <div className="block lg:hidden space-y-3">
                {alreadyReceived.flatMap((voucher) => {
                  const receivedEvents = getReceivedForwardEvents(voucher);

                  return receivedEvents.map((event) => {
                    const senderId = event.details.sender_id || '';
                    const receiveEvent = voucher.events.find((e: VoucherEvent) =>
                      e.event_type === 'receive' &&
                      e.user_id === adminUid &&
                      e.parent_event_id === event.event_id
                    );

                    return (
                      <div key={`${voucher.id}-${event.event_id}`} className="bg-white border border-green-200 rounded-md shadow-sm p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs text-gray-500">Voucher No</div>
                            <div className="text-sm font-semibold">{voucher.voucher_no}</div>
                          </div>
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-medium h-fit">Received</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                          <div>
                            <div className="text-gray-500">Date</div>
                            <div className="font-medium">{formatDate(voucher.created_at)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Item</div>
                            <div className="font-medium">{voucher.item_details?.item_name || ''}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Sender</div>
                            <div className="font-medium">{senderId ? (senderNames[senderId] ?? 'Loading...') : '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Job Work</div>
                            <div className="font-medium">{senderId ? (senderJobWorks[senderId] ?? 'Loading...') : '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">LR No</div>
                            <div className="font-medium">{event.details.transport?.lr_no || '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">LR Date</div>
                            <div className="font-medium">{event.details.transport?.lr_date || '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Received Qty</div>
                            <div className="font-medium">{receiveEvent?.details.quantity_received || 'N/A'}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Receive Date</div>
                            <div className="font-medium">{formatDate(receiveEvent?.timestamp || '')}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleViewDetails(voucher, event)}
                            className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center justify-center gap-1"
                          >
                            <Eye className="h-4 w-4" /> View Details
                          </button>
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          )}

          {/* Show message when no vouchers at all */}
          {allVouchers.length > 0 && pendingVouchers.length === 0 && alreadyReceived.length === 0 && (
            <div className="text-center p-8 text-gray-500">
              <div className="flex flex-col items-center gap-2">
                <Check className="h-12 w-12 text-green-400" />
                <p className="text-lg font-medium">All vouchers have been processed!</p>
                <p className="text-sm">No pending or received vouchers found.</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Voucher Details Modal */}
      {showDetails && selectedVoucher && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Voucher Details</h2>
              <button onClick={handleCloseDetails} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold">Voucher No:</label>
                  <p>{selectedVoucher.voucher_no}</p>
                </div>
                <div>
                  <label className="font-semibold">Voucher Date:</label>
                  <p>{formatDate(selectedVoucher.created_at)}</p>
                </div>
                <div>
                  <label className="font-semibold">Item:</label>
                  <p>{selectedVoucher.item_details?.item_name}</p>
                </div>
                <div>
                  <label className="font-semibold">Job Work:</label>
                  <p>{selectedEvent.details.jobWork}</p>
                </div>
                <div>
                  <label className="font-semibold">Quantity Forwarded:</label>
                  <p>{selectedEvent.details.quantity_forwarded}</p>
                </div>
                <div>
                  <label className="font-semibold">Status:</label>
                  <p>{selectedVoucher.voucher_status}</p>
                </div>
                <div>
                  <label className="font-semibold">LR Number:</label>
                  <p>{selectedEvent.details.transport?.lr_no || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">LR Date:</label>
                  <p>{selectedEvent.details.transport?.lr_date || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Transport:</label>
                  <p>{selectedEvent.details.transport?.transporter_name || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Comment:</label>
                  <p>{selectedEvent.comment || 'No comment'}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={handleCloseDetails}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Close
              </button>
              {selectedVoucher && selectedEvent && !isForwardEventReceived(selectedVoucher, selectedEvent) && (
                <button
                  onClick={() => {
                    handleReceiveVoucher(selectedVoucher, selectedEvent);
                    handleCloseDetails();
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Receive Voucher
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
