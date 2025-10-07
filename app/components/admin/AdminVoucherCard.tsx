'use client';

import { Voucher } from '@/types/voucher';
import Image from 'next/image';
import { Eye, Printer, Calendar, User, Wrench, Package, ActivitySquare, Split, Edit, Shield } from 'lucide-react';
import { formatIndianQuantity } from '@/lib/format';
import { generateVoucherPDF } from '@/utils/pdfGenerator';
import { PrintPreviewModal } from '../shared/PrintPreviewModal';
import { useState, useEffect } from 'react';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface VoucherCardProps {
  voucher: Voucher & { vendorName?: string };
  onView: (voucher: Voucher) => void;
  onPrint: (voucher: Voucher) => void;
  onTrack?: (voucher: Voucher) => void;
  onEdit?: (voucher: Voucher) => void;
}

export function VoucherCard({ voucher, onView, onPrint, onTrack, onEdit }: VoucherCardProps) {
  const [adminName, setAdminName] = useState<string>('Loading...');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const capitalize = (s: string) => {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  // Get status color based on voucher status
  const getStatusBackground = (status: string) => {
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Dispatched':
        return 'text-yellow-800';
      case 'Received':
        return 'text-blue-800';
      case 'Forwarded':
        return 'text-indigo-800';
      case 'Completed':
        return 'text-green-800';
      default:
        return 'text-gray-800';
    }
  };

  // Function to format date (from YYYY-MM-DD to DD-MMM-YYYY)
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Fetch admin name
  useEffect(() => {
    const fetchAdminName = async () => {
      if (voucher.created_by_user_id) {
        try {
          const adminDoc = await getDoc(doc(db, 'users', voucher.created_by_user_id));
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            const firstName = adminData.firstName || '';
            const surname = adminData.surname || '';
            const fullName = `${firstName} ${surname}`.trim();
            setAdminName(fullName || 'Unknown Admin');
          } else {
            setAdminName('Unknown Admin');
          }
        } catch (error) {
          console.error('Error fetching admin name:', error);
          setAdminName('Unknown Admin');
        }
      } else {
        setAdminName('Unknown Admin');
      }
    };

    fetchAdminName();
  }, [voucher.created_by_user_id]);

  const handleViewClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onView(voucher);
  };

  const handlePrintClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPrintPreview(true);
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onTrack) {
      onTrack(voucher);
    } else {
      onView(voucher);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit) {
      onEdit(voucher);
    }
  };

  const dispatchEvent = voucher.events.find(e => e.event_type === 'dispatch');
  const jobWork = dispatchEvent?.details.jobWork || 'N/A';
  const transport = dispatchEvent?.details.transport;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden p-5">

      {/* Voucher ID and status */}
      <div className="flex justify-between items-start mb-1">
        <div>
          <button
            onClick={handleViewClick}
            className="text-blue-600 hover:text-blue-800 hover:underline text-lg font-bold cursor-pointer transition-colors"
            title="Click to view voucher details"
          >
            {voucher.voucher_no}
          </button>
        </div>
        <span className={`px-4 py-1 rounded-full text-xs font-medium ${getStatusBackground(voucher.voucher_status)} ${getStatusText(voucher.voucher_status)}`}>
          {capitalize(voucher.voucher_status)}
        </span>
      </div>

      {/* Date */}
      <div className="flex items-center mb-4">
        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
        <p className="text-gray-500 text-sm">{formatDate(voucher.created_at)}</p>
      </div>

      {/* Admin info */}
      <div className="flex items-center mb-2">
        <Shield className="h-4 w-4 text-gray-400 mr-2" />
        <p className="text-gray-700">Admin: {adminName}</p>
      </div>

      {/* Item info */}
      <div className="flex items-center mb-2">
        <Package className="h-4 w-4 text-gray-400 mr-2" />
        <p className="text-gray-700">
          {voucher.item_details.item_name} - {formatIndianQuantity(dispatchEvent?.details.quantity_dispatched || voucher.item_details.initial_quantity)} pieces
        </p>
      </div>

      {/* Vendor info */}
      <div className="flex items-center mb-2">
        <User className="h-4 w-4 text-gray-400 mr-2" />
        <p className="text-gray-700">Vendor: {voucher.vendorName || 'N/A'}</p>
      </div>

      {/* Job work */}
      <div className="flex items-center mb-2">
        <Wrench className="h-4 w-4 text-gray-400 mr-2" />
        <p className="text-gray-700">Job: {jobWork}</p>
      </div>

      {/* Transport info */}
      {transport && (
        <div className="flex items-center mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 011.414-1.414l4 4z" clipRule="evenodd" />
          </svg>
          <p className="text-gray-700">
            {transport.transporter_name} - LR: {transport.lr_no}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-between mt-5 pt-3 border-t border-gray-100">
        <button
          onClick={handleViewClick}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <Eye size={18} />
          <span className="text-sm font-medium">View Details</span>
        </button>

        <div className="flex gap-4">
          {onEdit && (
            <button
              onClick={handleEditClick}
              className="text-green-600 hover:text-green-800 cursor-pointer"
              title="Edit Voucher"
            >
              <Edit size={18} />
            </button>
          )}
          <button
            onClick={handlePrintClick}
            className="text-gray-500 hover:text-blue-800"
            title="Print Preview"
          >
            <Printer size={18} />
          </button>
          <button
            onClick={handleTrackClick}
            className="text-purple-500 hover:text-purple-800"
            title="Track Voucher"
          >
            <ActivitySquare size={18} />
          </button>
        </div>
      </div>

      {/* Print Preview Modal */}
      <PrintPreviewModal
        voucher={voucher}
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
      />
    </div>
  );
}
