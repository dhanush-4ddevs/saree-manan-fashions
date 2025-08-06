'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, X, Calendar } from 'lucide-react';
import { Voucher } from '@/types/voucher';
import { VoucherCard } from '@/components/admin/AdminVoucherCard';
import { getCurrentDateString, validateDateRange } from '@/utils/dateFormatter';
import { useJobWorks } from '@/hooks/useJobWorks';

interface VoucherCardGridProps {
  vouchers: Voucher[];
  onView: (voucher: Voucher) => void;
  onPrint: (voucher: Voucher) => void;
  onTrack?: (voucher: Voucher) => void;
  onEdit?: (voucher: Voucher) => void;
}

export function VoucherCardGrid({ vouchers, onView, onPrint, onTrack, onEdit }: VoucherCardGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(getCurrentDateString()); // Auto-fill current date
  const [statusFilter, setStatusFilter] = useState('');
  const [jobWorkFilter, setJobWorkFilter] = useState('');
  const [dateError, setDateError] = useState<string>('');

  // Use the job works hook
  const { jobWorkNames, loading: jobWorksLoading, error: jobWorksError } = useJobWorks();

  // Separate state for applied filters (only updated when search is clicked)
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('');
  const [appliedJobWorkFilter, setAppliedJobWorkFilter] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');

  // Auto-fill current date when component mounts
  useEffect(() => {
    setEndDate(getCurrentDateString());
  }, []);

  const filterVouchers = () => {
    return vouchers.filter((voucher) => {
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

  const filteredVouchers = useMemo(() => filterVouchers(), [vouchers, appliedSearchTerm, appliedStartDate, appliedEndDate, appliedStatusFilter, appliedJobWorkFilter]);

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

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    if (field === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }

    // Validate dates immediately when they change (but don't apply filters yet)
    if ((field === 'start' && value && endDate) || (field === 'end' && value && startDate)) {
      const validation = validateDateRange(field === 'start' ? value : startDate, field === 'end' ? value : endDate);
      if (!validation.isValid) {
        setDateError(validation.error || '');
      } else {
        setDateError('');
      }
    } else {
      setDateError(''); // Clear error when user changes dates
    }
  };

  return (
    <div>
      {/* Search and filter bar */}
      <div className="mb-3 flex flex-wrap gap-2">
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
              className={`absolute right-1 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs rounded transition-colors ${
                dateError
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
        <div className="p-3 bg-blue-50 rounded-md mb-3 border border-blue-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-blue-700">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-100"
              title="Close filters"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-blue-700">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className={`px-2 py-1 border rounded text-xs ${dateError ? 'border-red-300 bg-red-50' : 'border-blue-300'}`}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-blue-700">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className={`px-2 py-1 border rounded text-xs ${dateError ? 'border-red-300 bg-red-50' : 'border-blue-300'}`}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-blue-700">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1 border border-blue-300 rounded text-xs"
              >
                <option value="">All</option>
                <option value="Dispatched">Dispatched</option>
                <option value="Received">Received</option>
                <option value="Forwarded">Forwarded</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-blue-700">Job Work:</label>
              <select
                value={jobWorkFilter}
                onChange={(e) => setJobWorkFilter(e.target.value)}
                className="px-2 py-1 border border-blue-300 rounded text-xs"
              >
                <option value="">All</option>
                {jobWorkNames.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSearch}
              disabled={!!dateError}
              className={`flex items-center gap-1 px-3 py-1 text-xs rounded transition-colors ${
                dateError
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'text-white bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Search className="h-3 w-3" />
              Search
            </button>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </div>
          {dateError && (
            <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <X className="h-3 w-3" />
              {dateError}
            </div>
          )}
        </div>
      )}

      {/* Active filters indicator */}
      {(appliedSearchTerm || appliedStartDate || appliedEndDate || appliedStatusFilter || appliedJobWorkFilter) && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-md">
          <div className="text-xs text-green-700 font-medium mb-1">Active Filters:</div>
          <div className="flex flex-wrap gap-2 text-xs text-green-600">
            {appliedSearchTerm && (
              <span className="bg-green-100 px-2 py-1 rounded">Search: "{appliedSearchTerm}"</span>
            )}
            {appliedStartDate && (
              <span className="bg-green-100 px-2 py-1 rounded">From: {new Date(appliedStartDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            )}
            {appliedEndDate && (
              <span className="bg-green-100 px-2 py-1 rounded">To: {new Date(appliedEndDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            )}
            {appliedStatusFilter && (
              <span className="bg-green-100 px-2 py-1 rounded">Status: {appliedStatusFilter}</span>
            )}
            {appliedJobWorkFilter && (
              <span className="bg-green-100 px-2 py-1 rounded">Job Work: {appliedJobWorkFilter}</span>
            )}
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="mb-3 text-sm text-blue-600">
        {filteredVouchers.length === 0 && (appliedSearchTerm || appliedStartDate || appliedEndDate || appliedStatusFilter || appliedJobWorkFilter) ? (
          <div className="text-red-600">Nothing found under this filter</div>
        ) : (
          `Showing ${filteredVouchers.length} of ${vouchers.length} vouchers`
        )}
      </div>

      {/* Voucher cards grid */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredVouchers.map((voucher) => (
            <VoucherCard
              key={voucher.id}
              voucher={voucher}
              onView={onView}
              onPrint={onPrint}
              onTrack={onTrack}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
