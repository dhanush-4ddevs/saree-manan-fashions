'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FileText, PlusCircle, ArrowLeft, Printer, RefreshCw, ActivitySquare, Eye, Package, Wrench, Truck, User, DollarSign, AlertTriangle, MessageSquare, Edit, ListChecks, Split, ImageIcon, Grid3X3, List, ChevronRight, Search, Filter, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { VoucherCardGrid } from './VoucherCardGrid';
import { Voucher } from '@/types/voucher';
import { db } from '@/config/firebase';
import { collection, getDocs, query, orderBy, Timestamp, deleteDoc, doc, getDoc } from 'firebase/firestore';
import VoucherWorkflowTracker from './VoucherWorkflowTracker';
import VoucherDetails from './VoucherDetails';
import { formatIndianQuantity } from '@/lib/format';
import { getStatusColor, getStatusBackgroundColor } from '@/utils/voucherStatusManager';
import { AlternatePrintPreviewModal } from './AlternatePrintPreviewModal';
import { getCurrentDateString, validateDateRange } from '@/utils/dateFormatter';
import { ImageContainer } from './ImageContainer';
import { useJobWorks } from '@/hooks/useJobWorks';

interface AllVouchersProps {
  onCreateVoucher?: () => void;
  hideHeading?: boolean;
}

