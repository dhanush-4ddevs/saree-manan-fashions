// Importnat Note:
// This is deparciated dont use this file dont read this file strictly not to used



// 'use client';

// import { useState, useEffect } from 'react';
// import { Voucher, ForwardRecord } from '../types/voucher';
// import { Package, User, FileText, Send, MessageSquare, AlertCircle } from 'lucide-react';
// import { db } from '@/lib/firebase';
// import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, serverTimestamp, setDoc, addDoc, runTransaction, orderBy, limit } from 'firebase/firestore';
// import { notificationService } from '../utils/notificationService';
// import { getCurrentUser } from '../config/firebase';
// import { v4 as uuidv4 } from 'uuid';
// import { useRouter } from 'next/navigation';
// import { calculateForwardableQuantity } from '@/app/utils/voucherUtils';

// interface VendorOption {
//   uid: string;
//   firstName: string;
//   lastName: string;
//   companyName: string;
//   email: string;
//   userCode: string;
//   designation?: string;
// }

// interface ForwardVoucherFormProps {
//   voucher: Voucher;
//   onSuccess: () => void;
//   onCancel: () => void;
// }

// interface ForwardFormData {
//   receiverUserId: string;
//   receiverName: string;
//   receiverCode: string;
//   receiverDesignation: string;
//   quantity: number;
//   nextJobWork: string;
//   comment: string;
//   reason: string;
//   lrDate: string;
//   lrNumber: string;
//   transportName: string;
// }

// export function ForwardVoucherForm({ voucher, onSuccess, onCancel }: ForwardVoucherFormProps) {
//   const [vendors, setVendors] = useState<VendorOption[]>([]);
//   const [selectedVendorId, setSelectedVendorId] = useState<string>('');
//   const [quantity, setQuantity] = useState<number>(voucher.quantity);
//   const [jobWork, setJobWork] = useState<string>(voucher.jobWork || '');
//   const [nextJobWork, setNextJobWork] = useState<string>('');
//   const [damage, setDamage] = useState<number>(0);
//   const [comment, setComment] = useState<string>('');
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const router = useRouter();
//   const [formData, setFormData] = useState<ForwardFormData>({
//     receiverUserId: '',
//     receiverName: '',
//     receiverCode: '',
//     receiverDesignation: '',
//     quantity: 0,
//     nextJobWork: '',
//     comment: '',
//     reason: '',
//     lrDate: voucher.lrDate || new Date().toISOString().split('T')[0],
//     lrNumber: voucher.lrNumber || '',
//     transportName: voucher.transportName || '',
//   });
//   const [currentUser, setCurrentUser] = useState<any>(null);
//   const [recentlyForwarded, setRecentlyForwarded] = useState<Voucher[]>([]);


//   useEffect(() => {
//     // Fetch all vendors
//     const fetchVendors = async () => {
//       try {
//         const vendorsRef = collection(db, 'users');
//         const vendorQuery = query(vendorsRef, where('role', '==', 'vendor'));
//         const vendorSnapshot = await getDocs(vendorQuery);

//         const vendorList: VendorOption[] = [];
//         vendorSnapshot.forEach((doc) => {
//           const vendorData = doc.data() as VendorOption;
//           vendorList.push({
//             ...vendorData,
//             uid: doc.id
//           });
//         });

//         setVendors(vendorList);
//       } catch (error) {
//         console.error("Error fetching vendors:", error);
//         setError("Failed to load vendors. Please try again.");
//       }
//     };

//     fetchVendors();

//     const fetchRecentlyForwarded = async () => {
//       if (currentUser && currentUser.userCode) {
//         try {
//           const q = query(
//             collection(db, 'vouchers'),
//             where('senderCode', '==', currentUser.userCode),
//             where('status', '==', 'Dispatched'),
//             orderBy('createdAt', 'desc'),
//             limit(5)
//           );
//           const querySnapshot = await getDocs(q);
//           const recentVouchers = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Voucher));
//           setRecentlyForwarded(recentVouchers);
//         } catch (err) {
//           console.error("Error fetching recently forwarded vouchers:", err);
//         }
//       }
//     };

