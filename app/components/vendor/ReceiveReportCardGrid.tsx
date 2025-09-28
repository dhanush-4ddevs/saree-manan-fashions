'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, X, SortAsc, SortDesc, ArrowUpDown } from 'lucide-react';
import { ReceiveReportCard } from './ReceiveReportCard';

interface ReceiveItem {
  id: string;
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
  senderName: string;
  senderType: 'admin' | 'vendor';
  isForwarded?: boolean;
}

interface ReceiveReportCardGridProps {
  items: ReceiveItem[];
  onEdit: (id: string) => void;
  onSave: (id: string) => void;
  onCancel: (id: string) => void;
  onInputChange: (id: string, field: string, value: any) => void;
  editingVoucherId: string | null;
  formData: { [key: string]: any };
  saving: boolean;
  searchTerm: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  onSearchChange: (term: string) => void;
  onClearSearch: () => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  jobWorkFilter: string;
  onJobWorkFilterChange: (jobWork: string) => void;
  uniqueStatuses: string[];
  uniqueJobWorks: string[];
}

export function ReceiveReportCardGrid({
  items,
  onEdit,
  onSave,
  onCancel,
  onInputChange,
  editingVoucherId,
  formData,
  saving,
  searchTerm,
  sortField,
  sortDirection,
  onSort,
  onSearchChange,
  onClearSearch,
  showFilters,
  onToggleFilters,
  statusFilter,
  onStatusFilterChange,
  jobWorkFilter,
  onJobWorkFilterChange,
  uniqueStatuses,
  uniqueJobWorks
}: ReceiveReportCardGridProps) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = React.useRef<HTMLDivElement>(null);

  const applyFiltersAndSearch = () => {
    let filtered = [...items];

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
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

    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    if (jobWorkFilter !== 'all') {
      filtered = filtered.filter(item => item.jobWork === jobWorkFilter);
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

    return filtered;
  };

  const filteredItems = useMemo(() => applyFiltersAndSearch(), [items, searchTerm, sortField, sortDirection, statusFilter, jobWorkFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSortMenu && sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSortMenu]);

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button onClick={onClearSearch} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
                  <select value={sortField} onChange={(e) => onSort(e.target.value)} className="w-full p-2 border rounded-md">
                    <option value="voucherDate">Voucher Date</option>
                    <option value="voucherNo">Voucher No</option>
                    <option value="item">Item</option>
                    <option value="jobWork">Job Work</option>
                    <option value="status">Status</option>
                  </select>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => onSort(sortField)} className={`flex-1 p-2 rounded-md ${sortDirection === 'asc' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                      <SortAsc className="h-4 w-4 mx-auto" />
                    </button>
                    <button onClick={() => onSort(sortField)} className={`flex-1 p-2 rounded-md ${sortDirection === 'desc' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                      <SortDesc className="h-4 w-4 mx-auto" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={onToggleFilters} className="flex items-center px-3 py-2 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
              <Filter className="h-4 w-4 mr-2" /> Filters
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className="p-2 border rounded-md">
              <option value="all">All Statuses</option>
              {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={jobWorkFilter} onChange={(e) => onJobWorkFilterChange(e.target.value)} className="p-2 border rounded-md">
              <option value="all">All Job Works</option>
              {uniqueJobWorks.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredItems.length} of {items.length} vouchers.
        </div>
      </div>

      {/* Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <div className="flex flex-col items-center justify-center">
            <Search className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-600 mb-2">No vouchers found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your search criteria or filters</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <ReceiveReportCard
              key={item.id}
              item={item}
              isEditing={editingVoucherId === item.id}
              currentData={formData[item.id] || {}}
              onEdit={onEdit}
              onSave={onSave}
              onCancel={onCancel}
              onInputChange={onInputChange}
              saving={saving}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
}
