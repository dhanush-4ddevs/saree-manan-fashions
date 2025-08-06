'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { VoucherForm, VoucherFormSubmitData } from '@/components/shared/VoucherForm';
import { Voucher } from '@/types/voucher';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getCurrentUser } from '@/config/firebase';
import { notificationService } from '@/utils/notificationService';
import { uploadImageFromDataUrl } from '@/utils/imageUpload';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { ImageWithWatermark } from '@/utils/imageUtils';

function EditVoucherContent({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [id, setId] = useState<string>('');

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!id) return;

    const fetchVoucher = async () => {
      try {
        const voucherDoc = await getDoc(doc(db, 'vouchers', id));
        if (voucherDoc.exists()) {
          const voucherData = voucherDoc.data() as Voucher;
          setVoucher({
            ...voucherData,
            id: voucherDoc.id
          });
        } else {
          console.error('Voucher not found');
          router.push('/admin-dashboard/vouchers');
        }
      } catch (error) {
        console.error('Error fetching voucher:', error);
      }
    };

    fetchVoucher();
  }, [id, router]);

  const handleVoucherSubmit = async (data: VoucherFormSubmitData) => {
    if (!voucher) return;

    try {
      setIsSubmitting(true);
      const { formData, images } = data;

      let currentUser;
      try {
        currentUser = await getCurrentUser();
        if (!currentUser) {
          throw new Error('User not authenticated. Please log in again.');
        }
      } catch (error) {
        console.error('Authentication error:', error);
        setIsSubmitting(false);
        return;
      }

      // Handle image uploads and updates
      const updatedImageUrls = await Promise.all(
        images.map(async (image: ImageWithWatermark) => {
          if (image.dataUrl.startsWith('data:')) {
            // New image, upload it
            return await uploadImageFromDataUrl(
              image.dataUrl,
              'vouchers',
              `voucher_${voucher.voucher_no}_${Date.now()}.jpg`
            );
          }
          // Existing image, return URL
          return image.dataUrl;
        })
      );

      // Find the dispatch event to update
      const dispatchEventIndex = voucher.events.findIndex(e => e.event_type === 'dispatch');
      if (dispatchEventIndex === -1) {
        throw new Error("Dispatch event not found, cannot update voucher.");
      }

      const updatedVoucher: Partial<Voucher> = {
        item_details: {
          ...voucher.item_details,
          item_name: formData.item,
          initial_quantity: formData.quantity,
          supplier_name: formData.supplierName,
          supplier_price_per_piece: formData.supplierPrice,
          images: updatedImageUrls,
        },
        events: voucher.events.map((event, index) => {
          if (index === dispatchEventIndex) {
            return {
              ...event,
              comment: formData.comment,
              details: {
                ...event.details,
                jobWork: formData.jobWork,
                receiver_id: formData.vendorUserId,
                transport: {
                  lr_no: formData.lrNumber,
                  lr_date: formData.lrDate,
                  transporter_name: formData.transportName,
                },
              },
            };
          }
          return event;
        }),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      };

      await updateDoc(doc(db, 'vouchers', id), updatedVoucher);

      // Handle vendor notifications
      const originalReceiverId = voucher.events[dispatchEventIndex]?.details.receiver_id;
      const newReceiverId = formData.vendorUserId;

      if (newReceiverId && newReceiverId !== originalReceiverId) {
        // A new vendor has been assigned, or the vendor has changed.
        try {
          await notificationService.sendVoucherAssignmentNotification({
            vendorUserId: newReceiverId,
            voucherNo: voucher.voucher_no,
            voucherId: id,
            itemName: voucher.item_details.item_name,
            quantity: voucher.item_details.initial_quantity,
            isForwarded: false,
            senderName: 'Admin'
          });
        } catch (notificationError) {
          console.error(`Failed to send assignment notification to new vendor ${newReceiverId}:`, notificationError);
        }

        if (originalReceiverId) {
          // Notify the original vendor of the change
          try {
            await notificationService.createVendorNotification({
              vendorUserId: originalReceiverId,
              title: 'Voucher Re-assigned',
              message: `Voucher ${voucher.voucher_no} has been re-assigned to another vendor.`,
              voucherNo: voucher.voucher_no,
              voucherId: id,
              type: 'voucher_reassignment'
            });
          } catch (notificationError) {
            console.error(`Failed to send un-assignment notification to original vendor ${originalReceiverId}:`, notificationError);
          }
        }
      }

      console.log(`Voucher ${voucher.voucher_no} updated successfully!`);
      router.push('/admin-dashboard?tab=All%20Vouchers');
    } catch (error) {
      console.error('Error updating voucher:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      <nav className="bg-white shadow-sm border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="flex items-center px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-md transition-colors duration-200"
              >
                <ArrowLeft className="h-5 w-5 mr-2 text-blue-600" />
                Back
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {voucher ? (
          <VoucherForm
            onSubmit={handleVoucherSubmit}
            editingVoucher={voucher}
            isSubmitting={isSubmitting}
          />
        ) : (
          <div className="bg-white rounded-lg shadow-md border border-blue-100 p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-blue-600">Loading voucher...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function EditVoucher({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminProtectedRoute>
      <EditVoucherContent params={params} />
    </AdminProtectedRoute>
  );
}