//     if (currentUser) {
//       fetchRecentlyForwarded();
//     }
//   }, [currentUser]);

//   useEffect(() => {
//     const loadCurrentUser = async () => {
//       const user = await getCurrentUser();
//       setCurrentUser(user);
//     };
//     loadCurrentUser();
//   }, []);

//   // Set initial values
//   useEffect(() => {
//     if (voucher) {
//       const forwardableQty = calculateForwardableQuantity(voucher);
//       setQuantity(forwardableQty);
//     }
//   }, [voucher]);

//   const handleVendorSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
//     setSelectedVendorId(e.target.value);
//   };

//   const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target;

//     // When reason changes to 'Complete', update receiver info
//     if (name === 'reason' && value === 'Complete') {
//       try {
//         // Get the original voucher details
//         const originalVoucherRef = doc(db, 'vouchers', voucher.id);
//         const originalVoucherSnap = await getDoc(originalVoucherRef);
//         const originalVoucher = originalVoucherSnap.data() as Voucher;

//         if (!originalVoucher) {
//           throw new Error('Original voucher not found');
//         }

//         if (!originalVoucher.senderName || !originalVoucher.senderCode) {
//           throw new Error('Original sender details not found');
//         }

//         // Set the form data with original sender's details
//         const newFormData = {
//           ...formData,
//           reason: value,
//           quantity: quantity,
//           receiverUserId: originalVoucher.senderCode, // Using senderCode as the ID
//           receiverName: originalVoucher.senderName,
//           receiverCode: originalVoucher.senderCode
//         };
//         setFormData(newFormData);

//       } catch (error) {
//         console.error('Error auto-filling receiver details:', error);
//         setError('Failed to auto-fill receiver details. Please try again.');
//       }
//     } else if (name === 'quantity') {
//       setFormData(prev => ({
//         ...prev,
//         [name]: parseInt(value)
//       }));
//     } else {
//       setFormData(prev => ({
//         ...prev,
//         [name]: value
//       }));
//     }
//   };

//   // Add useEffect to monitor formData changes
//   useEffect(() => {
//   }, [formData]);

//   // Add console log to see initial voucher data
//   useEffect(() => {
//   }, [voucher]);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     try {
//       setIsSubmitting(true);
//       setError('');

//       const localCurrentUser = await getCurrentUser();
//       if (!localCurrentUser) {
//         throw new Error('Not authenticated');
//       }

//       // Validate the form fields
//       if (formData.reason === 'forward' && !formData.receiverUserId ) {
//         throw new Error('Please select a vendor to forward to');
//       }

//       if (!formData.quantity || formData.quantity <= 0) {
//         throw new Error('Quantity must be greater than zero');
//       }

//       // Use the available quantity from state, which is already calculated
//       const availableQty = quantity;
//       if (formData.quantity > availableQty) {
//         throw new Error(`Quantity cannot exceed available quantity of ${availableQty}`);
//       }

//       // Generate a unique ID to track this forward process (still useful for idempotency or logging)
//       const forwardingProcessId = uuidv4();

//       await runTransaction(db, async (transaction) => {
//         const voucherRef = doc(db, 'vouchers', voucher.id);
//         const voucherSnap = await transaction.get(voucherRef);

//         if (!voucherSnap.exists()) {
//           throw new Error(`Voucher with ID ${voucher.id} not found`);
//         }

//         const voucherData = voucherSnap.data() as Voucher;

