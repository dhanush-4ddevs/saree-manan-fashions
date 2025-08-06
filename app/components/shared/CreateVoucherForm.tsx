'use client';

import { useState, useEffect } from 'react';
import { VoucherForm, VoucherFormSubmitData } from './VoucherForm';
import { Voucher, VoucherEvent, generateEventId } from '@/types/voucher';
import { getNextAvailableVoucherNumber, VoucherNumberOptions } from '@/utils/voucherNumberGenerator';
import { serverTimestamp } from 'firebase/firestore';
import { getCurrentUser } from '@/config/firebase';
import { getCurrentISTTime } from '@/utils/dateFormatter';

interface CreateVoucherFormProps {
  onSubmit: (voucher: Voucher) => Promise<void>;
  onSuccess?: () => void;
}

export function CreateVoucherForm({ onSubmit, onSuccess }: CreateVoucherFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialVoucherNo, setInitialVoucherNo] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchVoucherNumber = async () => {
      const options: VoucherNumberOptions = { strategy: 'financial_year' };
      const voucherNo = await getNextAvailableVoucherNumber(options);
      setInitialVoucherNo(voucherNo);
    };

    const fetchCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };

    fetchVoucherNumber();
    fetchCurrentUser();
  }, []);

  const handleVoucherSubmit = async (data: VoucherFormSubmitData) => {
    setIsSubmitting(true);
    try {
      const { formData, images } = data;
      const imageUrls = images.map(img => img.watermarkedDataUrl);
      const voucherNo = initialVoucherNo;

      const newVoucher: Voucher = {
        voucher_no: voucherNo,
        voucher_status: 'Dispatched',
        created_at: new Date(formData.voucherDate).toISOString(),
        created_by_user_id: currentUser?.uid || 'unknown',
        item_details: {
          item_name: formData.item,
          images: imageUrls,
          initial_quantity: formData.quantity,
          supplier_name: formData.supplierName,
          supplier_price_per_piece: formData.supplierPrice,
        },
        events: [
          {
            event_id: generateEventId(voucherNo, 1),
            event_type: 'dispatch',
            timestamp: getCurrentISTTime(),
            user_id: currentUser?.uid || 'unknown',
            comment: formData.comment || 'Initial dispatch',
            details: {
              jobWork: formData.jobWork,
              sender_id: currentUser?.uid || 'unknown',
              receiver_id: formData.vendorUserId,
              quantity_dispatched: formData.quantity,
              transport: {
                lr_no: formData.lrNumber,
                lr_date: formData.lrDate,
                transporter_name: formData.transportName,
              },
            },
          },
        ],
        // Initialize status tracking fields
        total_dispatched: formData.quantity,
        total_received: 0,
        total_forwarded: 0,
        total_missing_on_arrival: 0,
        total_damaged_on_arrival: 0,
        total_damaged_after_work: 0,
        admin_received_quantity: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await onSubmit(newVoucher);

      // Fetch the next voucher number for the subsequent form
      const options: VoucherNumberOptions = { strategy: 'financial_year' };
      const nextVoucherNo = await getNextAvailableVoucherNumber(options);
      setInitialVoucherNo(nextVoucherNo);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error creating voucher:", error);
      alert('Failed to create voucher. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <VoucherForm
      onSubmit={handleVoucherSubmit}
      initialVoucherNo={initialVoucherNo}
      isSubmitting={isSubmitting}
      onSuccess={onSuccess}
    />
  );
}
