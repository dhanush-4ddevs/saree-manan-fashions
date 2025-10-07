'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { FileText, User, Briefcase, Phone, Upload, Package, Building, RefreshCw, AlertTriangle, Truck, Calendar, Plus, Trash2, Printer, X, Eye, ZoomIn, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { getCurrentUser } from '../../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { notificationService } from '../../utils/notificationService';
import { determineNewStatus, updateVoucherStatus } from '../../utils/voucherStatusManager';
import { useJobWorks } from '@/hooks/useJobWorks';

export default function ForwardReport() {
  // State for vendor info
  const [vendor, setVendor] = useState<any>(null);
  // State for selected voucher
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  // State for images
  const [images, setImages] = useState<File[]>([]);
  // State for vouchers fetched from Firestore
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(true);
  // State for recently forwarded vouchers
  const [recentlyForwardedVouchers, setRecentlyForwardedVouchers] = useState<any[]>([]);
  const [loadingRecentlyForwarded, setLoadingRecentlyForwarded] = useState(true);
  // State for user names mapping
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // State for search, sort, and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobWorkFilter, setJobWorkFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Use the job works hook
  const { jobWorkNames, loading: jobWorksLoading, error: jobWorksError } = useJobWorks();

  console.log('ForwardReport component loaded');
  console.log('Current state - vendor:', vendor, 'vouchers count:', vouchers.length, 'loading:', loadingVouchers);

  // Helper function to fetch user display name from Firestore
  const fetchUserName = async (uid: string) => {
    if (!uid) return 'N/A';
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        let name = (data.firstName || '') + (data.surname ? ' ' + data.surname : '');
        name = name.trim();
        if (data.companyName) {
          return name ? `${name} (${data.companyName})` : data.companyName;
        } else {
          return name || uid;
        }
      }
    } catch (error) {
      console.error('Error fetching user name for ID:', uid, error);
    }
    return uid;
  };

  // Function to fetch user names for recently forwarded vouchers
  const fetchUserNamesForVouchers = async (vouchers: any[]) => {
    const userIds = new Set<string>();

    // Collect all receiver IDs from forward events
    vouchers.forEach(voucher => {
      const events = voucher.events || [];
      events.forEach((event: any) => {
        if (event.event_type === 'forward' && event.details?.receiver_id) {
          userIds.add(event.details.receiver_id);
        }
      });
    });

    // Fetch names for missing user IDs
    const missingIds = Array.from(userIds).filter(uid => !userNames[uid]);
    if (missingIds.length === 0) return;

    const nameUpdates: Record<string, string> = {};
    await Promise.all(
      missingIds.map(async (uid) => {
        const name = await fetchUserName(uid);
        nameUpdates[uid] = name;
      })
    );

    setUserNames(prev => ({ ...prev, ...nameUpdates }));
  };

  useEffect(() => {
    console.log('ForwardReport useEffect triggered');
    getCurrentUser().then(setVendor);
    // Fetch vouchers from Firestore
    const fetchVouchers = async () => {
      console.log('Fetching vouchers...');
      setLoadingVouchers(true);
      try {
        const vouchersCollection = collection(db, 'vouchers');
        const vouchersQuery = query(vouchersCollection);
        const snapshot = await getDocs(vouchersQuery);
        const fetched = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        console.log('Fetched vouchers:', fetched.length, 'vouchers');
        console.log('Raw voucher data:', fetched);
        console.log('Voucher statuses:', fetched.map((v: any) => ({
          id: v.id,
          voucher_no: v.voucher_no,
          status: v.voucher_status,
          events: v.events?.length || 0,
          events_detail: v.events?.map((e: any) => ({
            type: e.event_type,
            user_id: e.user_id,
            receiver_id: e.details?.receiver_id
          })) || []
        })));
        setVouchers(fetched);
      } catch (err) {
        console.error('Error fetching vouchers:', err);
        setVouchers([]);
      } finally {
        setLoadingVouchers(false);
      }
    };

    fetchVouchers();
  }, []);

  // Separate useEffect for recently forwarded vouchers - only run when vendor is available
  useEffect(() => {
    if (!vendor?.uid) {
      return;
    }

    const fetchRecentlyForwardedVouchers = async () => {
      setLoadingRecentlyForwarded(true);
      try {
        const vouchersCollection = collection(db, 'vouchers');
        const vouchersQuery = query(vouchersCollection);
        const snapshot = await getDocs(vouchersQuery);
        const allVouchers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

        // Filter vouchers that have been forwarded by the current vendor
        const forwardedVouchers = allVouchers.filter(voucher => {
          const events = (voucher as any).events || [];
          const vendorId = vendor.uid;

          // Check if this voucher has a forward event by the current vendor
          return events.some((event: any) => {
            if (!event || typeof event !== 'object') return false;
            const type = event.event_type;
            const details = event.details || {};
            const sender = event.user_id || details.sender_id;
            return type === 'forward' && sender === vendorId;
          });
        });

        // Sort by most recent forward event (get all, not just last 5)
        const sortedVouchers = forwardedVouchers.sort((a, b) => {
          const aEvents = (a as any).events || [];
          const bEvents = (b as any).events || [];

          const aForwardEvents = aEvents.filter((e: any) =>
            e.event_type === 'forward' &&
            (e.user_id === vendor.uid || e.details?.sender_id === vendor.uid)
          );
          const bForwardEvents = bEvents.filter((e: any) =>
            e.event_type === 'forward' &&
            (e.user_id === vendor.uid || e.details?.sender_id === vendor.uid)
          );

          const aLatestForward = aForwardEvents.length > 0 ?
            Math.max(...aForwardEvents.map((e: any) => toEpochMs(e.timestamp))) : 0;
          const bLatestForward = bForwardEvents.length > 0 ?
            Math.max(...bForwardEvents.map((e: any) => toEpochMs(e.timestamp))) : 0;

          return bLatestForward - aLatestForward; // Most recent first
        }); // Get all forwarded vouchers

        setRecentlyForwardedVouchers(sortedVouchers);

        // Fetch user names for the vouchers
        await fetchUserNamesForVouchers(sortedVouchers);
      } catch (err) {
        console.error('Error fetching recently forwarded vouchers:', err);
        setRecentlyForwardedVouchers([]);
      } finally {
        setLoadingRecentlyForwarded(false);
      }
    };

    fetchRecentlyForwardedVouchers();
  }, [vendor?.uid]);

  // useEffect to fetch user names when recently forwarded vouchers change
  useEffect(() => {
    if (recentlyForwardedVouchers.length > 0) {
      fetchUserNamesForVouchers(recentlyForwardedVouchers);
    }
  }, [recentlyForwardedVouchers]);

  // useEffect to ensure user names are fetched when search is active
  useEffect(() => {
    if (searchTerm && recentlyForwardedVouchers.length > 0) {
      fetchUserNamesForVouchers(recentlyForwardedVouchers);
    }
  }, [searchTerm, recentlyForwardedVouchers]);

  // Helper function to calculate forwardable quantity for a voucher
  const calculateForwardableQuantity = (voucher: any, vendorId: string) => {
    if (!voucher || !vendorId) return 0;

    const events = voucher.events || [];

    console.log('Calculating forwardable quantity for voucher:', voucher.voucher_no, 'Vendor ID:', vendorId);

    // Find last receive event for this vendor
    const lastReceive = [...events].reverse().find((e: any) =>
      e.event_type === 'receive' && (e.user_id === vendorId || e.details?.receiver_id === vendorId)
    );

    console.log('Last receive event:', lastReceive);

    if (!lastReceive) {
      console.log('No receive event found for vendor');
      return 0;
    }

    const arrivalQty = lastReceive.details?.quantity_received || 0;
    const damagedOnArrival = lastReceive.details?.discrepancies?.damaged_on_arrival || 0;

    console.log('Arrival quantity:', arrivalQty, 'Damaged on arrival:', damagedOnArrival);

    // Calculate total forwarded and damaged after job from previous forward events
    const forwardEvents = events.filter((e: any) =>
      e.event_type === 'forward' && (e.user_id === vendorId || e.details?.sender_id === vendorId)
    );

    console.log('Forward events for this vendor:', forwardEvents);

    let sumForwarded = 0;
    forwardEvents.forEach((e: any) => {
      const qty = e.details?.quantity_forwarded || 0;
      const damaged = e.details?.discrepancies?.damaged_after_job || 0;
      sumForwarded += qty + damaged;
      console.log('Forward event:', e.event_id, 'Qty forwarded:', qty, 'Damaged after job:', damaged);
    });

    console.log('Total forwarded + damaged:', sumForwarded);

    // Calculate forwardable quantity
    const forwardableQty = arrivalQty - damagedOnArrival - sumForwarded;
    console.log('Final forwardable quantity:', forwardableQty, '= (', arrivalQty, '-', damagedOnArrival, '-', sumForwarded, ')');
    return Math.max(0, forwardableQty);
  };

  // Only allow vouchers with status 'Received' or 'Forwarded' to be selectable
  // AND vouchers that have been received by the current vendor
  // AND vouchers that have forwardable quantity > 0
  //
  // IMPORTANT: This filtering ensures that vendors can only forward vouchers that have been
  // received by them and have remaining quantity to forward. A voucher must have a 'receive' event in its events array where:
  // - event_type === 'receive'
  // - user_id === current vendor's ID OR details.receiver_id === current vendor's ID
  //
  // This prevents vendors from seeing vouchers that haven't been delivered to them yet or have no quantity left to forward.

  console.log('Calculating selectableVouchers...');
  console.log('Total vouchers:', vouchers.length);
  console.log('Vendor:', vendor);

  let statusFiltered = 0;
  let receivedFiltered = 0;
  let quantityFiltered = 0;

  const selectableVouchers = vouchers.filter(v => {
    // Check if voucher status allows forwarding - handle both lowercase and capitalized
    const statusAllowed = [
      'Received', 'received',
      'Forwarded', 'forwarded'
    ].includes(v.voucher_status);

    if (!statusAllowed || !vendor) {
      console.log(`Voucher ${v.voucher_no}: Status not allowed (${v.voucher_status}) or no vendor`);
      return false;
    }
    statusFiltered++;

    // Check if this vendor has received the voucher
    const events = v.events || [];
    const vendorId = vendor.uid;

    // Debug logging
    console.log('Checking voucher:', v.voucher_no, 'Status:', v.voucher_status, 'Vendor ID:', vendorId);
    console.log('Voucher events:', events);

    // Look for a 'receive' event where this vendor is the receiver
    const hasReceived = events.some((event: any) => {
      // Ensure event has required properties
      if (!event || typeof event !== 'object') return false;

      const isReceiveEvent = event.event_type === 'receive';
      const isUserMatch = event.user_id === vendorId;
      const isReceiverMatch = event.details?.receiver_id === vendorId;

      console.log('Event check:', {
        event_type: event.event_type,
        user_id: event.user_id,
        receiver_id: event.details?.receiver_id,
        isReceiveEvent,
        isUserMatch,
        isReceiverMatch,
        vendorId
      });

      return isReceiveEvent && (isUserMatch || isReceiverMatch);
    });

    console.log('Has received:', hasReceived);

    if (!hasReceived) {
      console.log(`Voucher ${v.voucher_no}: No receive event found for vendor ${vendorId}`);
      return false;
    }
    receivedFiltered++;

    // Check if there's forwardable quantity > 0
    const forwardableQty = calculateForwardableQuantity(v, vendorId);
    console.log('Forwardable quantity:', forwardableQty);

    if (forwardableQty <= 0) {
      console.log(`Voucher ${v.voucher_no}: No forwardable quantity (${forwardableQty})`);
      return false;
    }
    quantityFiltered++;

    console.log(`Voucher ${v.voucher_no}: PASSED ALL FILTERS - Status: ${v.voucher_status}, Has received: ${hasReceived}, Forwardable: ${forwardableQty}`);
    return true;
  });

  console.log(`Filtering results: ${statusFiltered} passed status, ${receivedFiltered} passed receive check, ${quantityFiltered} passed quantity check`);

  // Handle voucher selection
  const handleVoucherChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = vouchers.find(v => v.id === e.target.value);
    setSelectedVoucher(v || null);
  };

  // Handle image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    // Only allow up to 3 images
    setImages(prev => {
      const newFiles = [...prev, ...files].slice(0, 3);
      return newFiles;
    });
    // Reset input value so same file can be re-uploaded if deleted
    e.target.value = '';
  };

  // Remove image
  const handleRemoveImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  // Format date
  const toJsDate = (value: any): Date | null => {
    if (!value) return null;
    try {
      if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
      if (typeof value === 'string') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      }
      if (typeof value === 'number') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      }
      if (value && typeof value === 'object' && typeof value.toDate === 'function') {
        const d = value.toDate();
        return isNaN(d.getTime()) ? null : d;
      }
      if (value && typeof value === 'object' && typeof value.seconds === 'number') {
        const ms = value.seconds * 1000 + (typeof value.nanoseconds === 'number' ? Math.floor(value.nanoseconds / 1e6) : 0);
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
      }
    } catch (_) {
      return null;
    }
    return null;
  };

  const toEpochMs = (value: any): number => {
    const d = toJsDate(value);
    return d ? d.getTime() : 0;
  };

  const formatDate = (iso: string | any) => {
    if (!iso) return '';

    try {
      const d = toJsDate(iso);
      if (!d) return 'Invalid date';

      // Format with explicit options for Indian locale and timezone
      return d.toLocaleString('en-IN', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'Input:', iso);
      return 'Date error';
    }
  };

  // State for job details
  const [jobWork, setJobWork] = useState('');
  const [receivedQty, setReceivedQty] = useState(0);
  const [damageOnArrival, setDamageOnArrival] = useState(0);
  const [damageAfterJob, setDamageAfterJob] = useState(0);
  const [alreadyForwarded, setAlreadyForwarded] = useState(0);
  const [forwardable, setForwardable] = useState(0);
  const [qtyToForward, setQtyToForward] = useState(0);
  const [pricePerPiece, setPricePerPiece] = useState(0);
  const [totalAmt, setTotalAmt] = useState(0);

  useEffect(() => {
    if (!selectedVoucher || !vendor) {
      setJobWork('');
      setReceivedQty(0);
      setDamageOnArrival(0);
      setDamageAfterJob(0);
      setAlreadyForwarded(0);
      setForwardable(0);
      setQtyToForward(0);
      setPricePerPiece(0);
      setTotalAmt(0);
      return;
    }
    // Assume vendor.uid is the current vendor's Firestore UID
    const vendorId = vendor.uid;
    const events = selectedVoucher.events || [];
    const lastReceive = [...events].reverse().find((e: any) => (e as any).event_type === 'receive' && ((e as any).user_id === vendorId || (e as any).details?.receiver_id === vendorId));
    const totalForwarded = (events as any[]).filter((e: any) => (e as any).event_type === 'forward' && ((e as any).user_id === vendorId || (e as any).details?.sender_id === vendorId)).reduce((sum: number, e: any) => sum + ((e as any).details?.quantity_forwarded || 0), 0);
    setJobWork(vendor.vendorJobWork || '');
    setReceivedQty(lastReceive?.details?.quantity_received || 0);
    setDamageOnArrival(lastReceive?.details?.discrepancies?.damaged_on_arrival || 0);
    setAlreadyForwarded(totalForwarded);
    // Calculate forwardableBreakdown
    let forwardableBreakdown = 0;
    const arrivalQty = lastReceive?.details?.quantity_received || 0;
    const damagedOnArrival = lastReceive?.details?.discrepancies?.damaged_on_arrival || 0;
    const forwardEvents = events.filter((e: any) => e.event_type === 'forward' && (e.user_id === vendorId || e.details?.sender_id === vendorId));
    let sumForwarded = 0;
    forwardEvents.forEach((e: any) => {
      const qty = e.details?.quantity_forwarded || 0;
      const damaged = e.details?.discrepancies?.damaged_after_job || 0;
      sumForwarded += qty + damaged;
    });
    forwardableBreakdown = arrivalQty - damagedOnArrival - sumForwarded;
    if (forwardableBreakdown < 0) forwardableBreakdown = 0;
    setForwardable(forwardableBreakdown);
    // Set qtyToForward to forwardableBreakdown - damageAfterJob (or 0 if negative)
    const maxQty = forwardableBreakdown - damageAfterJob >= 0 ? forwardableBreakdown - damageAfterJob : 0;
    setQtyToForward(maxQty);
    setPricePerPiece(0);
    setTotalAmt(0);
  }, [selectedVoucher, vendor, damageAfterJob]);

  // --- Add derived forwardableBreakdown for use in input max and helper text ---
  let forwardableBreakdown = 0;
  if (selectedVoucher && vendor) {
    const vendorId = vendor.uid;
    const events = selectedVoucher.events || [];
    const lastReceive = [...events].reverse().find((e: any) => e.event_type === 'receive' && (e.user_id === vendorId || e.details?.receiver_id === vendorId));
    const arrivalQty = lastReceive?.details?.quantity_received || 0;
    const damagedOnArrival = lastReceive?.details?.discrepancies?.damaged_on_arrival || 0;
    const forwardEvents = events.filter((e: any) => e.event_type === 'forward' && (e.user_id === vendorId || e.details?.sender_id === vendorId));
    let sumForwarded = 0;
    forwardEvents.forEach((e: any) => {
      const qty = e.details?.quantity_forwarded || 0;
      const damaged = e.details?.discrepancies?.damaged_after_job || 0;
      sumForwarded += qty + damaged;
    });
    forwardableBreakdown = arrivalQty - damagedOnArrival - sumForwarded;
    if (forwardableBreakdown < 0) forwardableBreakdown = 0;
  }

  // State for job work selection and vendors
  const jobWorkOptions = jobWorkNames;
  const [selectedJobWork, setSelectedJobWork] = useState('');
  const [vendors, setVendors] = useState<any[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [selectedReceiver, setSelectedReceiver] = useState<any>(null);

  // Fetch vendors when job work changes
  useEffect(() => {
    if (!selectedJobWork) {
      setVendors([]);
      setSelectedReceiver(null);
      return;
    }
    setLoadingVendors(true);
    const fetchVendors = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('role', '==', 'vendor'), where('vendorJobWork', '==', selectedJobWork));
        const snap = await getDocs(q);
        const vendorList = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setVendors(vendorList);
      } catch (err) {
        setVendors([]);
      } finally {
        setLoadingVendors(false);
      }
    };
    fetchVendors();
  }, [selectedJobWork]);

  // Handle job work selection
  const handleJobWorkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedJobWork(e.target.value);
    setSelectedReceiver(null);
  };

  // Handle receiver vendor selection
  const handleReceiverChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = vendors.find(v => v.id === e.target.value);
    setSelectedReceiver(v || null);
  };

  // Add state for transport details and comment
  const [lrDate, setLrDate] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [transportName, setTransportName] = useState('');
  const [comment, setComment] = useState('');

  // Update qtyToForward and pricePerPiece to be user-editable
  const handleQtyToForwardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setQtyToForward(isNaN(val) ? 0 : Math.min(val, forwardable));
  };
  const handlePricePerPieceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPricePerPiece(isNaN(val) ? 0 : val);
  };
  // Update totalAmt when qtyToForward or pricePerPiece changes
  useEffect(() => {
    setTotalAmt(qtyToForward * pricePerPiece);
  }, [qtyToForward, pricePerPiece]);
  // Reset fields when voucher changes
  useEffect(() => {
    setLrDate('');
    setLrNumber('');
    setTransportName('');
    setComment('');
  }, [selectedVoucher]);
  // Reset handler
  const handleReset = () => {
    setQtyToForward(0);
    setPricePerPiece(0);
    setTotalAmt(0);
    setLrDate('');
    setLrNumber('');
    setTransportName('');
    setComment('');
  };
  // Add state for reason and admin users
  const [reason, setReason] = useState<'Forwarded' | 'Complete'>('Forwarded');
  const [admins, setAdmins] = useState<any[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);

  // Fetch admins when reason is 'Complete' - keep for validation but don't require selection
  useEffect(() => {
    if (reason === 'Complete') {
      const fetchAdmins = async () => {
        try {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('role', '==', 'admin'));
          const snap = await getDocs(q);
          const adminList = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
          setAdmins(adminList);
          // Auto-set to generic admin for completion
          if (adminList.length > 0) {
            setSelectedAdmin({ id: 'admin', firstName: 'Admin', surname: '', email: 'admin@system' });
          }
        } catch (err) {
          setAdmins([]);
        }
      };
      fetchAdmins();
    }
  }, [reason]);

  // Handle reason change
  const handleReasonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReason(e.target.value as 'Forwarded' | 'Complete');
    if (e.target.value === 'Complete') {
      setSelectedJobWork('');
      setSelectedReceiver(null);
      setSelectedAdmin(null);
    } else {
      setSelectedAdmin(null);
    }
  };

  // Handle admin selection
  const handleAdminChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const a = admins.find(a => a.id === e.target.value);
    setSelectedAdmin(a || null);
  };

  // Add handler for editable damageAfterJob
  const handleDamageAfterJobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setDamageAfterJob(isNaN(val) ? 0 : val);
  };

  // When damageAfterJob changes, also update qtyToForward if it exceeds the new max
  useEffect(() => {
    const maxQty = forwardableBreakdown - damageAfterJob >= 0 ? forwardableBreakdown - damageAfterJob : 0;
    if (qtyToForward > maxQty) setQtyToForward(maxQty);
  }, [damageAfterJob, forwardableBreakdown]);

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoucher || !vendor || (reason === 'Forwarded' && !selectedReceiver)) return;
    // For 'Complete' reason, we no longer require specific admin selection
    // Create new forward event
    const newEvent: any = {
      event_id: `evnt_${selectedVoucher.voucher_no}_${(selectedVoucher.events?.length || 0) + 1}`,
      event_type: 'forward',
      timestamp: new Date().toISOString(),
      user_id: vendor.uid,
      comment,
      details: {
        jobWork: reason === 'Forwarded' ? jobWork : null,
        sender_id: vendor.uid,
        receiver_id: reason === 'Forwarded' ? selectedReceiver.id : 'admin', // Use generic 'admin' for completion
        quantity_forwarded: qtyToForward,
        price_per_piece: pricePerPiece,
        discrepancies: {
          damaged_after_job: damageAfterJob,
        },
        transport: {
          lr_no: lrNumber,
          lr_date: lrDate,
          transporter_name: transportName,
        },
      },
    };
    try {
      // Update events array
      const updatedEvents = [...(selectedVoucher.events || []), newEvent];

      // Use new status management system
      const newStatus = determineNewStatus(selectedVoucher, 'forward', newEvent);

      // Create updated voucher data with new events for proper totals calculation
      const updatedVoucherData = {
        ...selectedVoucher,
        events: updatedEvents
      };
      const statusUpdate = updateVoucherStatus(updatedVoucherData, newStatus);

      // Update Firestore
      const voucherRef = doc(db, 'vouchers', selectedVoucher.id);
      await updateDoc(voucherRef, {
        events: updatedEvents,
        ...statusUpdate,
      });

      // Send notifications
      if (reason === 'Forwarded' && selectedReceiver) {
        // Notify the receiver vendor
        await notificationService.sendVoucherAssignmentNotification({
          vendorUserId: selectedReceiver.id,
          voucherNo: selectedVoucher.voucher_no,
          voucherId: selectedVoucher.id,
          itemName: selectedVoucher.item_details?.item_name || selectedVoucher.item,
          quantity: qtyToForward,
          isForwarded: true,
          senderName: `${vendor.firstName || ''} ${vendor.surname || ''}`.trim() || vendor.email
        });

        // Notify all admins about vendor-to-vendor forwarding
        await notificationService.sendAdminVoucherForwardNotification({
          voucherNo: selectedVoucher.voucher_no,
          voucherId: selectedVoucher.id,
          itemName: selectedVoucher.item_details?.item_name || selectedVoucher.item,
          quantity: qtyToForward,
          senderName: `${vendor.firstName || ''} ${vendor.surname || ''}`.trim() || vendor.email,
          receiverName: `${selectedReceiver.firstName || ''} ${selectedReceiver.surname || ''}`.trim() || selectedReceiver.email
        });
      } else if (reason === 'Complete') {
        // Notify all admins about completion request
        await notificationService.sendAdminCompletionNotification({
          voucherNo: selectedVoucher.voucher_no,
          voucherId: selectedVoucher.id,
          itemName: selectedVoucher.item_details?.item_name || selectedVoucher.item,
          quantity: qtyToForward,
          senderName: `${vendor.firstName || ''} ${vendor.surname || ''}`.trim() || vendor.email
        });
      }

      // Show success notification
      const successMessage = reason === 'Forwarded'
        ? `Voucher ${selectedVoucher.voucher_no} successfully forwarded to ${selectedReceiver?.firstName || selectedReceiver?.email || 'recipient'}!`
        : `Voucher ${selectedVoucher.voucher_no} completion request submitted successfully!`;

      // Create a custom notification element
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 transform transition-all duration-300 ease-in-out';
      notification.innerHTML = `
        <div class="flex items-center space-x-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span class="font-medium">${successMessage}</span>
        </div>
      `;

      document.body.appendChild(notification);

      // Animate in
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);

      // Remove notification and refresh page after 3 seconds
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
          document.body.removeChild(notification);
          // Refresh the page
          window.location.reload();
        }, 300);
      }, 3000);

      handleReset();
      // Refresh recently forwarded vouchers
      await refreshRecentlyForwardedVouchers();
      // Reset selected voucher to refresh the form
      setSelectedVoucher(null);
    } catch (err: any) {
      // Show error notification
      const errorMessage = `Error updating voucher: ${err.message || err}`;

      const errorNotification = document.createElement('div');
      errorNotification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 transform transition-all duration-300 ease-in-out translate-x-full';
      errorNotification.innerHTML = `
        <div class="flex items-center space-x-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
          <span class="font-medium">${errorMessage}</span>
        </div>
      `;

      document.body.appendChild(errorNotification);

      // Animate in
      setTimeout(() => {
        errorNotification.style.transform = 'translateX(0)';
      }, 100);

      // Remove error notification after 5 seconds
      setTimeout(() => {
        errorNotification.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (document.body.contains(errorNotification)) {
            document.body.removeChild(errorNotification);
          }
        }, 300);
      }, 5000);
    }
  };

  // Add state to track which forwarded row is expanded
  const [expandedForwardIdx, setExpandedForwardIdx] = useState<number | null>(null);
  // Add state for error message
  const [qtyError, setQtyError] = useState<string | null>(null);
  // Expanded card in Recently Forwarded section
  const [expandedVoucherId, setExpandedVoucherId] = useState<string | null>(null);

  // Helper function to get all forward events for a voucher by the current vendor
  const getAllForwardEvents = (voucher: any) => {
    try {
      const events = voucher.events || [];
      const vendorId = vendor?.uid;

      if (!vendorId) return [];

      const forwardEvents = events.filter((e: any) =>
        e.event_type === 'forward' &&
        (e.user_id === vendorId || e.details?.sender_id === vendorId)
      );

      // Sort by timestamp (most recent first)
      return forwardEvents.sort((a: any, b: any) =>
        toEpochMs(b.timestamp) - toEpochMs(a.timestamp)
      );
    } catch (error) {
      console.error('Error getting forward events:', error);
      return [];
    }
  };

  // Helper function to get the latest forward event for a voucher by the current vendor
  const getLatestForwardEvent = (voucher: any) => {
    try {
      const events = voucher.events || [];
      const vendorId = vendor?.uid;

      if (!vendorId) return null;

      const forwardEvents = events.filter((e: any) =>
        e.event_type === 'forward' &&
        (e.user_id === vendorId || e.details?.sender_id === vendorId)
      );

      if (forwardEvents.length === 0) return null;

      // Return the most recent forward event
      return forwardEvents.sort((a: any, b: any) => toEpochMs(b.timestamp) - toEpochMs(a.timestamp))[0];
    } catch (error) {
      console.error('Error getting latest forward event:', error);
      return null;
    }
  };

  // Filter and sort the forwarded vouchers based on search, sort, and filter options
  const filteredAndSortedVouchers = recentlyForwardedVouchers
    .filter(voucher => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const voucherNo = voucher.voucher_no?.toLowerCase() || '';
        const itemName = voucher.item_details?.item_name?.toLowerCase() || '';

        // Search through all forward events for this voucher
        const allForwardEvents = getAllForwardEvents(voucher);
        let receiverNames = '';

        // Collect all receiver names from forward events
        allForwardEvents.forEach((event: any) => {
          const receiverId = event.details?.receiver_id;
          if (receiverId) {
            const receiverName = userNames[receiverId] || receiverId;
            receiverNames += ' ' + receiverName.toLowerCase();
          }
        });

        // Also check job work from forward events
        let jobWorks = '';
        allForwardEvents.forEach((event: any) => {
          if (event.details?.jobWork) {
            jobWorks += ' ' + event.details.jobWork.toLowerCase();
          }
        });

        // Debug logging
        console.log('Search debug:', {
          searchTerm: searchLower,
          voucherNo,
          itemName,
          receiverNames,
          jobWorks,
          userNames: Object.keys(userNames)
        });

        if (!voucherNo.includes(searchLower) &&
          !itemName.includes(searchLower) &&
          !receiverNames.includes(searchLower) &&
          !jobWorks.includes(searchLower)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && voucher.voucher_status !== statusFilter) {
        return false;
      }

      // Job work filter
      if (jobWorkFilter !== 'all') {
        const latestEvent = getLatestForwardEvent(voucher);
        if (latestEvent?.details?.jobWork !== jobWorkFilter) {
          return false;
        }
      }

      // Date filter
      if (dateFilter !== 'all') {
        const latestEvent = getLatestForwardEvent(voucher);
        if (latestEvent?.timestamp) {
          const eventDate = new Date(latestEvent.timestamp);
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

          switch (dateFilter) {
            case 'today':
              if (eventDate < today) return false;
              break;
            case 'week':
              const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
              if (eventDate < weekAgo) return false;
              break;
            case 'month':
              const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
              if (eventDate < monthAgo) return false;
              break;
          }
        }
      }

      return true;
    })
    .sort((a, b) => {
      const latestEventA = getLatestForwardEvent(a);
      const latestEventB = getLatestForwardEvent(b);

      let comparison = 0;

      switch (sortBy) {
        case 'date':
          const dateA = latestEventA?.timestamp ? new Date(latestEventA.timestamp).getTime() : 0;
          const dateB = latestEventB?.timestamp ? new Date(latestEventB.timestamp).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case 'voucher':
          const voucherA = a.voucher_no || '';
          const voucherB = b.voucher_no || '';
          comparison = voucherA.localeCompare(voucherB);
          break;
        case 'quantity':
          const qtyA = latestEventA?.details?.quantity_forwarded || 0;
          const qtyB = latestEventB?.details?.quantity_forwarded || 0;
          comparison = qtyA - qtyB;
          break;
        case 'amount':
          const amountA = (latestEventA?.details?.quantity_forwarded || 0) * (latestEventA?.details?.price_per_piece || 0);
          const amountB = (latestEventB?.details?.quantity_forwarded || 0) * (latestEventB?.details?.price_per_piece || 0);
          comparison = amountA - amountB;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

  // Helper function to get receiver details for a forward event
  const getReceiverDetails = async (receiverId: string) => {
    try {
      const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', receiverId)));
      if (!userDoc.empty) {
        return userDoc.docs[0].data();
      }
      return null;
    } catch (err) {
      console.error('Error fetching receiver details:', err);
      return null;
    }
  };

  // Function to refresh recently forwarded vouchers
  const refreshRecentlyForwardedVouchers = async () => {
    if (!vendor?.uid) return;

    setLoadingRecentlyForwarded(true);
    try {
      const vouchersCollection = collection(db, 'vouchers');
      const vouchersQuery = query(vouchersCollection);
      const snapshot = await getDocs(vouchersQuery);
      const allVouchers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

      // Filter vouchers that have been forwarded by the current vendor
      const forwardedVouchers = allVouchers.filter(voucher => {
        const events = (voucher as any).events || [];
        const vendorId = vendor.uid;

        // Check if this voucher has a forward event by the current vendor
        return events.some((event: any) => {
          return event.event_type === 'forward' &&
            (event.user_id === vendorId || event.details?.sender_id === vendorId);
        });
      });

      // Sort by most recent forward event and take last 5
      const sortedVouchers = forwardedVouchers.sort((a, b) => {
        const aEvents = (a as any).events || [];
        const bEvents = (b as any).events || [];

        const aForwardEvents = aEvents.filter((e: any) =>
          e.event_type === 'forward' &&
          (e.user_id === vendor.uid || e.details?.sender_id === vendor.uid)
        );
        const bForwardEvents = bEvents.filter((e: any) =>
          e.event_type === 'forward' &&
          (e.user_id === vendor.uid || e.details?.sender_id === vendor.uid)
        );

        const aLatestForward = aForwardEvents.length > 0 ?
          new Date(aForwardEvents[aForwardEvents.length - 1].timestamp).getTime() : 0;
        const bLatestForward = bForwardEvents.length > 0 ?
          new Date(bForwardEvents[bForwardEvents.length - 1].timestamp).getTime() : 0;

        return bLatestForward - aLatestForward; // Most recent first
      }).slice(0, 5); // Take only last 5

      setRecentlyForwardedVouchers(sortedVouchers);

      // Fetch user names for the vouchers
      await fetchUserNamesForVouchers(sortedVouchers);
    } catch (err) {
      console.error('Error refreshing recently forwarded vouchers:', err);
      setRecentlyForwardedVouchers([]);
    } finally {
      setLoadingRecentlyForwarded(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 bg-blue-600 text-white">
        <h2 className="text-2xl font-bold text-center">VENDOR FORWARD REPORT</h2>
      </div>
      {/* Generated code */}
      <div className="p-6">
        <div className="space-y-8">
          <div className="pb-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Create Forward Voucher
            </h2>
          </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="selectVoucher" className="block text-sm font-medium text-gray-700 mb-2">
                Select Voucher
              </label>
              {!loadingVouchers && (
                <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
                  <strong>Filtering Info:</strong> {vouchers.length} total vouchers, {selectableVouchers.length} available for forwarding
                  (only vouchers received by you are shown)
                  {vouchers.length > 0 && selectableVouchers.length === 0 && (
                    <div className="mt-1 text-yellow-700">
                      <strong>Note:</strong> You have {vouchers.length} vouchers in the system, but none have been received by you yet.
                      Vouchers will appear here once you receive them.
                    </div>
                  )}
                </div>
              )}
              <select
                id="selectVoucher"
                className="mt-1 block w-full rounded-md border border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                required
                value={selectedVoucher?.id || ''}
                onChange={handleVoucherChange}
                disabled={loadingVouchers}
              >
                <option value="">{loadingVouchers ? 'Loading vouchers...' : 'Select a voucher'}</option>
                {selectableVouchers.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.voucher_no} - {v.item_details?.item_name} ({v.item_details?.initial_quantity} pcs)
                  </option>
                ))}
              </select>
              {!loadingVouchers && selectableVouchers.length === 0 && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                    <p className="text-sm text-yellow-800">
                      <strong>No vouchers available for forwarding.</strong> Vouchers will only appear here after they have been received by you.
                      Please check your received vouchers first.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">Voucher No</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    className="pl-8 sm:pl-10 block w-full rounded-md border border-blue-300 bg-blue-50 py-2 px-3 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={selectedVoucher?.voucher_no || ''}
                    readOnly
                  />
                </div>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">Voucher Date & Time</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    className="pl-8 sm:pl-10 block w-full rounded-md border border-blue-300 bg-blue-50 py-2 px-3 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={selectedVoucher ? formatDate(selectedVoucher.createdAt || selectedVoucher.created_at || selectedVoucher.created_at_ts) : ''}
                    readOnly
                  />
                </div>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">Sender's Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    className="pl-8 sm:pl-10 block w-full rounded-md border border-blue-300 py-2 px-3 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={vendor?.firstName ? `${vendor.firstName} ${vendor.surname || ''}` : ''}
                    readOnly
                  />
                </div>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">Sender's Designation</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    className="pl-8 sm:pl-10 block w-full rounded-md border border-blue-300 py-2 px-3 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={vendor?.designation || 'Vendor'}
                    readOnly
                  />
                </div>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">Sender's Phone No</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    className="pl-8 sm:pl-10 block w-full rounded-md border border-blue-300 py-2 px-3 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={vendor?.phone || ''}
                    readOnly
                  />
                </div>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">Images</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="pl-8 sm:pl-10 block w-full rounded-md border border-blue-300 py-2 px-3 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700"
                    onChange={handleImageChange}
                    disabled={images.length >= 3}
                  />
                </div>
                <p className="text-xs sm:text-sm text-blue-500 mt-1">
                  Maximum 3 photos allowed. Images will be watermarked with voucher number and auto-saved.
                </p>
                {images.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">Uploaded Images ({images.length}/3)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {images.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <div className="relative h-32 w-full rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                            <Image
                              src={URL.createObjectURL(img)}
                              alt={img.name}
                              fill
                              style={{ objectFit: 'cover' }}
                              className="transition-transform group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                                <button type="button" className="p-2 bg-red-500 rounded-full shadow-lg hover:bg-red-600 transition-colors" title="Delete image" onClick={() => handleRemoveImage(idx)}>
                                  <Trash2 className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-500 text-center">
                            {img.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">Item</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    className="pl-8 sm:pl-10 block w-full rounded-md border border-blue-300 py-2 px-3 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={selectedVoucher?.item_details?.item_name || ''}
                    readOnly
                  />
                </div>
              </div>
              <div className="col-span-1 lg:col-span-2 bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-100 mb-2">
                <h3 className="text-base sm:text-lg font-semibold text-blue-800 flex items-center mb-2 sm:mb-4">
                  <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600" />
                  CURRENT JOB DETAILS
                </h3>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">Job Work</label>
                <div className="mt-1 flex rounded-md shadow-sm border border-blue-300">
                  <input
                    type="text"
                    className="block w-full rounded-l-md border-0 focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm bg-gray-50"
                    value={jobWork}
                    readOnly
                  />
                  <span className="inline-flex items-center px-2 sm:px-3 rounded-r-md border-l border-blue-300 bg-blue-50 text-blue-500 text-xs sm:text-sm">
                    fixed
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">This value is automatically set from the voucher and cannot be edited.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">Net Qty Received</label>
                <div className="mt-1 flex rounded-md shadow-sm border border-blue-500">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="block w-full rounded-l-md border-0 focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm bg-gray-50"
                    value={receivedQty - damageOnArrival}
                    readOnly
                  />
                  <span className="inline-flex items-center px-2 sm:px-3 rounded-r-md border-l border-blue-300 bg-blue-50 text-blue-500 text-xs sm:text-sm">
                    pieces
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">This value is automatically calculated from the voucher and cannot be edited.</p>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">Damage After Job Work Qty</label>
                <div className="mt-1 flex rounded-md shadow-sm border border-blue-500">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="block w-full rounded-l-md border-0 focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm"
                    value={damageAfterJob}
                    onChange={handleDamageAfterJobChange}
                  />
                  <span className="inline-flex items-center px-2 sm:px-3 rounded-r-md border-l border-blue-300 bg-blue-50 text-blue-500 text-xs sm:text-sm">
                    pieces
                  </span>
                </div>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Enter Quantity to Forward *
                </label>
                <div className="mt-1 flex rounded-md shadow-sm border border-blue-500">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={`block w-full rounded-l-md border-0 focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm ${qtyError ? 'border-red-500 ring-red-500' : ''}`}
                    value={qtyToForward}
                    min="0"
                    max={forwardableBreakdown - damageAfterJob >= 0 ? forwardableBreakdown - damageAfterJob : 0}
                    placeholder="Enter quantity"
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      const maxQty = forwardableBreakdown - damageAfterJob >= 0 ? forwardableBreakdown - damageAfterJob : 0;
                      if (isNaN(val) || val < 0) {
                        setQtyToForward(0);
                        setQtyError(null);
                      } else if (val > maxQty) {
                        setQtyToForward(val);
                        setQtyError(`You cannot forward more than ${maxQty} pieces.`);
                      } else {
                        setQtyToForward(val);
                        setQtyError(null);
                      }
                    }}
                  />
                  <span className="inline-flex items-center px-2 sm:px-3 rounded-r-md border-l border-blue-300 bg-blue-50 text-blue-500 text-xs sm:text-sm">
                    pieces
                  </span>
                </div>
                {qtyError && (
                  <p className="mt-1 text-xs text-red-600">{qtyError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Enter the quantity you want to forward (maximum: {forwardableBreakdown - damageAfterJob >= 0 ? forwardableBreakdown - damageAfterJob : 0} pieces)
                </p>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">My Charge per Piece(INR)</label>
                <div className="mt-1 flex rounded-md shadow-sm border border-blue-500">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="block w-full rounded-l-md border-0 focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm"
                    value={pricePerPiece}
                    min="0"
                    onChange={handlePricePerPieceChange}
                    required
                  />
                  <span className="inline-flex items-center px-2 sm:px-3 rounded-r-md border-l border-blue-300 bg-blue-50 text-blue-500 text-xs sm:text-sm">
                    INR / piece
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">Enter 0 if no specific charge for this step.</p>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">Total Amt Receivable</label>
                <div className="mt-1 flex rounded-md shadow-sm border border-blue-500">
                  <input
                    type="number"
                    className="block w-full rounded-l-md border-0 focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm bg-gray-50"
                    value={totalAmt}
                    readOnly
                  />
                  <span className="inline-flex items-center px-2 sm:px-3 rounded-r-md border-l border-blue-300 bg-blue-50 text-blue-500 text-xs sm:text-sm">
                    INR
                  </span>
                </div>
              </div>
              <div className="col-span-1 lg:col-span-2 bg-green-50 p-3 rounded-lg border border-green-200 mb-4">
                <h4 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
                  <Package className="h-4 w-4 mr-2 text-green-600" />
                  Forwardable Quantity Breakdown
                </h4>
                <div className="bg-white rounded-lg border border-green-200 p-3">
                  {/* Breakdown logic */}
                  {(() => {
                    // Find last receive event for this vendor
                    const vendorId = vendor?.uid;
                    const events = selectedVoucher?.events || [];
                    const lastReceive = [...events].reverse().find((e: any) => e.event_type === 'receive' && (e.user_id === vendorId || e.details?.receiver_id === vendorId));
                    const arrivalQty = lastReceive?.details?.quantity_received || 0;
                    const damagedOnArrival = lastReceive?.details?.discrepancies?.damaged_on_arrival || 0;
                    // All forward events for this vendor
                    const forwardEvents = events.filter((e: any) => e.event_type === 'forward' && (e.user_id === vendorId || e.details?.sender_id === vendorId));
                    // Calculate sum of (quantity_forwarded + damaged_after_job) for all forward events
                    let sumForwarded = 0;
                    const forwardedRows = forwardEvents.map((e: any, idx: number) => {
                      const qty = e.details?.quantity_forwarded || 0;
                      const damaged = e.details?.discrepancies?.damaged_after_job || 0;
                      sumForwarded += qty + damaged;
                      const isExpanded = expandedForwardIdx === idx;
                      return (
                        <div key={e.event_id}>
                          <div
                            className="flex justify-between items-center py-1 border-b border-green-100 cursor-pointer hover:bg-green-50"
                            onClick={() => setExpandedForwardIdx(isExpanded ? null : idx)}
                          >
                            <span className="text-orange-700 text-sm">Forwarded#{idx + 1}:</span>
                            <span className="font-semibold text-orange-800">{qty + damaged}</span>
                          </div>
                          {isExpanded && (
                            <div className="pl-4 pb-2 text-xs text-gray-700">
                              <div>Quantity Forwarded: <span className="font-semibold">{qty}</span></div>
                              <div>Damaged After Job: <span className="font-semibold">{damaged}</span></div>
                            </div>
                          )}
                        </div>
                      );
                    });

                    // Calculate forwardable (subtract previous events and current damage after job)
                    const forwardableCalc = arrivalQty - damagedOnArrival - sumForwarded - damageAfterJob;

                    return (
                      <>
                        <div className="flex justify-between items-center py-1 border-b border-green-100">
                          <span className="text-green-700 text-sm">Net Qty Received:</span>
                          <span className="font-semibold text-green-800">{arrivalQty - damagedOnArrival}</span>
                        </div>
                        {forwardedRows}
                        {damageAfterJob > 0 && (
                          <div className="flex justify-between items-center py-1 border-b border-green-100">
                            <span className="text-red-700 text-sm">Damage After Job Work:</span>
                            <span className="font-semibold text-red-800">-{damageAfterJob}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center py-2 bg-green-50 rounded px-2 border border-green-300 mt-2">
                          <span className="text-green-700 font-semibold text-sm">Forwardable:</span>
                          <span className="font-bold text-green-800">{forwardableCalc > 0 ? forwardableCalc : 0}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="col-span-1 lg:col-span-2 bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-100 mb-2 mt-4">
                <h3 className="text-base sm:text-lg font-semibold text-blue-800 flex items-center mb-2 sm:mb-4">
                  <Truck className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600" />
                  NEXT JOB & FORWARDING DETAILS
                </h3>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700 mb-2">Reason</label>
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="reasonForwarded"
                      name="reason"
                      value="Forwarded"
                      checked={reason === 'Forwarded'}
                      onChange={handleReasonChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label htmlFor="reasonForwarded" className="ml-2 block text-sm text-gray-700">
                      Forward to Vendor
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="reasonComplete"
                      name="reason"
                      value="Complete"
                      checked={reason === 'Complete'}
                      onChange={handleReasonChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <label htmlFor="reasonComplete" className="ml-2 block text-sm text-gray-700">
                      Send to Admin
                    </label>
                  </div>
                </div>
              </div>
              {/* Show job work and vendor only if Forwarded */}
              {reason === 'Forwarded' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Job Work</label>
                    <select
                      className="mt-1 block w-full rounded-md border border-blue-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm"
                      value={selectedJobWork}
                      onChange={handleJobWorkChange}
                    >
                      <option value="">Select Next Job Work</option>
                      {jobWorkOptions.map((jw: string) => (
                        <option key={jw} value={jw}>{jw}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label htmlFor="vendorSelect" className="block text-sm font-medium text-gray-700 mb-2">
                      Select Vendor
                    </label>
                    <select
                      id="vendorSelect"
                      className="mt-1 block w-full rounded-md border border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3"
                      required
                      value={selectedReceiver?.id || ''}
                      onChange={handleReceiverChange}
                      disabled={!selectedJobWork || loadingVendors}
                    >
                      <option value="">{!selectedJobWork ? 'Select job work first' : loadingVendors ? 'Loading vendors...' : 'Select a vendor'}</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.companyName || (v.firstName + ' ' + v.surname)} ({v.userCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Autofill receiver details */}
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Receiver's Company Name</label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border border-blue-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm bg-gray-50"
                      value={selectedReceiver?.companyName || ''}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Receiver's Address</label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border border-blue-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm bg-gray-50"
                      value={selectedReceiver?.address ? `${selectedReceiver.address.line1}, ${selectedReceiver.address.city}` : ''}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Receiver's Phone</label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border border-blue-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm bg-gray-50"
                      value={selectedReceiver?.phone || ''}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Receiver's Email</label>
                    <input
                      type="email"
                      className="mt-1 block w-full rounded-md border border-blue-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm bg-gray-50"
                      value={selectedReceiver?.email || ''}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-2">Receiver's Code</label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border border-blue-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm bg-gray-50"
                      value={selectedReceiver?.userCode || ''}
                      readOnly
                    />
                  </div>
                </>
              )}
              {/* Show info message when reason is Complete */}
              {reason === 'Complete' && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    This voucher will be sent to Admin for completion. Any admin can receive and process this request.
                  </p>
                </div>
              )}
              <div className="col-span-1 lg:col-span-2 bg-blue-50 p-3 sm:p-4 rounded-lg border border-blue-100 mb-2 mt-4">
                <h3 className="text-base sm:text-lg font-semibold text-blue-800 flex items-center mb-2 sm:mb-4">
                  <Truck className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600" />
                  TRANSPORT DETAILS
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-blue-800">
                    <strong>Optional:</strong> LR (Lorry Receipt) details can be filled in if available. This information will be shown to the next vendor who receives the voucher, so they know the transport details from your forwarding action.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">LR Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                  </div>
                  <input
                    type="date"
                    className="pl-8 sm:pl-10 block w-full rounded-md border border-blue-500 py-2 px-3 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={lrDate}
                    onChange={e => setLrDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">LR Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    className="pl-8 sm:pl-10 block w-full rounded-md border border-blue-500 py-2 px-3 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Enter LR Number"
                    value={lrNumber}
                    onChange={e => setLrNumber(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">Transport Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    className="pl-8 sm:pl-10 block w-full rounded-md border border-blue-500 py-2 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    placeholder="Enter Transport Name (e.g. Transport 1)"
                    value={transportName}
                    onChange={e => setTransportName(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-span-1 lg:col-span-2">
                <label className="block text-sm font-medium text-blue-700 mb-2">Comment / Note</label>
                <textarea
                  className="mt-1 block w-full rounded-md border border-blue-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 text-sm"
                  rows={4}
                  maxLength={1000}
                  placeholder="Enter comment (up to 1000 words)"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-blue-100 mt-8">
              <button
                type="button"
                className="inline-flex items-center justify-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                onClick={handleReset}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <Upload className="h-4 w-4 mr-2" />
                Submit
              </button>
            </div>
          </form>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm lg:text-lg font-semibold text-gray-800 flex items-center">
                <FileText className="h-7 w-7 mr-2 text-blue-600" />
                All Forwarded Vouchers
              </h3>
              <div className="flex space-x-2">
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  onClick={refreshRecentlyForwardedVouchers}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Search, Sort, and Filter Controls */}
            <div className="mb-6 space-y-4">
              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    placeholder="Search by voucher number, item name, receiver, or job work..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="px-3 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sort and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Sort By */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="date">Sort by Date</option>
                    <option value="voucher">Sort by Voucher No</option>
                    <option value="quantity">Sort by Quantity</option>
                    <option value="amount">Sort by Amount</option>
                  </select>

                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="damaged">Damaged</option>
                </select>

                {/* Job Work Filter */}
                <select
                  value={jobWorkFilter}
                  onChange={(e) => setJobWorkFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Job Works</option>
                  {jobWorkNames.map((jobWork) => (
                    <option key={jobWork} value={jobWork}>{jobWork}</option>
                  ))}
                </select>

                {/* Date Filter */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>

              {/* Results Count */}
              <div className="text-sm text-gray-600">
                Showing {filteredAndSortedVouchers.length} of {recentlyForwardedVouchers.length} forwarded vouchers
              </div>
            </div>
            <div className="space-y-3">
              {loadingRecentlyForwarded ? (
                <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin text-blue-600" />
                    <span className="text-gray-600">Loading recently forwarded vouchers...</span>
                  </div>
                </div>
              ) : !vendor?.uid ? (
                <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
                  <div className="text-center text-gray-500">
                    <User className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>Loading vendor information...</p>
                  </div>
                </div>
              ) : recentlyForwardedVouchers.length === 0 ? (
                <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
                  <div className="text-center text-gray-500">
                    <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No forwarded vouchers found.</p>
                    <p className="text-sm">Vouchers you forward will appear here.</p>
                  </div>
                </div>
              ) : filteredAndSortedVouchers.length === 0 ? (
                <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
                  <div className="text-center text-gray-500">
                    <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No vouchers match your search criteria.</p>
                    <p className="text-sm">Try adjusting your search or filter options.</p>
                  </div>
                </div>
              ) : (
                filteredAndSortedVouchers.map((voucher) => {
                  const latestEvent: any = getLatestForwardEvent(voucher);
                  const allForwardEvents = getAllForwardEvents(voucher);
                  if (!latestEvent) {
                    return (
                      <div key={voucher.id} className="bg-white p-3 rounded-md border border-gray-200 shadow-sm">
                        <p className="text-gray-500">No forward details available.</p>
                      </div>
                    );
                  }

                  const qty = latestEvent?.details?.quantity_forwarded || 0;
                  const ppp = latestEvent?.details?.price_per_piece || 0;
                  const total = qty * ppp;
                  const receiverLabel = userNames[latestEvent?.details?.receiver_id] || latestEvent?.details?.receiver_id || 'N/A';
                  const transportLabel = latestEvent?.details?.transport?.transporter_name || 'N/A';

                  const isExpanded = expandedVoucherId === voucher.id;

                  return (
                    <div key={voucher.id} className="bg-white rounded-md border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center flex-wrap gap-2">
                              <button
                                onClick={() => {
                                  // Navigate to voucher details or open modal
                                  window.open(`/admin-dashboard?voucherId=${voucher.id}&viewMode=details`, '_blank');
                                }}
                                className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded hover:bg-indigo-100 hover:text-indigo-800 cursor-pointer transition-colors"
                                title="Click to view voucher details"
                              >
                                Voucher: #{voucher.voucher_no || 'N/A'}
                              </button>
                              <span className="text-sm sm:text-base font-semibold text-gray-800 truncate break-words">Item: {voucher.item_details?.item_name || 'N/A'}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] sm:text-xs">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Qty: {qty} pcs</span>
                              {latestEvent?.details?.jobWork && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">Job: {latestEvent.details.jobWork}</span>
                              )}
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Amt: ₹{total}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Transport: {transportLabel}</span>
                            </div>
                            <div className="mt-2 text-[11px] sm:text-xs text-gray-600 truncate break-words">
                              To: <span className="font-medium text-gray-700">{receiverLabel}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] sm:text-xs text-gray-500">Forwarded on: {latestEvent?.timestamp ? formatDate(latestEvent.timestamp) : 'N/A'}</div>
                            <div className="mt-2">
                              <span className="px-2 py-1 inline-flex text-[10px] leading-4 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                Status: {voucher.voucher_status || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setExpandedVoucherId(isExpanded ? null : voucher.id)}
                            className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3.5 w-3.5 mr-1" /> Hide details
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3.5 w-3.5 mr-1" /> View details
                              </>
                            )}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <h5 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                              <Package className="h-3.5 w-3.5 mr-1 text-blue-600" /> All Forwards ({allForwardEvents.length})
                            </h5>
                            <div className="space-y-2">
                              {allForwardEvents.map((forwardEvent: any, eventIndex: number) => (
                                <div key={forwardEvent.event_id || eventIndex} className="bg-gray-50 p-2 rounded border border-gray-200">
                                  <div className="flex items-start justify-between">
                                    <div className="text-[11px] sm:text-xs text-gray-600">
                                      <span className="font-medium text-gray-700 mr-1">#{eventIndex + 1}</span>
                                      <span className="mr-2">Qty: {forwardEvent?.details?.quantity_forwarded || 0} pcs</span>
                                      {forwardEvent?.details?.jobWork && (
                                        <span className="mr-2 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">Job: {forwardEvent.details.jobWork}</span>
                                      )}
                                      <span>To: <span className="font-medium">{userNames[forwardEvent?.details?.receiver_id] || forwardEvent?.details?.receiver_id || 'N/A'}</span></span>
                                    </div>
                                    <div className="text-[10px] text-gray-500">On: {forwardEvent?.timestamp ? formatDate(forwardEvent.timestamp) : 'N/A'}</div>
                                  </div>
                                  <div className="mt-1 text-[11px] sm:text-xs text-gray-600 flex flex-wrap gap-2">
                                    <span>Amount: ₹{(forwardEvent?.details?.quantity_forwarded || 0) * (forwardEvent?.details?.price_per_piece || 0)}</span>
                                    {forwardEvent?.details?.transport?.transporter_name && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                        Transport name: {forwardEvent.details.transport.transporter_name}
                                      </span>
                                    )}
                                    {forwardEvent?.details?.transport?.lr_number && (
                                      <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                                        LR No: {forwardEvent.details.transport.lr_number}
                                      </span>
                                    )}
                                  </div>
                                  {forwardEvent?.comment && (
                                    <div className="mt-1 text-[11px] sm:text-xs text-gray-600 break-words">
                                      <span className="font-medium">Comment:</span> {forwardEvent.comment}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="text"][inputMode="numeric"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