//         // Verify voucher is still in a valid state for forwarding
//         const currentStatus = voucherData.status;
//         const validForwardStatuses = [
//           'Received',
//           'Dispatched',
//           'PendingAdminReceive',
//           'Completed',
//           'Completion Confirmed',
//           'Forwarded',           // Allow forwarding of already forwarded vouchers (for partial forwarding)
//           'Partially Forwarded'  // Allow forwarding of partially forwarded vouchers
//         ];
//         if (!validForwardStatuses.includes(currentStatus)) {
//           throw new Error(`Voucher cannot be forwarded or completed from its current status: ${currentStatus}.`);
//         }

//         // Declare now and newJourneyRecord here to be in scope for both branches
//         const now = serverTimestamp();
//         let newJobWorkForReceiver = formData.nextJobWork; // Defined here so it's in scope for newJourneyRecord

//         // const newJourneyRecord: VoucherJourneyRecord = {
//         //   timestamp: now,
//         //   vendorId: localCurrentUser.uid, // The one performing the forward action
//         //   vendorName: `${localCurrentUser.firstName || ''} ${localCurrentUser.surname || ''}`.trim() || localCurrentUser.email, // Current user's name
//         //   vendorCode: voucherData.currentVendorCode || localCurrentUser.userCode || 'N/A', // Current vendor's code
//         //   action: formData.reason === 'Complete' ? 'Dispatched to Admin' : 'Forwarded',
//         //   qtyForwarded: formData.reason === 'forward' ? formData.quantity : undefined, // Only set qtyForwarded if actually forwarding
//         //   comment: formData.comment,
//         //   jobWorkDone: voucherData.jobWork, // Job work done by the current vendor
//         //   nextJobWork: formData.reason === 'Complete' ? undefined : newJobWorkForReceiver, // Corrected: Use newJobWorkForReceiver
//         //   // images: [], // Add image handling if necessary
//         // };

//         let receiverDetails: { id: string; name: string; code: string; type: 'vendor' | 'admin' };
//         let newStatus: Voucher['status'];

//         // Define a new voucher object for forwarding
//         let newForwardedVoucherData: Partial<Voucher> = {};
//         let newVoucherRef: any = null; // Firebase Doc Ref

//         if (formData.reason === 'Complete') {
//           // Returning to admin (original sender of the voucher)
//           if (!voucherData.adminUserId || !voucherData.senderName || !voucherData.senderCode) {
//             throw new Error('Original admin sender details not found on the voucher.');
//           }
//           receiverDetails = {
//             id: voucherData.adminUserId,
//             name: voucherData.senderName,
//             code: voucherData.senderCode,
//             type: 'admin',
//           };
//           newStatus = 'Dispatched to Admin';
//           // newJobWorkForReceiver is already set (or voucherData.jobWork can be used if needed for clarity here)
//           // For completion, the job work is what was originally assigned or the last one for the completing vendor.
//           // The newJourneyRecord uses voucherData.jobWork as jobWorkDone.

//           // Update existing voucher when returning to admin
//           transaction.update(voucherRef, {
//             status: newStatus,
//             previousVendorId: voucherData.currentVendorId,
//             previousVendorName: voucherData.currentVendorName,
//             currentVendorId: receiverDetails.id, // Admin's ID
//             currentVendorName: receiverDetails.name, // Admin's name
//             currentVendorCode: receiverDetails.code, // Admin's code
//             jobWork: voucherData.jobWork, // Keep original job work or last job work on return
//             lrDate: formData.lrDate,
//             lrNumber: formData.lrNumber,
//             transportName: formData.transportName,
//             qtyReceived: null, // Reset for admin receipt
//             receiverComment: null, // Reset receiver comment for admin receipt
//             damagedOnArrival: null,
//             damageAfterWork: null,
//             receivedAt: null,
//             netQty: formData.quantity, // Quantity being returned

//             updatedAt: now,
//             forwardingProcessId: forwardingProcessId,
//             vendorUserId: receiverDetails.id, // Admin's ID
//             totalForwardedQty: (voucherData.totalForwardedQty || 0) + formData.quantity,
//             forwardableQty: calculateForwardableQuantity({
//               ...voucherData,
//               totalForwardedQty: (voucherData.totalForwardedQty || 0) + formData.quantity
//             })
//           });

