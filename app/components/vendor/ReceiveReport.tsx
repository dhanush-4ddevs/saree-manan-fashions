'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { FileText, Save, AlertTriangle, X, Search, Filter, SortAsc, SortDesc, RotateCcw, ArrowUpDown, List, Grid3X3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { getCurrentUser } from '../../config/firebase';
import { Voucher, VoucherEvent, generateEventId } from '../../types/voucher';
import { ImageContainer } from '../shared/ImageContainer';
import { determineNewStatus, updateVoucherStatus } from '../../utils/voucherStatusManager';
import { ReceiveReportCardGrid } from './ReceiveReportCardGrid';
import { AlreadyReceivedCardGrid } from './AlreadyReceivedCardGrid';

interface ReceiveItem {
  id: string; // Composite ID: {voucherId}-{eventId}
  voucherId: string;
  eventId: string;
  voucherNo: string;
  voucherDate: string;
  imageUrl?: string | null;
  item: string;
  jobWork: string;
  vendorCode: string;
  lrDate: string;
  lrNumber: string;
  transportName: string;
  quantityExpected: number;
  quantityReceived: number;
  missing: number;
  damagedOnArrival: number;
  damageReason: string;
  receiverComment: string;
  status: string;
  senderId?: string;
  senderName: string; // This will need to be resolved
  senderType: 'admin' | 'vendor';
  isForwarded?: boolean;
}

