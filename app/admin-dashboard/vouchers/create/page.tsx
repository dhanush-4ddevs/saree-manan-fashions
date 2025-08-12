'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, PlusCircle, Edit, Trash, Printer, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { VoucherForm, VoucherFormSubmitData } from '@/components/shared/VoucherForm';
import { Voucher, VoucherFormData } from '@/types/voucher';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, Timestamp, deleteDoc, doc, getDoc, where } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { getCurrentUser } from '@/config/firebase';
import { notificationService } from '@/utils/notificationService';
import { uploadImageFromDataUrl } from '@/utils/imageUpload';
import { ImageContainer } from '@/components/shared/ImageContainer';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { getNextAvailableVoucherNumber, VoucherNumberOptions } from '@/utils/voucherNumberGenerator';
import { getCurrentISTTime } from '@/utils/dateFormatter';
import { PrintPreviewModal } from '@/components/shared/PrintPreviewModal';

function CreateVoucherContent() {
  const router = useRouter();
  const [currentVoucherNo, setCurrentVoucherNo] = useState('');
  const [lastVoucherNumber, setLastVoucherNumber] = useState(0);
  const [recentVouchers, setRecentVouchers] = useState<Voucher[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<Voucher | null>(null);

  // Generate voucher number using the new utility
  const generateVoucherNo = async () => {
    const options: VoucherNumberOptions = {
      strategy: 'financial_year',
    };

    try {
      const voucherNo = await getNextAvailableVoucherNumber(options);
      setCurrentVoucherNo(voucherNo);

      // Extract sequence number for display
      const match = voucherNo.match(/MFV\d{8}_(\d+)$/);
      if (match) {
        setLastVoucherNumber(parseInt(match[1], 10));
      }

      return voucherNo;
    } catch (error) {
      console.error('Error generating voucher number:', error);
      // Fallback to timestamp-based number
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const currentDate = `${year}${month}${day}`;
      const timestamp = Date.now().toString().slice(-4);
      const fallbackVoucherNo = `MFV${currentDate}_${timestamp}`;
      setCurrentVoucherNo(fallbackVoucherNo);
      return fallbackVoucherNo;
    }
  };

  // Generate numbers when component mounts and fetch recent vouchers
  useEffect(() => {
    const initializeForm = async () => {
      const voucherNo = await generateVoucherNo();
      setCurrentVoucherNo(voucherNo);
    };

    initializeForm();
    fetchRecentVouchers();
  }, []);

  // Fetch recent vouchers
  const fetchRecentVouchers = async () => {
    try {
      const vouchersCollection = collection(db, 'vouchers');
      const vouchersQuery = query(vouchersCollection, orderBy('createdAt', 'desc'), limit(5));
      const vouchersSnapshot = await getDocs(vouchersQuery);

      const vouchersList = await Promise.all(vouchersSnapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data() as Omit<Voucher, 'id'>;

        let vendorName = 'N/A';
        const dispatchEvent = data.events.find(e => e.event_type === 'dispatch');
        if (dispatchEvent && dispatchEvent.details.receiver_id) {
          try {
            const vendorDoc = await getDoc(doc(db, 'users', dispatchEvent.details.receiver_id));
            if (vendorDoc.exists()) {
              const vendorData = vendorDoc.data() as { companyName?: string, firstName?: string, surname?: string };
              vendorName = vendorData.companyName || `${vendorData.firstName} ${vendorData.surname}`;
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
        } as Voucher & { vendorName: string };
      }));

      setRecentVouchers(vouchersList);
    } catch (error) {
      console.error('Error fetching recent vouchers:', error);
    }
  };

  // Change the function signature to accept VoucherFormSubmitData
  const handleVoucherSubmit = async (submitData: VoucherFormSubmitData) => {
    try {
      setIsSubmitting(true);
      const { formData, images } = submitData;
      // Transform formData and images into a Voucher object
      const newVoucherNumber = await generateVoucherNo();
      setCurrentVoucherNo(newVoucherNumber);

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Prepare item_details
      const item_details = {
        item_name: formData.item,
        images: images.map((img: any) => img.watermarkedDataUrl),
        initial_quantity: formData.quantity,
        supplier_name: formData.supplierName,
        supplier_price_per_piece: formData.supplierPrice,
      };

      // Prepare dispatch event
      const dispatchEvent = {
        event_id: `evnt_${newVoucherNumber}_1`,
        event_type: 'dispatch' as const,
        timestamp: getCurrentISTTime(),
        user_id: currentUser.uid,
        comment: formData.comment,
        details: {
          jobWork: formData.jobWork,
          sender_id: currentUser.uid,
          receiver_id: formData.vendorUserId,
          quantity_dispatched: formData.quantity,
          transport: {
            lr_no: formData.lrNumber,
            lr_date: formData.lrDate,
            transporter_name: formData.transportName,
          },
        },
      };

      const finalVoucherData: Voucher = {
        voucher_no: newVoucherNumber,
        voucher_status: 'Dispatched',
        created_at: new Date(formData.voucherDate).toISOString(),
        created_by_user_id: currentUser.uid,
        item_details,
        events: [dispatchEvent],
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

      console.log('Saving final voucher data:', finalVoucherData);

      const docRef = await addDoc(collection(db, 'vouchers'), finalVoucherData);
      console.log('Voucher saved with ID:', docRef.id);

      if (dispatchEvent.details.receiver_id) {
        await notificationService.sendEventNotifications({
          voucherNo: finalVoucherData.voucher_no,
          eventType: dispatchEvent.event_type,
          eventId: dispatchEvent.event_id,
          receiverId: dispatchEvent.details.receiver_id,
          adminId: finalVoucherData.created_by_user_id,
          itemName: finalVoucherData.item_details.item_name,
          quantity: finalVoucherData.item_details.initial_quantity
        });
      }

      fetchRecentVouchers();
      await generateVoucherNo();

      alert(`Voucher ${finalVoucherData.voucher_no} created successfully!`);

    } catch (error) {
      console.error('Error saving voucher:', error);
      alert('Failed to save voucher. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditVoucher = (voucherId: string | undefined) => {
    if (voucherId) {
      router.push(`/admin-dashboard/vouchers/edit/${voucherId}`);
    }
  };

  const handleVoucherClick = (voucher: Voucher) => {
    // Navigate to all vouchers page with the voucher ID as a parameter for highlighting
    router.push(`/admin-dashboard?voucherId=${voucher.id}&viewMode=details`);
  };

  const handlePrintVoucher = (voucher: Voucher) => {
    setSelectedVoucherForPrint(voucher);
    setShowPrintPreview(true);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center mb-6 md:mb-8 border-b pb-4">
        {/* <ArrowLeft
          className="h-5 w-5 text-gray-500 mr-3 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => router.back()}
        /> */}

        <h2 className="text-2xl font-bold text-blue-800">Create New Voucher</h2>
      </div>

      <div className="space-y-6 md:space-y-8">


        <div>
          <VoucherForm
            onSubmit={handleVoucherSubmit}
            editingVoucher={null}
            initialVoucherNo={currentVoucherNo}
            isSubmitting={isSubmitting}
            onSuccess={() => {
              fetchRecentVouchers();
              generateVoucherNo();
            }}
          />
        </div>

        {recentVouchers.length > 0 && (
          <div className="mt-6 md:mt-8 bg-gray-50 p-4 md:p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Recently Created Vouchers</h3>
            <div className="overflow-x-auto">
              {recentVouchers.map((voucher) => (
                <div key={voucher.id} className="border border-blue-100 rounded-md p-3 mb-3 hover:bg-blue-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div
                        className="font-medium text-blue-700 cursor-pointer hover:text-blue-900 hover:underline transition-colors"
                        onClick={() => handleVoucherClick(voucher)}
                        title="Click to view in All Vouchers"
                      >
                        {voucher.voucher_no}
                      </div>
                      <div className="text-sm text-gray-600">
                        {(voucher as any).vendorName} • {voucher.item_details.initial_quantity} pieces
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(voucher.createdAt as string)}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handlePrintVoucher(voucher)}
                        className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Print Preview"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditVoucher(voucher.id)}
                        className="p-1 text-gray-500 hover:text-green-600 transition-colors"
                        title="Edit Voucher"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Print Preview Modal */}
        <PrintPreviewModal
          voucher={selectedVoucherForPrint}
          isOpen={showPrintPreview}
          onClose={() => {
            setShowPrintPreview(false);
            setSelectedVoucherForPrint(null);
          }}
        />
      </div>
    </div>
  );
}

export default function CreateVoucher() {
  return (
    <AdminProtectedRoute>
      <CreateVoucherContent />
    </AdminProtectedRoute>
  );
}