//           // Create forwardVoucher entry when dispatching to admin for completion
//           const forwardVoucherRef = doc(collection(db, 'forwardVouchers'));
//           const forwardVoucherData = {
//             originalVoucherId: voucher.id,
//             voucherNo: voucher.voucherNo,
//             voucherDate: voucher.voucherDate || new Date().toISOString().split('T')[0],
//             senderUserId: localCurrentUser.uid,
//             senderName: `${localCurrentUser.firstName || ''} ${localCurrentUser.surname || ''}`.trim() || localCurrentUser.email,
//             senderType: 'vendor',
//             senderDesignation: localCurrentUser.designation || localCurrentUser.role || 'Vendor',
//             senderPhone: localCurrentUser.phone || '',
//             item: voucher.item,
//             jobWork: voucher.jobWork || '',
//             nextJobWork: null,
//             netQty: formData.quantity,
//             receiverUserId: voucher.adminUserId,
//             receiverName: formData.receiverName,
//             receiverCode: formData.receiverCode,
//             comment: formData.comment || 'Voucher completion request',
//             reason: 'Complete',
//             status: 'Dispatched to Admin',
//             createdAt: serverTimestamp(),
//             updatedAt: serverTimestamp()
//           };
//           transaction.set(forwardVoucherRef, forwardVoucherData);

//         } else { // Forwarding to another vendor - This is where a new voucher is created
//           const selectedReceiver = vendors.find(v => v.uid === formData.receiverUserId);
//           if (!selectedReceiver) {
//             throw new Error('Selected vendor not found');
//           }
//           receiverDetails = {
//             id: selectedReceiver.uid,
//             name: `${selectedReceiver.firstName} ${selectedReceiver.lastName}`,
//             code: selectedReceiver.userCode,
//             type: 'vendor',
//           };
//           newStatus = 'Dispatched'; // Status for the NEW voucher
//           // newJobWorkForReceiver is already set from formData.nextJobWork

//           const newVoucherId = uuidv4();
//           newVoucherRef = doc(db, 'vouchers', newVoucherId); // Reference for the new child voucher

//           // Prepare data for the NEW child voucher
//           newForwardedVoucherData = {
//             id: newVoucherId,
//             parentVoucherId: voucher.id, // Link to parent
//             voucherNo: `SUB-${voucherData.voucherNo}-${uuidv4().substring(0, 4)}`, // Generate a unique sub-voucher number
//             voucherDate: voucherData.voucherDate,
//             senderName: `${localCurrentUser.firstName || ''} ${localCurrentUser.surname || ''}`.trim() || localCurrentUser.email,
//             senderCode: localCurrentUser.userCode || 'N/A',
//             senderDesignation: localCurrentUser.role === 'admin' ? 'Administrator' : 'Vendor',
//             imageUrl: voucherData.imageUrl,
//             item: voucherData.item,
//             quantity: formData.quantity,
//             supplierName: voucherData.supplierName,
//             supplierPrice: voucherData.supplierPrice,
//             totalValue: formData.quantity * (voucherData.supplierPrice || 0),
//             jobWork: newJobWorkForReceiver, // Job for the new vendor
//             vendorFirstName: selectedReceiver.firstName,
//             vendorLastName: selectedReceiver.lastName,
//             vendorCompanyName: selectedReceiver.companyName,
//             vendorAddress: '', // Populate if available/needed
//             vendorPhone: '',   // Populate if available/needed
//             vendorEmail: selectedReceiver.email,
//             vendorCode: selectedReceiver.userCode,
//             vendorUserId: selectedReceiver.uid,
//             adminUserId: voucherData.adminUserId,
//             lrDate: formData.lrDate,
//             lrNumber: formData.lrNumber,
//             transportName: formData.transportName,
//             comment: formData.comment,
//             status: newStatus,
//             qtyReceived: 0,
//             damagedOnArrival: 0,
//             damageAfterWork: 0,
//             receivedAt: null,
//             receivedFrom: localCurrentUser.uid,
//             receivedFromName: `${localCurrentUser.firstName || ''} ${localCurrentUser.surname || ''}`.trim() || localCurrentUser.email,
//             paymentStatus: 'Pending',
//             forwardHistory: [],
//              // The journey record passed here should reflect the action for the child
//             createdAt: now,
//             updatedAt: now,
//             currentVendorId: selectedReceiver.uid,
//             currentVendorName: receiverDetails.name,
//             currentVendorCode: receiverDetails.code,
//             originalVoucherId: voucherData.originalVoucherId || voucher.id,
//             netQty: formData.quantity,
//             currentNetQty: formData.quantity,
//           };