export default function ReceiveReport() {
  const [vouchers, setVouchers] = useState<ReceiveItem[]>([]);
  const [alreadyReceivedVouchers, setAlreadyReceivedVouchers] = useState<ReceiveItem[]>([]);
  const [filteredVouchers, setFilteredVouchers] = useState<ReceiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ [key: string]: any }>({});
  const [saving, setSaving] = useState(false);
  const [recentReceivedEvents, setRecentReceivedEvents] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('voucherDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [jobWorkFilter, setJobWorkFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Separate state for already received section
  const [alreadyReceivedViewMode, setAlreadyReceivedViewMode] = useState<'table' | 'card'>('table');
  const [alreadyReceivedSearchTerm, setAlreadyReceivedSearchTerm] = useState('');
  const [alreadyReceivedShowFilters, setAlreadyReceivedShowFilters] = useState(false);
  const [alreadyReceivedStatusFilter, setAlreadyReceivedStatusFilter] = useState<string>('all');
  const [alreadyReceivedJobWorkFilter, setAlreadyReceivedJobWorkFilter] = useState<string>('all');

  // Sorting state for already received table
  const [alreadyReceivedSortField, setAlreadyReceivedSortField] = useState<string>('voucherDate');
  const [alreadyReceivedSortDirection, setAlreadyReceivedSortDirection] = useState<'asc' | 'desc'>('desc');
  const [sortedAlreadyReceivedVouchers, setSortedAlreadyReceivedVouchers] = useState<ReceiveItem[]>([]);
  const [filteredAlreadyReceivedVouchers, setFilteredAlreadyReceivedVouchers] = useState<ReceiveItem[]>([]);

  const router = useRouter();
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const fetchVouchersForUser = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      if (!currentUser) throw new Error('User not authenticated.');

      const q = query(collection(db, 'vouchers'));
      const querySnapshot = await getDocs(q);
      const itemsToReceive: ReceiveItem[] = [];
      const itemsAlreadyReceived: ReceiveItem[] = [];
      const userDocs = new Map<string, any>();
      const recentEvents: any[] = [];

      const getUserDoc = async (userId: string) => {
        if (userDocs.has(userId)) return userDocs.get(userId);
        const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', userId)));
        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data();
          userDocs.set(userId, userData);
          return userData;
        }
        return null;
      }

      for (const docSnap of querySnapshot.docs) {
        const voucher = { id: docSnap.id, ...docSnap.data() } as Voucher;
        const receivedEventParentIds = new Set(
          voucher.events
            .filter((e: VoucherEvent) => e.event_type === 'receive' && e.user_id === currentUser.uid)
            .map((e: VoucherEvent) => e.parent_event_id)
        );

        for (const event of voucher.events) {
          // FIX: include both 'dispatch' and 'forward' events for receiving
          if ((event.event_type === 'dispatch' || event.event_type === 'forward') && event.details.receiver_id === currentUser.uid) {
            const senderDoc = event.details.sender_id ? await getUserDoc(event.details.sender_id) : null;
            const senderName = senderDoc ? `${senderDoc.firstName || ''} ${senderDoc.surname || ''}`.trim() : 'Admin';
            const senderType = senderDoc && senderDoc.role !== 'admin' ? 'vendor' : 'admin';

            if (receivedEventParentIds.has(event.event_id)) {
              // This voucher has been received by the current user
              const receiveEvent = voucher.events.find((e: VoucherEvent) => e.parent_event_id === event.event_id && e.event_type === 'receive');
              if (receiveEvent) {
                const hasBeenForwarded = voucher.events.some((e: VoucherEvent) => e.parent_event_id === receiveEvent.event_id && e.user_id === currentUser.uid && e.event_type === 'forward');
                itemsAlreadyReceived.push({
                  id: `${voucher.id}-${receiveEvent.event_id}`,
                  voucherId: voucher.id!,
                  eventId: receiveEvent.event_id,
                  voucherNo: voucher.voucher_no,
                  voucherDate: voucher.createdAt && voucher.createdAt.toDate ? voucher.createdAt.toDate().toLocaleString() : new Date(voucher.created_at).toLocaleString(),
                  imageUrl: voucher.item_details.images?.[0],
                  item: voucher.item_details.item_name,
                  jobWork: event.details.jobWork || 'N/A',
                  vendorCode: currentUser.userCode || 'N/A',
                  lrDate: event.details.transport?.lr_date || '',
                  lrNumber: event.details.transport?.lr_no || '',
                  transportName: event.details.transport?.transporter_name || '',
                  quantityExpected:
                    event.event_type === 'forward'
                      ? event.details.quantity_forwarded || 0
                      : event.details.quantity_dispatched || event.details.quantity_expected || 0,
                  quantityReceived: receiveEvent.details.quantity_received || 0,
                  missing:
                    (event.event_type === 'forward'
                      ? event.details.quantity_forwarded || 0
                      : event.details.quantity_dispatched || event.details.quantity_expected || 0) -
                    (receiveEvent.details.quantity_received || 0),
                  damagedOnArrival: receiveEvent.details.discrepancies?.damaged_on_arrival || 0,
                  damageReason: receiveEvent.details.discrepancies?.damage_reason || '',
                  receiverComment: receiveEvent.comment,
                  status: voucher.voucher_status,
                  senderId: event.details.sender_id,
                  senderName: senderName,
                  senderType: senderType,
                  isForwarded: hasBeenForwarded,
                });
              }
            } else {
              // This voucher is pending receipt
              itemsToReceive.push({
                id: `${voucher.id}-${event.event_id}`,
                voucherId: voucher.id!,
                eventId: event.event_id,
                voucherNo: voucher.voucher_no,
                voucherDate: voucher.createdAt && voucher.createdAt.toDate ? voucher.createdAt.toDate().toLocaleString() : new Date(voucher.created_at).toLocaleString(),
                imageUrl: voucher.item_details.images?.[0],
                item: voucher.item_details.item_name,
                jobWork: event.details.jobWork || 'N/A',
                vendorCode: currentUser.userCode || 'N/A',
                lrDate: event.details.transport?.lr_date || '',
                lrNumber: event.details.transport?.lr_no || '',
                transportName: event.details.transport?.transporter_name || '',
                quantityExpected:
                  event.event_type === 'forward'
                    ? event.details.quantity_forwarded || 0
                    : event.details.quantity_dispatched || event.details.quantity_expected || 0,
                quantityReceived: 0,
                missing: 0,
                damagedOnArrival: 0,
                damageReason: '',
                receiverComment: '',
                status: voucher.voucher_status,
                senderId: event.details.sender_id,
                senderName: senderName,
                senderType: senderType,
              });
            }
          }
        }
        // Collect recent receive events for this user
        for (const event of voucher.events) {
          if (
            event.event_type === 'receive' &&
            event.details &&
            event.details.receiver_id === currentUser.uid
          ) {
            // Find the parent event (dispatch or forward)
            const parentEvent = voucher.events.find((e: VoucherEvent) => e.event_id === event.parent_event_id);
            const senderDoc = parentEvent && parentEvent.details && parentEvent.details.sender_id ? await getUserDoc(parentEvent.details.sender_id) : null;
            const senderName = senderDoc ? `${senderDoc.firstName || ''} ${senderDoc.surname || ''}`.trim() : 'Admin';
            const senderType = senderDoc && senderDoc.role !== 'admin' ? 'vendor' : 'admin';
            recentEvents.push({
              id: `${voucher.id}-${event.event_id}`,
              voucherNo: voucher.voucher_no,
              voucherDate: voucher.createdAt && voucher.createdAt.toDate ? voucher.createdAt.toDate().toLocaleString() : new Date(voucher.created_at).toLocaleString(),
              imageUrl: voucher.item_details.images?.[0],
              item: voucher.item_details.item_name,
              jobWork: parentEvent?.details?.jobWork || 'N/A',
              vendorCode: currentUser.userCode || 'N/A',
              lrDate: parentEvent?.details?.transport?.lr_date || '',
              lrNumber: parentEvent?.details?.transport?.lr_no || '',
              transportName: parentEvent?.details?.transport?.transporter_name || '',
              senderName,
              senderType,
              quantityExpected:
                parentEvent?.event_type === 'forward'
                  ? parentEvent?.details?.quantity_forwarded || 0
                  : parentEvent?.details?.quantity_dispatched || parentEvent?.details?.quantity_expected || 0,
              quantityReceived: event.details.quantity_received || 0,
              status: voucher.voucher_status,
              eventTimestamp: event.timestamp || voucher.created_at,
            });
          }
        }
      }
      setVouchers(itemsToReceive);
      setAlreadyReceivedVouchers(itemsAlreadyReceived);
      // Sort and set recent received events (top 5)
      console.log('recentEvents', recentEvents, 'currentUser', currentUser.uid);
      recentEvents.sort((a, b) => new Date(b.eventTimestamp).getTime() - new Date(a.eventTimestamp).getTime());
      setRecentReceivedEvents(recentEvents.slice(0, 5));
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const totals = filteredVouchers.reduce(
    (acc, item) => ({
      quantityExpected: acc.quantityExpected + (item.quantityExpected || 0),
      quantityReceived: acc.quantityReceived + (item.quantityReceived || 0),
      missing: acc.missing + (item.missing || 0),
      damagedOnArrival: acc.damagedOnArrival + (item.damagedOnArrival || 0),
    }),
    { quantityExpected: 0, quantityReceived: 0, missing: 0, damagedOnArrival: 0 }
  );

  const uniqueStatuses = Array.from(new Set(vouchers.map(v => v.status))).sort();
  const uniqueJobWorks = Array.from(new Set(vouchers.map(v => v.jobWork))).sort();

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim() || !text) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\\]/g, '\\$&')})`, 'gi');
    return text.split(regex).map((part, index) =>
      regex.test(part) ? <mark key={index} className="bg-yellow-200 px-1 rounded">{part}</mark> : part
    );
  };

  const clearSearch = () => setSearchTerm('');

  const applyFiltersAndSearch = () => {
    let filtered = [...vouchers];

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(v => {
        // Enhanced search across all relevant fields
        const searchMatch =
          // Basic voucher info
          v.voucherNo?.toLowerCase().includes(searchLower) ||
          v.voucherId?.toLowerCase().includes(searchLower) ||
          v.eventId?.toLowerCase().includes(searchLower) ||
          v.status?.toLowerCase().includes(searchLower) ||

          // Item and job details
          v.item?.toLowerCase().includes(searchLower) ||
          v.jobWork?.toLowerCase().includes(searchLower) ||
          v.vendorCode?.toLowerCase().includes(searchLower) ||

          // Transport details
          v.lrNumber?.toLowerCase().includes(searchLower) ||
          v.transportName?.toLowerCase().includes(searchLower) ||
          v.lrDate?.toLowerCase().includes(searchLower) ||

          // Quantity details
          v.quantityExpected?.toString().includes(searchLower) ||
          v.quantityReceived?.toString().includes(searchLower) ||
          v.missing?.toString().includes(searchLower) ||
          v.damagedOnArrival?.toString().includes(searchLower) ||

          // Comments and reasons
          v.damageReason?.toLowerCase().includes(searchLower) ||
          v.receiverComment?.toLowerCase().includes(searchLower) ||

          // Sender details
          v.senderName?.toLowerCase().includes(searchLower) ||
          v.senderId?.toLowerCase().includes(searchLower) ||
          v.senderType?.toLowerCase().includes(searchLower) ||

          // Date fields
          v.voucherDate?.toLowerCase().includes(searchLower) ||

          // Fallback to comprehensive search for any other fields
          Object.values(v).some(val => String(val).toLowerCase().includes(searchLower));

        return searchMatch;
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(v => v.status === statusFilter);
    }

    if (jobWorkFilter !== 'all') {
      filtered = filtered.filter(v => v.jobWork === jobWorkFilter);
    }

    filtered.sort((a, b) => {
      let aValue = a[sortField as keyof ReceiveItem] as any;
      let bValue = b[sortField as keyof ReceiveItem] as any;

      if (sortField === 'voucherDate' || sortField === 'lrDate') {
        aValue = new Date(aValue || '1900-01-01');
        bValue = new Date(bValue || '1900-01-01');
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue || '').toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    setFilteredVouchers(filtered);
  };

  useEffect(() => {
    fetchVouchersForUser();
  }, []);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [vouchers, searchTerm, sortField, sortDirection, statusFilter, jobWorkFilter]);

  const applyAlreadyReceivedFiltersAndSearch = () => {
    let filtered = [...alreadyReceivedVouchers];

    if (alreadyReceivedSearchTerm.trim()) {
      const searchLower = alreadyReceivedSearchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const searchMatch =
          item.voucherNo?.toLowerCase().includes(searchLower) ||
          item.voucherId?.toLowerCase().includes(searchLower) ||
          item.eventId?.toLowerCase().includes(searchLower) ||
          item.status?.toLowerCase().includes(searchLower) ||
          item.item?.toLowerCase().includes(searchLower) ||
          item.jobWork?.toLowerCase().includes(searchLower) ||
          item.vendorCode?.toLowerCase().includes(searchLower) ||
          item.lrNumber?.toLowerCase().includes(searchLower) ||
          item.transportName?.toLowerCase().includes(searchLower) ||
          item.lrDate?.toLowerCase().includes(searchLower) ||
          item.quantityExpected?.toString().includes(searchLower) ||
          item.quantityReceived?.toString().includes(searchLower) ||
          item.missing?.toString().includes(searchLower) ||
          item.damagedOnArrival?.toString().includes(searchLower) ||
          item.damageReason?.toLowerCase().includes(searchLower) ||
          item.receiverComment?.toLowerCase().includes(searchLower) ||
          item.senderName?.toLowerCase().includes(searchLower) ||
          item.senderId?.toLowerCase().includes(searchLower) ||
          item.senderType?.toLowerCase().includes(searchLower) ||
          item.voucherDate?.toLowerCase().includes(searchLower) ||
          Object.values(item).some(val => String(val).toLowerCase().includes(searchLower));

        return searchMatch;
      });
    }

    if (alreadyReceivedStatusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === alreadyReceivedStatusFilter);
    }

    if (alreadyReceivedJobWorkFilter !== 'all') {
      filtered = filtered.filter(item => item.jobWork === alreadyReceivedJobWorkFilter);
    }

    filtered.sort((a, b) => {
      let aValue = a[alreadyReceivedSortField as keyof ReceiveItem] as any;
      let bValue = b[alreadyReceivedSortField as keyof ReceiveItem] as any;

      if (alreadyReceivedSortField === 'voucherDate' || alreadyReceivedSortField === 'lrDate') {
        aValue = new Date(aValue || '1900-01-01');
        bValue = new Date(bValue || '1900-01-01');
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue || '').toLowerCase();
      }

      if (alreadyReceivedSortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    setFilteredAlreadyReceivedVouchers(filtered);
  };

  useEffect(() => {
    applyAlreadyReceivedFiltersAndSearch();
  }, [alreadyReceivedVouchers, alreadyReceivedSearchTerm, alreadyReceivedSortField, alreadyReceivedSortDirection, alreadyReceivedStatusFilter, alreadyReceivedJobWorkFilter]);

  const resetFilters = () => {
    setSearchTerm('');
    setSortField('voucherDate');
    setSortDirection('desc');
    setStatusFilter('all');
    setJobWorkFilter('all');
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAlreadyReceivedSort = (field: string) => {
    if (alreadyReceivedSortField === field) {
      setAlreadyReceivedSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setAlreadyReceivedSortField(field);
      setAlreadyReceivedSortDirection('asc');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSortMenu && sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSortMenu]);

  const handleEdit = (id: string) => {
    const item = vouchers.find(v => v.id === id) || alreadyReceivedVouchers.find(v => v.id === id);
    if (item) {
      setFormData(prev => ({
        ...prev,
        [id]: {
          missing: item.missing,
          damagedOnArrival: item.damagedOnArrival,
          damageReason: item.damageReason,
          receiverComment: item.receiverComment
        }
      }));
      setEditingVoucherId(id);
    }
  };

  const handleInputChange = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleSave = async (id: string) => {
    if (saving) return;

    const item = vouchers.find(v => v.id === id) || alreadyReceivedVouchers.find(v => v.id === id);
    if (!item) return;

    const currentFormData = formData[id];
    if (!currentFormData) return;

    setSaving(true);
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) throw new Error("User not authenticated");

      const isUpdate = alreadyReceivedVouchers.some(v => v.id === id);

      const missing = Number(currentFormData.missing) || 0;
      const receivedQty = item.quantityExpected - missing;

      await runTransaction(db, async (transaction) => {
        const voucherRef = doc(db, "vouchers", item.voucherId);
        const voucherSnap = await transaction.get(voucherRef);
        if (!voucherSnap.exists()) throw new Error("Voucher not found");

        const voucher = voucherSnap.data() as Voucher;

        if (isUpdate) {
          const eventIndex = voucher.events.findIndex((e: VoucherEvent) => e.event_id === item.eventId);
          if (eventIndex === -1) throw new Error("Receive event to update not found");

          const updatedEvents = [...voucher.events];
          const eventToUpdate = updatedEvents[eventIndex];

          eventToUpdate.comment = currentFormData.receiverComment;
          eventToUpdate.details.quantity_received = receivedQty;
          if (eventToUpdate.details.discrepancies) {
            eventToUpdate.details.discrepancies.missing = missing;
            eventToUpdate.details.discrepancies.damaged_on_arrival = Number(currentFormData.damagedOnArrival);
            eventToUpdate.details.discrepancies.damage_reason = currentFormData.damageReason;
          }
          eventToUpdate.timestamp = new Date().toISOString();

          transaction.update(voucherRef, { events: updatedEvents, updatedAt: serverTimestamp() });
        } else {
          const newEvent: VoucherEvent = {
            event_id: generateEventId(voucher.voucher_no, voucher.events.length + 1),
            parent_event_id: item.eventId,
            event_type: 'receive',
            timestamp: new Date().toISOString(),
            user_id: currentUser.uid,
            comment: currentFormData.receiverComment,
            details: {
              sender_id: item.senderId,
              receiver_id: currentUser.uid,
              quantity_received: receivedQty,
              discrepancies: {
                missing: missing,
                damaged_on_arrival: Number(currentFormData.damagedOnArrival),
                damage_reason: currentFormData.damageReason,
              }
            }
          };

          const updatedEvents = [...voucher.events, newEvent];

          // Use new status management system
          const newStatus = determineNewStatus(voucher, 'receive', newEvent);

          // Create updated voucher data with new events for proper totals calculation
          const updatedVoucherData = {
            ...voucher,
            events: updatedEvents
          };
          const statusUpdate = updateVoucherStatus(updatedVoucherData, newStatus);

          transaction.update(voucherRef, {
            events: updatedEvents,
            ...statusUpdate,
            updatedAt: serverTimestamp()
          });
        }
      });

      alert('Voucher saved successfully!');
      setEditingVoucherId(null);
      // Refresh data to show changes
      fetchVouchersForUser(); // Re-fetch all data to ensure consistency

    } catch (error) {
      console.error('Error saving voucher:', error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (id: string) => {
    setEditingVoucherId(null);
    setFormData(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-blue-100 p-0">
      <div className="p-4 bg-blue-600 text-white rounded-t-lg mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <FileText className="h-6 w-6 mr-2" />
          <h1 className="text-2xl font-bold">VOUCHERS TO BE RECEIVED</h1>
        </div>

        {/* View Toggle Buttons */}
        <div className="flex items-center rounded-lg p-1 bg-white bg-opacity-20">
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${viewMode === 'table'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-white hover:bg-white hover:bg-opacity-20'
              }`}
          >
            <List className="h-4 w-4 mr-1" />
            Table View
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${viewMode === 'card'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-white hover:bg-white hover:bg-opacity-20'
              }`}
          >
            <Grid3X3 className="h-4 w-4 mr-1" />
            Card View
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-blue-600">Loading vouchers...</p>
        </div>
      ) : (
        <>
          {/* VOUCHERS TO BE RECEIVED Section */}
          {viewMode === 'card' ? (
            // Card View for To Be Received
            <ReceiveReportCardGrid
              items={vouchers}
              onEdit={handleEdit}
              onSave={handleSave}
              onCancel={handleCancel}
              onInputChange={handleInputChange}
              editingVoucherId={editingVoucherId}
              formData={formData}
              saving={saving}
              searchTerm={searchTerm}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              onSearchChange={setSearchTerm}
              onClearSearch={clearSearch}
              showFilters={showFilters}
              onToggleFilters={() => setShowFilters(!showFilters)}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              jobWorkFilter={jobWorkFilter}
              onJobWorkFilterChange={setJobWorkFilter}
              uniqueStatuses={uniqueStatuses}
              uniqueJobWorks={uniqueJobWorks}
            />
          ) : (
            // Table View for To Be Received
            <div className="space-y-0">
              <div className="bg-gray-50 p-4 border border-gray-200">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex-1 min-w-64 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                    {searchTerm && (
                      <button onClick={clearSearch} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative" ref={sortMenuRef}>
                      <button onClick={() => setShowSortMenu(!showSortMenu)} className="flex items-center px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                        <ArrowUpDown className="h-4 w-4 mr-2" /> Sort
                      </button>
                      {showSortMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border z-20 p-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                          <select value={sortField} onChange={(e) => setSortField(e.target.value)} className="w-full p-2 border rounded-md">
                            <option value="voucherDate">Voucher Date</option>
                            <option value="voucherNo">Voucher No</option>
                            <option value="item">Item</option>
                          </select>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => setSortDirection('asc')} className={`flex-1 p-2 rounded-md ${sortDirection === 'asc' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                              <SortAsc className="h-4 w-4 mx-auto" />
                            </button>
                            <button onClick={() => setSortDirection('desc')} className={`flex-1 p-2 rounded-md ${sortDirection === 'desc' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                              <SortDesc className="h-4 w-4 mx-auto" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setShowFilters(!showFilters)} className="flex items-center px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                      <Filter className="h-4 w-4 mr-2" /> Filters
                    </button>
                    <button onClick={resetFilters} className="flex items-center px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                      <RotateCcw className="h-4 w-4 mr-2" /> Reset
                    </button>
                  </div>
                </div>
                {showFilters && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-2 border rounded-md">
                      <option value="all">All Statuses</option>
                      {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={jobWorkFilter} onChange={(e) => setJobWorkFilter(e.target.value)} className="p-2 border rounded-md">
                      <option value="all">All Job Works</option>
                      {uniqueJobWorks.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                  </div>
                )}
                <div className="mt-4 text-sm text-gray-600">
                  Showing {filteredVouchers.length} of {vouchers.length} vouchers.
                </div>
              </div>

              {/* Main tables (pending/received) */}
              {/* To Be Received Table */}
              <div className="relative border border-blue-200 overflow-auto max-h-[70vh] pl-0">
                <table className="min-w-full bg-white">
                  <thead className="bg-blue-50 sticky top-0 z-10">
                    <tr>
                      {["SN", "Photo", "Voucher No", "Voucher Dt", "Item", "Job Work", "Vendor Code", "LR Date", "LR No", "Transport", "Sender", "Expected Qty", "Missing", "Damaged", "Net Received Qty", "Damage Reason", "Comment", "Action"].map(header => (
                        <th key={header} className="border border-blue-200 p-2 text-blue-700 bg-blue-50">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={19} className="text-center text-gray-500 py-4">
                          No vouchers to receive.
                        </td>
                      </tr>
                    ) : (
                      filteredVouchers.map((item, index) => {
                        const isEditing = editingVoucherId === item.id;
                        const currentData = formData[item.id] || {};
                        const missingQty = isEditing ? (Number(currentData.missing) || 0) : item.missing;
                        const receivedQty = item.quantityExpected - missingQty;
                        const damagedQty = isEditing ? (Number(currentData.damagedOnArrival) || 0) : item.damagedOnArrival;
                        const netQty = receivedQty - damagedQty;
                        return (
                          <tr
                            key={item.id}
                            className={`${isEditing ? 'bg-yellow-50' : (index % 2 === 0 ? 'bg-white' : 'bg-blue-50')} relative`}
                          >
                            <td className="border p-2 relative">
                              {index + 1}
                            </td>
                            <td className="border p-2">{item.imageUrl ? <ImageContainer images={[item.imageUrl]} size="sm" /> : <FileText />}</td>
                            <td className="border p-2">{highlightSearchTerm(item.voucherNo, searchTerm)}</td>
                            <td className="border p-2">{item.voucherDate ? new Date(item.voucherDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            }) : 'N/A'}</td>
                            <td className="border p-2">{highlightSearchTerm(item.item, searchTerm)}</td>
                            <td className="border p-2">{highlightSearchTerm(item.jobWork, searchTerm)}</td>
                            <td className="border p-2">{item.vendorCode}</td>
                            <td className="border p-2">{item.lrDate ? new Date(item.lrDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            }) : 'N/A'}</td>
                            <td className="border p-2">{item.lrNumber || 'N/A'}</td>
                            <td className="border p-2">{item.transportName || 'N/A'}</td>
                            <td className="border p-2">{`${item.senderName} (${item.senderType})`}</td>
                            <td className="border p-2">{item.quantityExpected}</td>
                            <td className={`border p-2 ${missingQty > 0 ? 'text-red-600 font-bold' : ''}`}>
                              {isEditing ? (
                                <input type="number" min="0" max={item.quantityExpected} value={currentData.missing ?? item.missing ?? 0} onChange={e => handleInputChange(item.id, 'missing', e.target.value)} className="w-20 p-1 border rounded" />
                              ) : (
                                missingQty
                              )}
                            </td>
                            <td className="border p-2">
                              {isEditing ? (
                                <input type="number" value={currentData.damagedOnArrival} onChange={e => handleInputChange(item.id, 'damagedOnArrival', e.target.value)} className="w-20 p-1 border rounded" />
                              ) : (
                                damagedQty
                              )}
                            </td>
                            <td className="border p-2 font-semibold">{netQty}</td>
                            <td className="border p-2">
                              {isEditing ? (
                                <textarea value={currentData.damageReason} onChange={e => handleInputChange(item.id, 'damageReason', e.target.value)} className="w-full p-1 border rounded" />
                              ) : (
                                item.damageReason
                              )}
                            </td>
                            <td className="border p-2">
                              {isEditing ? (
                                <textarea value={currentData.receiverComment} onChange={e => handleInputChange(item.id, 'receiverComment', e.target.value)} className="w-full p-1 border rounded" />
                              ) : (
                                item.receiverComment
                              )}
                            </td>
                            <td className="border p-2">
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <button onClick={() => handleSave(item.id)} disabled={saving} className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 disabled:bg-gray-400">
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleCancel(item.id)} className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => handleEdit(item.id)} className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">
                                  Receive
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    <tr className="bg-blue-50 font-bold">
                      <td colSpan={11} className="border p-2 text-right">TOTAL</td>
                      <td className="border p-2">{totals.quantityExpected}</td>
                      <td className={`border p-2 ${totals.quantityExpected - totals.quantityReceived > 0 ? 'text-red-600 font-bold' : ''}`}>{totals.quantityExpected - totals.quantityReceived}</td>
                      <td className="border p-2">{totals.damagedOnArrival}</td>
                      <td className="border p-2 font-semibold">{totals.quantityReceived - totals.damagedOnArrival}</td>
                      <td colSpan={3} className="border p-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ALREADY RECEIVED Section - Independent of To Be Received view mode */}
          {alreadyReceivedVouchers.length > 0 && (
            <div className="mt-12"> {/* Increased spacing */}
              <div className="p-4 bg-green-600 text-white rounded-t-lg mb-4 flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="h-6 w-6 mr-2" />
                  <h1 className="text-2xl font-bold">ALREADY RECEIVED REPORTS</h1>
                </div>

                {/* View Toggle Buttons for Already Received */}
                <div className="flex items-center rounded-lg p-1 bg-white bg-opacity-20">
                  <button
                    onClick={() => setAlreadyReceivedViewMode('table')}
                    className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${alreadyReceivedViewMode === 'table'
                        ? 'bg-white text-green-700 shadow-sm'
                        : 'text-white hover:bg-white hover:bg-opacity-20'
                      }`}
                  >
                    <List className="h-4 w-4 mr-1" />
                    Table View
                  </button>
                  <button
                    onClick={() => setAlreadyReceivedViewMode('card')}
                    className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${alreadyReceivedViewMode === 'card'
                        ? 'bg-white text-green-700 shadow-sm'
                        : 'text-white hover:bg-white hover:bg-opacity-20'
                      }`}
                  >
                    <Grid3X3 className="h-4 w-4 mr-1" />
                    Card View
                  </button>
                </div>
              </div>

              {alreadyReceivedViewMode === 'card' ? (
                // Card View for Already Received
                <AlreadyReceivedCardGrid
                  items={alreadyReceivedVouchers}
                  onEdit={handleEdit}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  onInputChange={handleInputChange}
                  editingVoucherId={editingVoucherId}
                  formData={formData}
                  saving={saving}
                  searchTerm={alreadyReceivedSearchTerm}
                  sortField={alreadyReceivedSortField}
                  sortDirection={alreadyReceivedSortDirection}
                  onSort={handleAlreadyReceivedSort}
                  onSearchChange={setAlreadyReceivedSearchTerm}
                  onClearSearch={() => setAlreadyReceivedSearchTerm('')}
                  showFilters={alreadyReceivedShowFilters}
                  onToggleFilters={() => setAlreadyReceivedShowFilters(!alreadyReceivedShowFilters)}
                  statusFilter={alreadyReceivedStatusFilter}
                  onStatusFilterChange={setAlreadyReceivedStatusFilter}
                  jobWorkFilter={alreadyReceivedJobWorkFilter}
                  onJobWorkFilterChange={setAlreadyReceivedJobWorkFilter}
                  uniqueStatuses={uniqueStatuses}
                  uniqueJobWorks={uniqueJobWorks}
                />
              ) : (
                // Table View for Already Received
                <div className="space-y-4">
                  {/* Search and Filter Controls for Already Received */}
                  <div className="bg-green-50 p-4 border border-green-200 rounded-lg">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                      <div className="flex-1 min-w-64 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                          type="text"
                          placeholder="Search already received vouchers..."
                          value={alreadyReceivedSearchTerm}
                          onChange={(e) => setAlreadyReceivedSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                        />
                        {alreadyReceivedSearchTerm && (
                          <button onClick={() => setAlreadyReceivedSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="relative" ref={sortMenuRef}>
                          <button onClick={() => setShowSortMenu(!showSortMenu)} className="flex items-center px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                            <ArrowUpDown className="h-4 w-4 mr-2" /> Sort
                          </button>
                          {showSortMenu && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border z-20 p-3">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                              <select value={alreadyReceivedSortField} onChange={(e) => handleAlreadyReceivedSort(e.target.value)} className="w-full p-2 border rounded-md">
                                <option value="voucherDate">Voucher Date</option>
                                <option value="voucherNo">Voucher No</option>
                                <option value="item">Item</option>
                                <option value="jobWork">Job Work</option>
                                <option value="vendorCode">Vendor Code</option>
                                <option value="lrDate">LR Date</option>
                                <option value="lrNumber">LR Number</option>
                                <option value="transportName">Transport</option>
                                <option value="senderName">Sender</option>
                                <option value="quantityExpected">Expected Qty</option>
                                <option value="missing">Missing</option>
                                <option value="damagedOnArrival">Damaged</option>
                                <option value="status">Status</option>
                              </select>
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => handleAlreadyReceivedSort(alreadyReceivedSortField)} className={`flex-1 p-2 rounded-md ${alreadyReceivedSortDirection === 'asc' ? 'bg-green-500 text-white' : 'bg-gray-100'}`}>
                                  <SortAsc className="h-4 w-4 mx-auto" />
                                </button>
                                <button onClick={() => handleAlreadyReceivedSort(alreadyReceivedSortField)} className={`flex-1 p-2 rounded-md ${alreadyReceivedSortDirection === 'desc' ? 'bg-green-500 text-white' : 'bg-gray-100'}`}>
                                  <SortDesc className="h-4 w-4 mx-auto" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <button onClick={() => setAlreadyReceivedShowFilters(!alreadyReceivedShowFilters)} className="flex items-center px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                          <Filter className="h-4 w-4 mr-2" /> Filters
                        </button>
                        <button onClick={() => {
                          setAlreadyReceivedSearchTerm('');
                          setAlreadyReceivedStatusFilter('all');
                          setAlreadyReceivedJobWorkFilter('all');
                          setAlreadyReceivedSortField('voucherDate');
                          setAlreadyReceivedSortDirection('desc');
                        }} className="flex items-center px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                          <RotateCcw className="h-4 w-4 mr-2" /> Reset
                        </button>
                      </div>
                    </div>

                    {/* Filter Panel for Already Received */}
                    {alreadyReceivedShowFilters && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select value={alreadyReceivedStatusFilter} onChange={(e) => setAlreadyReceivedStatusFilter(e.target.value)} className="p-2 border rounded-md">
                          <option value="all">All Statuses</option>
                          {Array.from(new Set(alreadyReceivedVouchers.map(v => v.status))).sort().map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={alreadyReceivedJobWorkFilter} onChange={(e) => setAlreadyReceivedJobWorkFilter(e.target.value)} className="p-2 border rounded-md">
                          <option value="all">All Job Works</option>
                          {Array.from(new Set(alreadyReceivedVouchers.map(v => v.jobWork))).sort().map(j => <option key={j} value={j}>{j}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="mt-4 text-sm text-gray-600">
                      Showing {filteredAlreadyReceivedVouchers.length} of {alreadyReceivedVouchers.length} already received vouchers.
                    </div>
                  </div>

                  <div className="relative border border-green-200 rounded-lg overflow-auto max-h-[70vh] pl-8">
                    <table className="min-w-full bg-white">
                      <thead className="bg-green-50 sticky top-0 z-10">
                        <tr>
                          <th className="border border-green-200 p-2 text-green-700 bg-green-50">SN</th>
                          <th className="border border-green-200 p-2 text-green-700 bg-green-50">Photo</th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('voucherNo')}
                          >
                            <div className="flex items-center justify-between">
                              Voucher No
                              {alreadyReceivedSortField === 'voucherNo' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('voucherDate')}
                          >
                            <div className="flex items-center justify-between">
                              Voucher Dt
                              {alreadyReceivedSortField === 'voucherDate' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('item')}
                          >
                            <div className="flex items-center justify-between">
                              Item
                              {alreadyReceivedSortField === 'item' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('jobWork')}
                          >
                            <div className="flex items-center justify-between">
                              Job Work
                              {alreadyReceivedSortField === 'jobWork' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('vendorCode')}
                          >
                            <div className="flex items-center justify-between">
                              Vendor Code
                              {alreadyReceivedSortField === 'vendorCode' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('lrDate')}
                          >
                            <div className="flex items-center justify-between">
                              LR Date
                              {alreadyReceivedSortField === 'lrDate' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('lrNumber')}
                          >
                            <div className="flex items-center justify-between">
                              LR No
                              {alreadyReceivedSortField === 'lrNumber' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('transportName')}
                          >
                            <div className="flex items-center justify-between">
                              Transport
                              {alreadyReceivedSortField === 'transportName' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('senderName')}
                          >
                            <div className="flex items-center justify-between">
                              Sender
                              {alreadyReceivedSortField === 'senderName' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('quantityExpected')}
                          >
                            <div className="flex items-center justify-between">
                              Expected Qty
                              {alreadyReceivedSortField === 'quantityExpected' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('missing')}
                          >
                            <div className="flex items-center justify-between">
                              Missing
                              {alreadyReceivedSortField === 'missing' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th
                            className="border border-green-200 p-2 text-green-700 bg-green-50 cursor-pointer hover:bg-green-100"
                            onClick={() => handleAlreadyReceivedSort('damagedOnArrival')}
                          >
                            <div className="flex items-center justify-between">
                              Damaged
                              {alreadyReceivedSortField === 'damagedOnArrival' && (
                                alreadyReceivedSortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                              )}
                            </div>
                          </th>
                          <th className="border border-green-200 p-2 text-green-700 bg-green-50">Net Received Qty</th>
                          <th className="border border-green-200 p-2 text-green-700 bg-green-50">Damage Reason</th>
                          <th className="border border-green-200 p-2 text-green-700 bg-green-50">Comment</th>
                          <th className="border border-green-200 p-2 text-green-700 bg-green-50">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAlreadyReceivedVouchers.map((item, index) => {
                          const isEditing = editingVoucherId === item.id;
                          const currentData = formData[item.id] || {};
                          const missingQty = isEditing ? (Number(currentData.missing) || 0) : item.missing;
                          const receivedQty = item.quantityExpected - missingQty;
                          const damagedQty = isEditing ? (Number(currentData.damagedOnArrival) || 0) : item.damagedOnArrival;
                          const netQty = receivedQty - damagedQty;
                          return (
                            <tr
                              key={item.id}
                              className={`${isEditing ? 'bg-yellow-50' : (index % 2 === 0 ? 'bg-white' : 'bg-green-50')} relative`}
                            >
                              <td className="border p-2 relative">
                                {index + 1}
                              </td>
                              <td className="border p-2">{item.imageUrl ? <ImageContainer images={[item.imageUrl]} size="sm" /> : <FileText />}</td>
                              <td className="border p-2">{item.voucherNo}</td>
                              <td className="border p-2">{item.voucherDate ? new Date(item.voucherDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              }) : 'N/A'}</td>
                              <td className="border p-2">{item.item}</td>
                              <td className="border p-2">{item.jobWork}</td>
                              <td className="border p-2">{item.vendorCode}</td>
                              <td className="border p-2">{item.lrDate ? new Date(item.lrDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              }) : 'N/A'}</td>
                              <td className="border p-2">{item.lrNumber || 'N/A'}</td>
                              <td className="border p-2">{item.transportName || 'N/A'}</td>
                              <td className="border p-2">{`${item.senderName} (${item.senderType})`}</td>
                              <td className="border p-2">{item.quantityExpected}</td>
                              <td className={`border p-2 ${missingQty > 0 ? 'text-red-600 font-bold' : ''}`}>
                                {isEditing ? (
                                  <input type="number" min="0" max={item.quantityExpected} value={currentData.missing ?? item.missing ?? 0} onChange={e => handleInputChange(item.id, 'missing', e.target.value)} className="w-20 p-1 border rounded" />
                                ) : (
                                  missingQty
                                )}
                              </td>
                              <td className="border p-2">
                                {isEditing ? (
                                  <input type="number" value={currentData.damagedOnArrival} onChange={e => handleInputChange(item.id, 'damagedOnArrival', e.target.value)} className="w-20 p-1 border rounded" />
                                ) : (
                                  damagedQty
                                )}
                              </td>
                              <td className="border p-2 font-semibold">{netQty}</td>
                              <td className="border p-2">
                                {isEditing ? (
                                  <textarea value={currentData.damageReason} onChange={e => handleInputChange(item.id, 'damageReason', e.target.value)} className="w-full p-1 border rounded" />
                                ) : (
                                  item.damageReason
                                )}
                              </td>
                              <td className="border p-2">
                                {isEditing ? (
                                  <textarea value={currentData.receiverComment} onChange={e => handleInputChange(item.id, 'receiverComment', e.target.value)} className="w-full p-1 border rounded" />
                                ) : (
                                  item.receiverComment
                                )}
                              </td>
                              <td className="border p-2">
                                {isEditing ? (
                                  <div className="flex gap-2">
                                    <button onClick={() => handleSave(item.id)} disabled={saving} className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 disabled:bg-gray-400">
                                      <Save className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleCancel(item.id)} className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleEdit(item.id)}
                                    disabled={item.isForwarded}
                                    className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    title={item.isForwarded ? "Cannot edit: this voucher has been forwarded." : "Edit Received Voucher"}
                                  >
                                    Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
