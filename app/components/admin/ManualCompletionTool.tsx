'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Voucher } from '@/types/voucher';
import { getCurrentUser } from '@/config/firebase';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, FileText, Database } from 'lucide-react';
import { manuallyMarkVoucherComplete } from '@/utils/voucherCompletionUtils';
import { determineNewStatus, updateVoucherStatus } from '@/utils/voucherStatusManager';

interface ManualCompletionToolProps {
  voucherId?: string; // Optional: if provided, will load specific voucher
}

export default function ManualCompletionTool({ voucherId }: ManualCompletionToolProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [adminUid, setAdminUid] = useState<string | null>(null);
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);
  const [bulkUpdateProgress, setBulkUpdateProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user && user.role === 'admin') {
          setAdminUid(user.uid);
          if (voucherId) {
            await fetchSpecificVoucher(voucherId);
          } else {
            await fetchVouchers();
          }
        } else {
          setError('Unauthorized access. Admin privileges required.');
        }
      } catch (error) {
        setError('Failed to authenticate user');
      }
    };

    fetchCurrentUser();
  }, [voucherId]);

  const fetchSpecificVoucher = async (id: string) => {
    // Implementation for fetching specific voucher
  };

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch vouchers that are in 'Received' or 'Forwarded' status (handle both cases)
      const vouchersRef = collection(db, 'vouchers');
      const q = query(
        vouchersRef,
        where('voucher_status', 'in', [
          'Received', 'received',
          'Forwarded', 'forwarded'
        ])
      );

      const querySnapshot = await getDocs(q);
      const vouchersData: Voucher[] = [];

      querySnapshot.forEach((doc) => {
        const voucher = { ...doc.data(), id: doc.id } as Voucher;
        vouchersData.push(voucher);
      });

      setVouchers(vouchersData);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      setError('Failed to fetch vouchers');
    } finally {
      setLoading(false);
    }
  };

  const analyzeVoucher = (voucher: Voucher) => {
    // Implementation for analyzing voucher
  };

  const handleVoucherSelect = (voucher: Voucher) => {
    setSelectedVoucher(voucher);
  };

  const handleManualComplete = async () => {
    // Implementation for manual completion
  };

  // New function to rerun status logic for all vouchers
  const rerunStatusLogicForAllVouchers = async () => {
    try {
      setBulkUpdateLoading(true);
      setError(null);
      setSuccess(null);

      // Fetch all vouchers
      const vouchersRef = collection(db, 'vouchers');
      const querySnapshot = await getDocs(vouchersRef);
      const allVouchers: Voucher[] = [];

      querySnapshot.forEach((doc) => {
        const voucher = { ...doc.data(), id: doc.id } as Voucher;
        allVouchers.push(voucher);
      });

      setBulkUpdateProgress({ current: 0, total: allVouchers.length });

      let updatedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < allVouchers.length; i++) {
        const voucher = allVouchers[i];
        setBulkUpdateProgress({ current: i + 1, total: allVouchers.length });

        try {
          // Get the latest event to determine what type of event it was
          const events = voucher.events || [];
          if (events.length === 0) continue;

          const latestEvent = events[events.length - 1];
          let newStatus = voucher.voucher_status; // Default to current status

          // Determine new status based on the latest event
          if (latestEvent.event_type === 'dispatch') {
            newStatus = determineNewStatus(voucher, 'dispatch');
          } else if (latestEvent.event_type === 'receive') {
            newStatus = determineNewStatus(voucher, 'receive', latestEvent);
          } else if (latestEvent.event_type === 'forward') {
            newStatus = determineNewStatus(voucher, 'forward', latestEvent);
          }

          // Only update if status has changed
          if (newStatus !== voucher.voucher_status) {
            const statusUpdate = updateVoucherStatus(voucher, newStatus);

            await updateDoc(doc(db, 'vouchers', voucher.id!), {
              ...statusUpdate,
              updatedAt: new Date().toISOString()
            });

            updatedCount++;
            console.log(`Updated voucher ${voucher.voucher_no}: ${voucher.voucher_status} → ${newStatus}`);
          }
        } catch (error) {
          console.error(`Error updating voucher ${voucher.voucher_no}:`, error);
          errorCount++;
        }
      }

      setSuccess(`Status logic rerun completed! Updated ${updatedCount} vouchers. ${errorCount} errors.`);
      await fetchVouchers(); // Refresh the list
    } catch (error) {
      console.error('Error in bulk status update:', error);
      setError('Failed to rerun status logic for all vouchers');
    } finally {
      setBulkUpdateLoading(false);
      setBulkUpdateProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-blue-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <FileText className="h-8 w-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800">Manual Completion Tool</h1>
        </div>

        {/* Bulk Status Update Button */}
        <button
          onClick={rerunStatusLogicForAllVouchers}
          disabled={bulkUpdateLoading}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 transition-colors"
        >
          <Database className="h-5 w-5 mr-2" />
          {bulkUpdateLoading ? 'Updating...' : 'Rerun Status Logic for All Vouchers'}
        </button>
      </div>

      {/* Progress indicator */}
      {bulkUpdateLoading && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">
              Updating voucher statuses...
            </span>
            <span className="text-sm text-blue-600">
              {bulkUpdateProgress.current} / {bulkUpdateProgress.total}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(bulkUpdateProgress.current / bulkUpdateProgress.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">{success}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Existing content */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Vouchers Available for Manual Completion</h2>
        <p className="text-sm text-gray-600 mb-4">
          This tool allows you to manually complete vouchers that may have status discrepancies.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-blue-600">Loading vouchers...</span>
        </div>
      ) : vouchers.length === 0 ? (
        <div className="text-center p-8 text-gray-500">
          <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No vouchers found that need manual completion.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {vouchers.map((voucher) => (
            <div
              key={voucher.id}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => handleVoucherSelect(voucher)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-800">{voucher.voucher_no}</h3>
                  <p className="text-sm text-gray-600">
                    {voucher.item_details?.item_name} - Status: {voucher.voucher_status}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-500">
                    Created: {new Date(voucher.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Voucher Details */}
      {selectedVoucher && (
        <div className="mt-6 p-4 border border-blue-200 rounded-lg bg-blue-50">
          <h3 className="font-semibold text-blue-800 mb-2">Selected Voucher: {selectedVoucher.voucher_no}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Status:</span> {selectedVoucher.voucher_status}
            </div>
            <div>
              <span className="font-medium">Item:</span> {selectedVoucher.item_details?.item_name}
            </div>
            <div>
              <span className="font-medium">Total Dispatched:</span> {selectedVoucher.total_dispatched}
            </div>
            <div>
              <span className="font-medium">Admin Received:</span> {selectedVoucher.admin_received_quantity}
            </div>
          </div>
          <button
            onClick={handleManualComplete}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Manually Complete This Voucher
          </button>
        </div>
      )}
    </div>
  );
}