//           // Update the ORIGINAL (Parent) Voucher
//           transaction.update(voucherRef, {
//             status: 'Forwarded',
//             childVoucherIds: arrayUnion(newVoucherId),
//             isParent: true,
//             updatedAt: now,
//             lrDate: formData.lrDate,
//             lrNumber: formData.lrNumber,
//             transportName: formData.transportName,
//             totalForwardedQty: (voucherData.totalForwardedQty || 0) + formData.quantity,
//             forwardableQty: calculateForwardableQuantity({
//               ...voucherData,
//               totalForwardedQty: (voucherData.totalForwardedQty || 0) + formData.quantity
//             }),
//             voucherJourney: arrayUnion({
//               // Create a specific journey record for parent about this forwarding event
//               timestamp: now,
//               vendorId: localCurrentUser.uid,
//               vendorName: `${localCurrentUser.firstName || ''} ${localCurrentUser.surname || ''}`.trim() || localCurrentUser.email,
//               vendorCode: voucherData.currentVendorCode || localCurrentUser.userCode || 'N/A',
//               action: 'Forwarded', // Explicitly 'Forwarded' for parent's journey
//               qtyForwarded: formData.quantity,
//               comment: `Forwarded ${formData.quantity} units to ${receiverDetails.name} (${receiverDetails.code}) for job: ${newJobWorkForReceiver}. Child Voucher ID: ${newVoucherId}`,
//               jobWorkDone: voucherData.jobWork, // Job done by this (parent) vendor before forwarding
//               nextJobWork: newJobWorkForReceiver, // Next job assigned to child
//             }),
//           });

//           // Set the NEW (Child) Voucher in the transaction
//           transaction.set(newVoucherRef, newForwardedVoucherData);
//         }

//         const newForwardRecord: ForwardRecord = {
//           id: uuidv4(), // Unique ID for this forward record
//           fromUserId: localCurrentUser.uid,
//           fromUserName: `${localCurrentUser.firstName || ''} ${localCurrentUser.surname || ''}`.trim() || localCurrentUser.email,
//           fromUserType: voucherData.currentVendorId === voucherData.adminUserId ? 'admin' : 'vendor', // Or determine based on currentUser role
//           toUserId: receiverDetails.id,
//           toUserName: receiverDetails.name,
//           forwardDate: new Date().toISOString(), // Or use serverTimestamp if preferred for consistency
//           quantity: formData.quantity,
//           jobWork: voucherData.jobWork, // The job work the item was with the current vendor for
//           nextJobWork: formData.reason === 'Complete' ? '' : newJobWorkForReceiver, // Next job for the receiver
//                           comment: formData.comment,
//         };

//         const netQuantityAfterForward = voucherData.netQty !== undefined
//                                       ? voucherData.netQty - formData.quantity
//                                       : (voucherData.qtyReceived || voucherData.quantity) - formData.quantity;