export default function AllVouchers({ onCreateVoucher, hideHeading = false }: AllVouchersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'details' | 'workflow'>('list');
  const [listViewType, setListViewType] = useState<'card' | 'table'>('table');
  const [activeTab, setActiveTab] = useState('Overview');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<Voucher | null>(null);

  // Use the job works hook
  const { jobWorkNames, loading: jobWorksLoading, error: jobWorksError } = useJobWorks();

  // Add state to maintain highlighted voucher independently of URL
  const [persistentHighlightedVoucherId, setPersistentHighlightedVoucherId] = useState<string | null>(null);
  const [persistentViewMode, setPersistentViewMode] = useState<string | null>(null);

  // Add sorting state
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Add ref for scrolling to highlighted voucher
  const highlightedVoucherRef = useRef<HTMLTableRowElement>(null);

  // Add filter and search state variables
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(getCurrentDateString());
  const [statusFilter, setStatusFilter] = useState('');
  const [jobWorkFilter, setJobWorkFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateError, setDateError] = useState('');

  // Applied filters (only applied when search button is clicked)
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('');
  const [appliedJobWorkFilter, setAppliedJobWorkFilter] = useState('');

  // Add CSS for print styling
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        @page {
          size: landscape;
          margin: 0.5in;
        }

        body * {
          visibility: hidden;
        }

        .print-table-container, .print-table-container * {
          visibility: visible;
        }

        .print-table-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }

        .print-table {
          width: 100% !important;
          font-size: 8px !important;
          border-collapse: collapse !important;
        }

        .print-table th,
        .print-table td {
          padding: 2px 4px !important;
          border: 1px solid #ccc !important;
          font-size: 7px !important;
          line-height: 1.2 !important;
          word-wrap: break-word !important;
          max-width: none !important;
        }

        .print-table th {
          background-color: #f0f0f0 !important;
          font-weight: bold !important;
          text-align: center !important;
        }

        .print-hide {
          display: none !important;
        }

        .print-table img {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Check URL parameters on component mount to set initial view and voucher
  useEffect(() => {
    const viewParam = searchParams?.get('view');
    const viewModeParam = searchParams?.get('viewMode');
    const voucherIdParam = searchParams?.get('voucherId');

    if (viewParam === 'table') {
      setListViewType('table');
    }

    // Handle notification-triggered navigation
    if (viewModeParam && voucherIdParam && vouchers.length > 0) {
      const targetVoucher = vouchers.find(v => v.id === voucherIdParam);
      if (targetVoucher) {
        setSelectedVoucher(targetVoucher);
        if (viewModeParam === 'details') {
          setViewMode('details');
          setActiveTab('Overview');
        } else if (viewModeParam === 'workflow') {
          setViewMode('workflow');
        }
      }
    }
  }, [searchParams, vouchers]);

  // Update persistent highlight state when URL parameters change
  useEffect(() => {
    const voucherIdParam = searchParams?.get('voucherId');
    const viewModeParam = searchParams?.get('viewMode');

    if (voucherIdParam) {
      setPersistentHighlightedVoucherId(voucherIdParam);
      setPersistentViewMode(viewModeParam || null);
    }
  }, [searchParams]);

  // Add useEffect to scroll to highlighted voucher using persistent state
  useEffect(() => {
    if (persistentHighlightedVoucherId && vouchers.length > 0) {
      // For table view, scroll to the highlighted row
      if (listViewType === 'table' && highlightedVoucherRef.current) {
        setTimeout(() => {
          highlightedVoucherRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 100);
      }

      // Reset URL after highlighting for all view modes
      setTimeout(() => {
        router.replace('/admin-dashboard', { scroll: false });
      }, 1000); // Wait 1 second after highlighting to reset URL
    }
  }, [persistentHighlightedVoucherId, vouchers, router, listViewType]);

  const getStatusColorLocal = (status: string) => {
    return getStatusColor(status as any) || 'text-gray-600';
  };

  const getStatusBadgeColor = (status: string) => {
    return getStatusBackgroundColor(status as any) || 'bg-gray-100 text-gray-800';
  };

  const formatVoucherStatus = (status: string) => {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Add sorting function
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort vouchers based on current sort field and direction
  const sortedVouchers = [...vouchers].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'voucher_no':
        aValue = a.voucher_no;
        bValue = b.voucher_no;
        break;
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'created_by':
        aValue = (a as any).createdByName || 'N/A';
        bValue = (b as any).createdByName || 'N/A';
        break;
      case 'item_name':
        aValue = a.item_details.item_name;
        bValue = b.item_details.item_name;
        break;
      case 'quantity':
        aValue = a.item_details.initial_quantity;
        bValue = b.item_details.initial_quantity;
        break;
      case 'job_work':
        aValue = (a as any).vendorJobWork;
        bValue = (b as any).vendorJobWork;
        break;
      case 'vendor_name':
        aValue = (a as any).vendorName;
        bValue = (b as any).vendorName;
        break;
      case 'vendor_code':
        aValue = (a as any).userCode;
        bValue = (b as any).userCode;
        break;
      case 'lr_date':
        aValue = a.events.find(e => e.event_type === 'dispatch')?.details.transport?.lr_date || '';
        bValue = b.events.find(e => e.event_type === 'dispatch')?.details.transport?.lr_date || '';
        break;
      case 'lr_number':
        aValue = a.events.find(e => e.event_type === 'dispatch')?.details.transport?.lr_no || '';
        bValue = b.events.find(e => e.event_type === 'dispatch')?.details.transport?.lr_no || '';
        break;
      case 'transport_name':
        aValue = a.events.find(e => e.event_type === 'dispatch')?.details.transport?.transporter_name || '';
        bValue = b.events.find(e => e.event_type === 'dispatch')?.details.transport?.transporter_name || '';
        break;
      case 'status':
        aValue = a.voucher_status;
        bValue = b.voucher_status;
        break;
      default:
        aValue = a.created_at;
        bValue = b.created_at;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Filter vouchers based on search term and filters
  const filterVouchers = () => {
    return sortedVouchers.filter((voucher) => {
      // Enhanced text search - search in ALL relevant fields
      const searchMatch = !appliedSearchTerm ||
        // Basic voucher info
        voucher.voucher_no?.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
        voucher.voucher_status?.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||

        // Item details
        voucher.item_details?.item_name?.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
        voucher.item_details?.supplier_name?.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
        voucher.item_details?.initial_quantity?.toString().includes(appliedSearchTerm.toLowerCase()) ||
        voucher.item_details?.supplier_price_per_piece?.toString().includes(appliedSearchTerm.toLowerCase()) ||

        // Date fields
        new Date(voucher.created_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }).toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||

        // Search in all events for comprehensive coverage
        voucher.events?.some(event => {
          // Job work details
          const jobWorkMatch = event.details?.jobWork?.toLowerCase().includes(appliedSearchTerm.toLowerCase());

          // Transport details
          const transportMatch =
            event.details?.transport?.transporter_name?.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
            event.details?.transport?.lr_no?.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
            event.details?.transport?.lr_date?.toLowerCase().includes(appliedSearchTerm.toLowerCase());

          // Quantity details
          const quantityMatch =
            event.details?.quantity_dispatched?.toString().includes(appliedSearchTerm.toLowerCase()) ||
            event.details?.quantity_expected?.toString().includes(appliedSearchTerm.toLowerCase()) ||
            event.details?.quantity_received?.toString().includes(appliedSearchTerm.toLowerCase()) ||
            event.details?.quantity_before_job?.toString().includes(appliedSearchTerm.toLowerCase()) ||
            event.details?.quantity_forwarded?.toString().includes(appliedSearchTerm.toLowerCase()) ||
            event.details?.price_per_piece?.toString().includes(appliedSearchTerm.toLowerCase());

          // Discrepancy details
          const discrepancyMatch =
            event.details?.discrepancies?.missing?.toString().includes(appliedSearchTerm.toLowerCase()) ||
            event.details?.discrepancies?.damaged_on_arrival?.toString().includes(appliedSearchTerm.toLowerCase()) ||
            event.details?.discrepancies?.damaged_after_job?.toString().includes(appliedSearchTerm.toLowerCase()) ||
            event.details?.discrepancies?.damage_reason?.toLowerCase().includes(appliedSearchTerm.toLowerCase());

          // Event metadata
          const eventMetaMatch =
            event.event_type?.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
            event.comment?.toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
            event.event_id?.toLowerCase().includes(appliedSearchTerm.toLowerCase());

          return jobWorkMatch || transportMatch || quantityMatch || discrepancyMatch || eventMetaMatch;
        }) ||

        // Voucher totals and status tracking
        voucher.total_dispatched?.toString().includes(appliedSearchTerm.toLowerCase()) ||
        voucher.total_received?.toString().includes(appliedSearchTerm.toLowerCase()) ||
        voucher.total_forwarded?.toString().includes(appliedSearchTerm.toLowerCase()) ||
        voucher.total_missing_on_arrival?.toString().includes(appliedSearchTerm.toLowerCase()) ||
        voucher.total_damaged_on_arrival?.toString().includes(appliedSearchTerm.toLowerCase()) ||
        voucher.total_damaged_after_work?.toString().includes(appliedSearchTerm.toLowerCase()) ||
        voucher.admin_received_quantity?.toString().includes(appliedSearchTerm.toLowerCase()) ||

        // User and creation details
        voucher.created_by_user_id?.toLowerCase().includes(appliedSearchTerm.toLowerCase());

      // Date range filter - only apply if search button was clicked
      let dateMatch = true;
      if (appliedStartDate || appliedEndDate) {
        const voucherDate = new Date(voucher.created_at);
        const start = appliedStartDate ? new Date(appliedStartDate) : null;
        const end = appliedEndDate ? new Date(appliedEndDate) : null;

        if (start && end) {
          dateMatch = voucherDate >= start && voucherDate <= end;
        } else if (start) {
          dateMatch = voucherDate >= start;
        } else if (end) {
          dateMatch = voucherDate <= end;
        }
      }

      // Status filter - only apply if search button was clicked
      const statusMatch = !appliedStatusFilter || voucher.voucher_status === appliedStatusFilter;

      // Job work filter - only apply if search button was clicked
      const jobWorkMatch = !appliedJobWorkFilter ||
        voucher.events?.some(event => event.details?.jobWork === appliedJobWorkFilter);

      return searchMatch && dateMatch && statusMatch && jobWorkMatch;
    });
  };

  const filteredVouchers = useMemo(() => filterVouchers(), [sortedVouchers, appliedSearchTerm, appliedStartDate, appliedEndDate, appliedStatusFilter, appliedJobWorkFilter]);

  const handleSearch = () => {
    // Validate date range before applying filters
    const validation = validateDateRange(startDate, endDate);
    if (!validation.isValid) {
      setDateError(validation.error || '');
      return;
    }

    // Clear any existing errors
    setDateError('');

    // Apply the current filter values to the applied filters
    setAppliedSearchTerm(searchTerm);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedStatusFilter(statusFilter);
    setAppliedJobWorkFilter(jobWorkFilter);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate(getCurrentDateString()); // Reset to current date
    setStatusFilter('');
    setJobWorkFilter('');
    setSearchTerm('');
    setDateError('');

    // Also clear the applied filters
    setAppliedSearchTerm('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setAppliedStatusFilter('');
    setAppliedJobWorkFilter('');
  };

  useEffect(() => {
    fetchAllVouchers();
  }, []);

  const fetchAllVouchers = async () => {
    try {
      setLoading(true);
      const vouchersCollection = collection(db, 'vouchers');
      const vouchersQuery = query(vouchersCollection, orderBy('createdAt', 'desc'));
      const vouchersSnapshot = await getDocs(vouchersQuery);

      const vouchersList = await Promise.all(vouchersSnapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data() as Omit<Voucher, 'id'>;

        let vendorName = 'N/A';
        let userCode = 'N/A';
        let vendorJobWork = 'N/A';
        let companyName = 'N/A';
        let createdByName = 'N/A';
        let createdByCode = 'N/A';

        // Fetch creator information
        if (data.created_by_user_id) {
          try {
            const creatorDoc = await getDoc(doc(db, 'users', data.created_by_user_id));
            if (creatorDoc.exists()) {
              const creatorData = creatorDoc.data() as { firstName?: string, surname?: string, userCode?: string };
              createdByName = creatorData.firstName && creatorData.surname
                ? `${creatorData.firstName} ${creatorData.surname}`.trim()
                : creatorData.firstName || creatorData.surname || 'N/A';
              createdByCode = creatorData.userCode || 'N/A';
            }
          } catch (error) {
            console.error(`Error fetching creator details for user ID: ${data.created_by_user_id}`, error);
          }
        }

        const dispatchEvent = data.events.find(e => e.event_type === 'dispatch');
        if (dispatchEvent && dispatchEvent.details.receiver_id) {
          try {
            const vendorDoc = await getDoc(doc(db, 'users', dispatchEvent.details.receiver_id));
            if (vendorDoc.exists()) {
              const vendorData = vendorDoc.data() as { companyName?: string, firstName?: string, surname?: string, userCode?: string, vendorJobWork?: string };
              // Set vendor name as personal name (firstName + surname)
              vendorName = vendorData.firstName && vendorData.surname
                ? `${vendorData.firstName} ${vendorData.surname}`.trim()
                : vendorData.firstName || vendorData.surname || 'N/A';
              // Set company name separately
              companyName = vendorData.companyName || 'N/A';
              userCode = vendorData.userCode ?? 'N/A';
              vendorJobWork = vendorData.vendorJobWork ?? (dispatchEvent.details.jobWork || 'N/A');
            }
          } catch (error) {
            console.error(`Error fetching vendor details for receiver ID: ${dispatchEvent.details.receiver_id}`, error);
          }
        }

        return {
          ...data,
          id: docSnapshot.id,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          vendorName: vendorName,
          userCode: userCode,
          vendorJobWork: vendorJobWork,
          companyName: companyName,
          createdByName: createdByName,
          createdByCode: createdByCode,
        } as Voucher & { vendorName: string, userCode: string, vendorJobWork: string, companyName: string, createdByName: string, createdByCode: string };
      }));

      setVouchers(vouchersList);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setViewMode('details');
    setActiveTab('Overview');
  };

  const handleDelete = async (id: string) => {
    try {
      if (window.confirm('Are you sure you want to delete this voucher?')) {
        await deleteDoc(doc(db, 'vouchers', id));

        // If the deleted voucher is currently selected, reset the view
        if (selectedVoucher?.id === id) {
          setSelectedVoucher(null);
          setViewMode('list');
        }

        // Update the vouchers list
        setVouchers(prev => prev.filter(v => v.id !== id));
      }
    } catch (error) {
      console.error('Error deleting voucher:', error);
      alert('Failed to delete voucher. Please try again.');
    }
  };

  const handlePrint = (voucher: Voucher) => {
    setSelectedVoucherForPrint(voucher);
    setShowPrintPreview(true);
  };

  const handleEdit = (voucher: Voucher) => {
    router.push(`/admin-dashboard/vouchers/edit/${voucher.id}`);
  };

  const handleTrack = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
    setViewMode('workflow');
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-2 lg:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center flex-wrap gap-2">
          {viewMode !== 'list' ? (
            <div className="flex items-center">
              <button
                onClick={() => setViewMode('list')}
                className="flex items-center px-3 py-1 text-sm text-blue-700 hover:bg-blue-50 rounded-md transition-colors duration-200 mr-3"
              >
                <ArrowLeft className="h-4 w-4 mr-1 text-blue-600" />
                Back
              </button>
              <h2 className="text-xl font-bold text-blue-800">
                {viewMode === 'workflow' ? 'Voucher Tracking' : 'Voucher Details'}
              </h2>
            </div>
          ) : (
            <>
              {!hideHeading && (
                <>
                  <FileText className="h-6 w-5 text-blue-600 ml-4" />
                  <h2 className="text-xl font-bold text-blue-800 p-3 pl-0">All Vouchers</h2>
                </>
              )}

              {/* View Toggle Button */}
              <div className={`${hideHeading ? '' : 'sm:ml-6'} flex items-center rounded-lg p-1 w-full sm:w-auto mt-2 sm:mt-0`}>
                <button
                  onClick={() => setListViewType('table')}
                  className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${listViewType === 'table'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-300'
                    : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  <List className="h-4 w-4 mr-1" />
                  Table View
                </button>
                <button
                  onClick={() => setListViewType('card')}
                  className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${listViewType === 'card'
                    ? 'bg-white text-blue-700 shadow-sm border border-blue-300'
                    : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                  <Grid3X3 className="h-4 w-4 mr-1" />
                  Card View
                </button>

              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto sm:justify-end">
          {viewMode === 'list' && (
            <>
              <button
                onClick={onCreateVoucher}
                className="flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 w-full sm:w-auto justify-center"
              >
                <PlusCircle className="h-5 w-5 mr-2" />
                Create Voucher
              </button>
              <button
                onClick={fetchAllVouchers}
                className="flex items-center px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-md transition-colors duration-200 w-full sm:w-auto justify-center"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </button>
            </>
          )}

          {viewMode === 'details' && selectedVoucher && (
            <>
              <button
                onClick={() => handleEdit(selectedVoucher)}
                className="flex items-center px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors duration-200"
              >
                Edit
              </button>
              <button
                onClick={() => handlePrint(selectedVoucher)}
                className="flex items-center px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors duration-200"
              >
                <Printer className="h-4 w-4 mr-1" />
                Print Preview
              </button>
              <button
                onClick={() => handleTrack(selectedVoucher)}
                className="flex items-center px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors duration-200"
              >
                <ActivitySquare className="h-4 w-4 mr-1" />
                Track
              </button>
            </>
          )}

          {viewMode === 'workflow' && selectedVoucher && (
            <button
              onClick={() => setViewMode('details')}
              className="flex items-center px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors duration-200"
            >
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : viewMode === 'workflow' && selectedVoucher ? (
        // Workflow tracking view
        <VoucherWorkflowTracker voucherId={selectedVoucher.id} />
      ) : viewMode === 'details' && selectedVoucher ? (
        <VoucherDetails
          voucher={selectedVoucher}
          onClose={() => setViewMode('list')}
        />
      ) : vouchers.length === 0 ? (
        <div className="bg-blue-50 rounded-lg p-12 text-center">
          <div className="flex flex-col items-center justify-center">
            <FileText className="h-16 w-16 text-blue-300 mb-4" />
            <h3 className="text-xl font-medium text-blue-800 mb-2">No vouchers found</h3>
            <p className="text-blue-600 mb-6">Create your first voucher to get started</p>
            <button
              onClick={onCreateVoucher}
              className="flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              Create Voucher
            </button>
          </div>
        </div>
      ) : listViewType === 'table' ? (
        // Table View
        <div className="space-y-4">
          {/* Filter and Search UI */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              {/* Search Bar */}
              <div className="relative flex-grow max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-3 w-3 text-blue-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search vouchers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !dateError) {
                      handleSearch();
                    }
                  }}
                  className={`pl-8 block w-full rounded-md border border-blue-300 py-1.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm ${!showFilters ? 'pr-20' : 'pr-4'}`}
                />
                {!showFilters && (
                  <button
                    onClick={handleSearch}
                    disabled={!!dateError}
                    className={`absolute right-1 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs rounded transition-colors ${dateError
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      : 'text-white bg-blue-600 hover:bg-blue-700'
                      }`}
                  >
                    Search
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-1.5 rounded-md border ${showFilters ? 'bg-blue-100 border-blue-400' : 'border-blue-300'} flex items-center gap-1 text-blue-600 hover:bg-blue-50 text-sm`}
              >
                <Filter className="h-3 w-3" />
                <span>Filter</span>
              </button>
            </div>

            {/* Filter panel */}
            {showFilters && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Date Range */}
                  <div className="space-y-2">
                    <label className="text-xs text-blue-700">Date Range:</label>
                    <div className="space-y-1">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          const validation = validateDateRange(e.target.value, endDate);
                          setDateError(validation.error || '');
                        }}
                        className="w-full px-2 py-1 border border-blue-300 rounded text-xs"
                        placeholder="Start Date"
                      />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          const validation = validateDateRange(startDate, e.target.value);
                          setDateError(validation.error || '');
                        }}
                        className="w-full px-2 py-1 border border-blue-300 rounded text-xs"
                        placeholder="End Date"
                      />
                      {dateError && (
                        <div className="text-xs text-red-600">{dateError}</div>
                      )}
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-2">
                    <label className="text-xs text-blue-700">Status:</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-2 py-1 border border-blue-300 rounded text-xs"
                    >
                      <option value="">All</option>
                      <option value="Dispatched">Dispatched</option>
                      <option value="Received">Received</option>
                      <option value="Forwarded">Forwarded</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  {/* Job Work Filter */}
                  <div className="space-y-2">
                    <label className="text-xs text-blue-700">Job Work:</label>
                    <select
                      value={jobWorkFilter}
                      onChange={(e) => setJobWorkFilter(e.target.value)}
                      className="w-full px-2 py-1 border border-blue-300 rounded text-xs"
                    >
                      <option value="">All</option>
                      {jobWorkNames.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <label className="text-xs text-blue-700">&nbsp;</label>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSearch}
                        disabled={!!dateError}
                        className={`flex items-center gap-1 px-3 py-1 text-xs rounded transition-colors ${dateError
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          : 'text-white bg-blue-600 hover:bg-blue-700'
                          }`}
                      >
                        <Search className="h-3 w-3" />
                        Search
                      </button>
                      <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Summary */}
            <div className="mt-3 text-sm text-blue-600">
              {filteredVouchers.length === 0 && (appliedSearchTerm || appliedStartDate || appliedEndDate || appliedStatusFilter || appliedJobWorkFilter) ? (
                <div className="text-red-600">Nothing found under this filter</div>
              ) : (
                `Showing ${filteredVouchers.length} of ${vouchers.length} vouchers`
              )}
            </div>
          </div>

          {/* No Results Message */}
          {filteredVouchers.length === 0 && (appliedSearchTerm || appliedStartDate || appliedEndDate || appliedStatusFilter || appliedJobWorkFilter) ? (
            <div className="bg-gray-50 rounded-lg p-12 text-center border-2 border-dashed border-gray-300">
              <div className="flex flex-col items-center justify-center">
                <Search className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-xl font-medium text-gray-600 mb-2">No vouchers found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your search criteria or filters</p>
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <X className="h-4 w-4" />
                  Clear all filters
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden print-table-container">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 print-table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SN</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print-hide">Image</th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('voucher_no')}
                      >
                        <div className="flex items-center">
                          Voucher No
                          {sortField === 'voucher_no' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('created_at')}
                      >
                        <div className="flex items-center">
                          Voucher Date
                          {sortField === 'created_at' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('created_by')}
                      >
                        <div className="flex items-center">
                          Voucher Created By
                          {sortField === 'created_by' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('item_name')}
                      >
                        <div className="flex items-center">
                          Item
                          {sortField === 'item_name' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('quantity')}
                      >
                        <div className="flex items-center">
                          Qty
                          {sortField === 'quantity' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('job_work')}
                      >
                        <div className="flex items-center">
                          Job Work
                          {sortField === 'job_work' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('vendor_name')}
                      >
                        <div className="flex items-center">
                          Vendor Details
                          {sortField === 'vendor_name' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('vendor_code')}
                      >
                        <div className="flex items-center">
                          Vendor Code
                          {sortField === 'vendor_code' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('lr_date')}
                      >
                        <div className="flex items-center">
                          LR Date
                          {sortField === 'lr_date' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('lr_number')}
                      >
                        <div className="flex items-center">
                          LR Number
                          {sortField === 'lr_number' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('transport_name')}
                      >
                        <div className="flex items-center">
                          Transport Name
                          {sortField === 'transport_name' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center">
                          Status
                          {sortField === 'status' ? (
                            <ChevronRight className={`h-4 w-4 ml-1 ${sortDirection === 'asc' ? 'rotate-90' : '-rotate-90'}`} />
                          ) : (
                            <ChevronRight className="h-4 w-4 ml-1 text-gray-400 rotate-90" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider print-hide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredVouchers.map((voucher, index) => (
                      <tr
                        key={voucher.id}
                        ref={persistentHighlightedVoucherId === voucher.id ? highlightedVoucherRef : null}
                        className={
                          persistentHighlightedVoucherId === voucher.id
                            ? persistentViewMode === 'details'
                              ? 'bg-green-50 border-2 border-green-300 hover:bg-green-100' // More prominent highlighting for details view
                              : 'bg-yellow-50 border-2 border-yellow-300 hover:bg-yellow-100' // Regular highlighting for other views
                            : 'hover:bg-gray-50'
                        }
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            {persistentHighlightedVoucherId === voucher.id && (
                              <ChevronRight className="h-5 w-5 text-orange-500 mr-2 animate-pulse" />
                            )}
                            <span>{index + 1}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap print-hide">
                          {voucher.item_details.images && voucher.item_details.images.length > 0 ? (
                            <ImageContainer
                              images={voucher.item_details.images}
                              size="sm"
                              className="rounded-lg"
                            />
                          ) : (
                            <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button
                            onClick={() => handleView(voucher)}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer transition-colors"
                            title="Click to view voucher details"
                          >
                            {voucher.voucher_no}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(voucher.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{(voucher as any).createdByName || 'N/A'}</div>
                            <div className="text-xs text-gray-500">{(voucher as any).createdByCode || 'N/A'}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {voucher.item_details.item_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatIndianQuantity(voucher.item_details.initial_quantity)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(voucher as any).vendorJobWork || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{(voucher as any).vendorName || 'N/A'}</div>
                            {(voucher as any).companyName && (voucher as any).companyName !== (voucher as any).vendorName && (voucher as any).companyName !== 'N/A' && (
                              <div className="text-xs text-gray-500">{(voucher as any).companyName}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(voucher as any).userCode ?? 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(() => {
                            const lrDate = voucher.events.find(e => e.event_type === 'dispatch')?.details.transport?.lr_date;
                            if (!lrDate) return 'N/A';
                            const dateObj = new Date(lrDate);
                            if (isNaN(dateObj.getTime())) return 'N/A';
                            const day = dateObj.getDate().toString().padStart(2, '0');
                            const month = dateObj.toLocaleString('en-GB', { month: 'short' });
                            const year = dateObj.getFullYear();
                            return `${day} ${month} ${year}`;
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {voucher.events.find(e => e.event_type === 'dispatch')?.details.transport?.lr_no || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {voucher.events.find(e => e.event_type === 'dispatch')?.details.transport?.transporter_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(voucher.voucher_status)}`}>
                            {formatVoucherStatus(voucher.voucher_status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium print-hide">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleTrack(voucher)}
                              className="text-purple-600 hover:text-purple-900 transition-colors"
                              title="Track"
                            >
                              <ActivitySquare className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(voucher)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleView(voucher)}
                              className="text-green-600 hover:text-green-900 transition-colors"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handlePrint(voucher)}
                              className="text-gray-600 hover:text-gray-900 transition-colors"
                              title="Print Preview"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Card View (existing)
        <VoucherCardGrid
          vouchers={vouchers}
          onView={handleView}
          onPrint={handlePrint}
          onTrack={handleTrack}
          onEdit={handleEdit}
        />
      )}

      {/* Alternate Print Preview Modal (specific to All Vouchers page) */}
      <AlternatePrintPreviewModal
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