//         // Send notification
//         if (formData.reason !== 'Complete' && formData.receiverUserId) {
//           const selectedVendor = vendors.find(v => v.uid === formData.receiverUserId);
//           if (selectedVendor) {
//             // Use vendor notification service for forwarded vouchers
//             await notificationService.sendVoucherAssignmentNotification({
//               vendorUserId: selectedVendor.uid,
//               voucherNo: voucher.voucherNo,
//               voucherId: voucher.id,
//               itemName: voucher.item,
//               quantity: formData.quantity || voucher.quantity,
//               isForwarded: true,
//               senderName: `${localCurrentUser.firstName || ''} ${localCurrentUser.surname || ''}`.trim() || localCurrentUser.email
//             });
//           }
//         } else if (formData.reason === 'Complete' && voucher.adminUserId) {
//            await notificationService.createNotification({
//               userId: voucher.adminUserId, // Notify the original admin
//               title: 'Voucher Completion Request Submitted',
//               message: `Voucher ${voucher.voucherNo} for item ${voucher.item} has been returned by ${(`${localCurrentUser.firstName || ''} ${localCurrentUser.surname || ''}`.trim() || localCurrentUser.email)} and is pending your confirmation.`,
//               voucherNo: voucher.voucherNo,
//               eventType: 'completion_request',
//               eventId: voucher.id
//             });

//             // Create forwardVoucher entry when dispatching to admin for completion
//             const forwardVoucherRef = doc(collection(db, 'forwardVouchers'));
//             const forwardVoucherData = {
//               originalVoucherId: voucher.id,
//               voucherNo: voucher.voucherNo,
//               voucherDate: voucher.voucherDate || new Date().toISOString().split('T')[0],
//               senderUserId: localCurrentUser.uid,
//               senderName: `${localCurrentUser.firstName || ''} ${localCurrentUser.surname || ''}`.trim() || localCurrentUser.email,
//               senderType: 'vendor',
//               senderDesignation: localCurrentUser.designation || localCurrentUser.role || 'Vendor',
//               senderPhone: localCurrentUser.phone || '',
//               item: voucher.item,
//               jobWork: voucher.jobWork || '',
//               nextJobWork: null,
//               netQty: formData.quantity,
//               receiverUserId: voucher.adminUserId,
//               receiverName: formData.receiverName,
//               receiverCode: formData.receiverCode,
//               comment: formData.comment || 'Voucher completion request',
//               reason: 'Complete',
//               status: 'Dispatched to Admin',
//               createdAt: serverTimestamp(),
//               updatedAt: serverTimestamp()
//             };
//             transaction.set(forwardVoucherRef, forwardVoucherData);
//         }
//       });

//       setIsSubmitting(false);
//       onSuccess(); // Call onSuccess callback

//       // Check user role and route accordingly
//       const currentUser = await getCurrentUser();
//       if (currentUser?.role === 'vendor') {
//         router.push('/vendor/forward-report'); // Route vendors to their forward report page
//       } else {
//         router.push('/admin-dashboard/vouchers'); // Route admins to admin vouchers page
//       }
//     } catch (err: any) {
//       console.error('Error forwarding voucher:', err);

//       // Provide more helpful error messages for common issues
//       let errorMessage = 'Failed to forward voucher';

//       if (err instanceof Error) {
//         // Check for specific error patterns
//         if (err.message.includes('already forwarded') || err.message.includes('being forwarded')) {
//           errorMessage = err.message;
//         } else if (err.message.includes('status')) {
//           errorMessage = err.message;
//         } else if (err.message.includes('No document to update')) {
//           errorMessage = 'The voucher could not be found in the database. It may have been deleted or moved. Please refresh and try again.';
//         } else if (err.message.includes('Permission denied')) {
//           errorMessage = 'You do not have permission to complete this action. Please contact your administrator.';
//         } else {
//           errorMessage = err.message;
//         }
//       }

//       setError(errorMessage);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const resetAvailableQuantity = () => {
//     if (voucher) {
//       // Use the utility function to calculate forwardable quantity
//       const forwardableQty = calculateForwardableQuantity(voucher);
//       setQuantity(forwardableQty);
//     }
//   };

//   return (
//     <div className="bg-white p-4 sm:p-6 rounded-lg shadow w-full max-w-4xl mx-auto">
//       <form onSubmit={handleSubmit} className="flex flex-col gap-y-4 sm:gap-y-6">
//         {error && (
//           <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded relative text-sm sm:text-base" role="alert">
//             <span className="block sm:inline">{error}</span>
//           </div>
//         )}

//         {/* Reason Selection */}
//         <div className="flex flex-col w-full gap-y-2">
//           <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
//             Reason for Forward
//           </label>
//           <div className="flex flex-col sm:flex-row gap-x-4 gap-y-2">
//             <label className="inline-flex items-center">
//               <input type="radio" name="reason" value="Complete" checked={formData.reason === 'Complete'} onChange={handleInputChange} className="mr-2" />
//               Send to Admin
//             </label>
//             <label className="inline-flex items-center">
//               <input type="radio" name="reason" value="forward" checked={formData.reason === 'forward'} onChange={handleInputChange} className="mr-2" />
//               Forward to Another Vendor
//             </label>
//           </div>
//         </div>

//         {/* Display receiver details when reason is Complete */}
//         {formData.reason === 'Complete' && (
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <div className="flex flex-col w-full">
//               <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Name</label>
//               <input
//                 type="text"
//                 value={formData.receiverName}
//                 disabled
//                 className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm text-sm sm:text-base"
//               />
//             </div>
//             <div className="flex flex-col w-full">
//               <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Code</label>
//               <input
//                 type="text"
//                 value={formData.receiverCode}
//                 disabled
//                 className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm text-sm sm:text-base"
//               />
//             </div>
//           </div>
//         )}

//         {/* Only show vendor selection if reason is forward */}
//         {formData.reason === 'forward' && (
//           <>
//             <div className="flex flex-col w-full">
//               <label htmlFor="vendorId" className="block text-sm font-medium text-gray-700 mb-1">
//                 Select Vendor
//               </label>
//               <select
//                 id="vendorId"
//                 name="receiverUserId"
//                 value={formData.receiverUserId}
//                 onChange={(e) => {
//                   const selectedVendor = vendors.find(v => v.uid === e.target.value);
//                   if (selectedVendor) {
//                     setFormData(prev => ({
//                       ...prev,
//                       receiverUserId: selectedVendor.uid,
//                       receiverName: `${selectedVendor.firstName} ${selectedVendor.lastName}`,
//                       receiverCode: selectedVendor.userCode || '',
//                       receiverDesignation: selectedVendor.designation || ''
//                     }));
//                   }
//                 }}
//                 className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base"
//                 required={formData.reason === 'forward'}
//               >
//                 <option value="">Select a vendor</option>
//                 {vendors.map((vendor) => (
//                   <option key={vendor.uid} value={vendor.uid}>
//                     {vendor.firstName} {vendor.lastName} ({vendor.userCode})
//                   </option>
//                 ))}
//               </select>
//             </div>

//             {/* Show receiver details when a vendor is selected */}
//             {formData.receiverUserId && (
//               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//                 <div className="flex flex-col w-full">
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Name</label>
//                   <input
//                     type="text"
//                     value={formData.receiverName}
//                     disabled
//                     className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm text-sm sm:text-base cursor-not-allowed"
//                   />
//                 </div>
//                 <div className="flex flex-col w-full">
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Code</label>
//                   <input
//                     type="text"
//                     value={formData.receiverCode}
//                     disabled
//                     className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm text-sm sm:text-base cursor-not-allowed"
//                   />
//                 </div>
//                 <div className="flex flex-col w-full">
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Designation</label>
//                   <input
//                     type="text"
//                     value={formData.receiverDesignation}
//                     disabled
//                     className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm text-sm sm:text-base cursor-not-allowed"
//                   />
//                 </div>
//               </div>
//             )}
//           </>
//         )}

//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//           <div className="flex flex-col w-full">
//             <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
//               Quantity (Max: {quantity} available)
//             </label>
//             <input
//               type="number"
//               name="quantity"
//               id="quantity"
//               value={formData.quantity !== undefined && formData.quantity !== null ? formData.quantity : quantity}
//               onChange={handleInputChange}
//               className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base"
//               required
//               min="1"
//               max={quantity}
//             />
//             <small className="text-gray-500 mt-1">
//               Available to forward: {quantity} | Form value: {formData.quantity || 'using default'}
//             </small>
//           </div>

//           <div className="flex flex-col w-full">
//             <label htmlFor="nextJobWork" className="block text-sm font-medium text-gray-700 mb-1">
//               Next Job Work
//             </label>
//             <input
//               type="text"
//               name="nextJobWork"
//               id="nextJobWork"
//               value={formData.nextJobWork}
//               onChange={handleInputChange}
//               className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base"
//               required
//             />
//           </div>
//         </div>

//         <div className="flex flex-col w-full">
//           <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
//             Comment
//           </label>
//           <textarea
//             name="comment"
//             id="comment"
//             rows={3}
//             value={formData.comment}
//             onChange={handleInputChange}
//             className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base"
//           />
//         </div>

//         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//           <div className="flex flex-col w-full">
//             <label htmlFor="lrDate" className="block text-sm font-medium text-gray-700 mb-1">
//               LR Date
//             </label>
//             <input
//               type="date"
//               name="lrDate"
//               id="lrDate"
//               value={formData.lrDate}
//               onChange={handleInputChange}
//               className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base"
//             />
//           </div>

//           <div className="flex flex-col w-full">
//             <label htmlFor="lrNumber" className="block text-sm font-medium text-gray-700 mb-1">
//               LR Number
//             </label>
//             <input
//               type="text"
//               name="lrNumber"
//               id="lrNumber"
//               value={formData.lrNumber}
//               onChange={handleInputChange}
//               className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base"
//               placeholder="Enter LR Number"
//             />
//           </div>

//           <div className="flex flex-col w-full">
//             <label htmlFor="transportName" className="block text-sm font-medium text-gray-700 mb-1">
//               Transport Name
//             </label>
//             <input
//               type="text"
//               name="transportName"
//               id="transportName"
//               value={formData.transportName}
//               onChange={handleInputChange}
//               className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base"
//             />
//           </div>
//         </div>

//         <div className="flex flex-col sm:flex-row justify-end gap-y-3 sm:gap-y-0 sm:space-x-3 w-full mt-4">
//           <button
//             type="button"
//             onClick={onCancel}
//             className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
//           >
//             Cancel
//           </button>
//           <button
//             type="submit"
//             disabled={isSubmitting}
//             className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
//           >
//             {isSubmitting ? 'Processing...' : 'Forward Voucher'}
//           </button>
//         </div>
//       </form>

//       {recentlyForwarded.length > 0 && (
//         <div className="mt-6 sm:mt-8">
//           <h3 className="text-base sm:text-lg font-medium text-gray-900">Recently Forwarded Vouchers</h3>
//           <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//             {recentlyForwarded.map((item) => (
//               <div key={item.id} className="p-3 sm:p-4 bg-gray-50 rounded-md shadow-sm">
//                 <p className="text-sm font-medium text-gray-700">Voucher No: {item.voucherNo}</p>
//                 <p className="text-xs sm:text-sm text-gray-500">To: {item.currentVendorName} ({item.currentVendorCode})</p>
//                 <p className="text-xs sm:text-sm text-gray-500">Quantity: {item.quantity}</p>
//                 <p className="text-xs sm:text-sm text-gray-500">Next Job: {item.jobWork}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
