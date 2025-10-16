'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, ArrowLeft, Upload, Download, Printer, Save, FileText, CreditCard, IndianRupee, Package, Database, Settings, Trash2, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { getCurrentUser } from '@/config/firebase';
import { doc, updateDoc, collection, query, where, getDocs, orderBy, deleteDoc, getDoc } from 'firebase/firestore';
import { db, storage } from '@/config/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import * as XLSX from 'xlsx';

interface AddressObject {
  line1: string;
  city: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
}

interface KycDocuments {
  photo?: string;
  aadhar?: string;
  companyId?: string;
  drivingLicense?: string;
  gstin?: string;
  pancard?: string;
  passport?: string;
  voterId?: string;
  [key: string]: string | File | undefined;
}

// Extended user interface to include KYC documents
interface UserData {
  uid: string;
  email: string;
  role: string;
  firstName?: string;
  surname?: string;
  phone?: string;
  companyName?: string;
  userCode?: string;
  address?: AddressObject | string;
  vendorJobWork?: string;
  category?: string;
  kycDocuments?: KycDocuments;
  profilePhotoUrl?: string;
  kycStatus?: string;
}

// Payment interface
interface Payment {
  id: string;
  voucherId: string;
  voucherNo: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  jobWorkDone: string;
  pricePerPiece: number;
  netQty: number;
  totalAmount: number;
  amountPaid: number;
  paymentDate: any;
  createdAt: any;
  forwardEventId?: string; // optional for backward compatibility
}

// New interface for all transactions (both paid and pending)
interface Transaction {
  id: string;
  voucherId: string;
  voucherNo: string;
  itemName: string;
  jobWorkDone: string;
  quantity: number;
  pricePerPiece: number;
  totalAmount: number;
  amountPaid: number;
  pendingAmount: number;
  status: 'Paid' | 'Partially Paid' | 'Unpaid';
  actionDate: string;
  paymentDate?: string;
  type: 'payment' | 'voucher';
}

export default function MyProfile() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', message: '' });
  const [activeTab, setActiveTab] = useState('personal');
  const [kycDocuments, setKycDocuments] = useState<KycDocuments>({});
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | undefined>(undefined);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | undefined>(undefined);

  // For account status display
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [totalPaid, setTotalPaid] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);

  // New state for comprehensive transaction tracking
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Filter and sort state for transactions
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'paid' | 'unpaid' | 'partially'>('all');
  const [transactionSortBy, setTransactionSortBy] = useState<'date' | 'amount' | 'voucher'>('date');
  const [transactionSortOrder, setTransactionSortOrder] = useState<'asc' | 'desc'>('desc');

  // Backup functionality state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);

  // Clear data functionality state
  const [isClearingData, setIsClearingData] = useState(false);
  const [clearProgress, setClearProgress] = useState(0);

  // Settings confirmation state
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  useEffect(() => {
    // Check if there's an active tab stored in localStorage
    if (typeof window !== 'undefined') {
      const storedTab = localStorage.getItem('activeProfileTab');
      if (storedTab && ['personal', 'kyc', 'account', 'settings'].includes(storedTab)) {
        setActiveTab(storedTab);
        // Clear the stored tab after using it
        localStorage.removeItem('activeProfileTab');
      }
    }

    // Get current user data
    const loadUserData = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUserData(currentUser);
          setProfilePhotoUrl(currentUser.profilePhotoUrl);
          setKycStatus(currentUser.kycStatus);

          // If user is admin and current tab is kyc or account, default to personal
          if (currentUser.role === 'admin' && (activeTab === 'kyc' || activeTab === 'account' || activeTab === 'settings')) {
            setActiveTab('personal');
          }

          // Initialize KYC documents from user data if they exist
          const userKycDocsUpdate: KycDocuments = {};
          if (currentUser.kycDocuments) { // Check if kycDocuments exists
            for (const [key, value] of Object.entries(currentUser.kycDocuments)) {
              if (value) { // Ensure value is not undefined
                userKycDocsUpdate[key as keyof KycDocuments] = value as string;
              }
            }
            setKycDocuments(userKycDocsUpdate);
          }

          // Load payment history if user is a vendor
          if (currentUser.role === 'vendor') {
            loadPaymentHistory(currentUser.uid);
            loadAllTransactions(currentUser.uid);
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading user data:', error);
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  const handleRefreshAccount = async () => {
    try {
      if (!userData?.uid) return;
      await Promise.all([
        loadPaymentHistory(userData.uid),
        loadAllTransactions(userData.uid)
      ]);
    } catch (err) {
      console.error('Error refreshing account data:', err);
    }
  };

  // Load payment history for the vendor
  const loadPaymentHistory = async (vendorId: string) => {
    try {
      setLoadingPayments(true);
      const paymentsRef = collection(db, 'payments');
      const paymentsQuery = query(
        paymentsRef,
        where('vendorId', '==', vendorId),
        orderBy('paymentDate', 'desc')
      );

      const snapshot = await getDocs(paymentsQuery);
      const payments: Payment[] = [];
      let totalPaidAmount = 0;

      snapshot.forEach((doc) => {
        const payment = { id: doc.id, ...doc.data() } as Payment;
        payments.push(payment);
        totalPaidAmount += payment.amountPaid;
      });

      setPaymentHistory(payments);
      setTotalPaid(totalPaidAmount);
      setLoadingPayments(false);
    } catch (error) {
      console.error('Error loading payment history:', error);
      setLoadingPayments(false);
    }
  };

  // Load all transactions (both paid and pending) for the vendor
  const loadAllTransactions = async (vendorId: string) => {
    try {
      console.log('Loading all transactions for vendor:', vendorId);
      setLoadingTransactions(true);
      const transactions: Transaction[] = [];

      // Get payment history
      const paymentsRef = collection(db, 'payments');
      const paymentsQuery = query(
        paymentsRef,
        where('vendorId', '==', vendorId),
        orderBy('paymentDate', 'desc')
      );

      const paymentsSnapshot = await getDocs(paymentsQuery);
      console.log('Found payment records:', paymentsSnapshot.size);

      // Create maps for payments per forward event (preferred) and legacy keys
      const paymentsByEvent: Record<string, number> = {};
      const paymentsMap: Record<string, number> = {};
      paymentsSnapshot.forEach((doc) => {
        const payment = doc.data() as Payment;
        const eventKey = payment.forwardEventId ? `${payment.voucherId}_${payment.forwardEventId}` : null;
        if (eventKey) {
          paymentsByEvent[eventKey] = (paymentsByEvent[eventKey] || 0) + (payment.amountPaid || 0);
        }
        const legacyKey = `${payment.voucherId}_${payment.vendorId}_${payment.jobWorkDone}`;
        paymentsMap[legacyKey] = (paymentsMap[legacyKey] || 0) + (payment.amountPaid || 0);
        console.log('Payment record:', { eventKey, legacyKey, amountPaid: payment.amountPaid, voucherId: payment.voucherId, jobWorkDone: payment.jobWorkDone });
        // Do not push individual payment docs as separate transactions; we'll show
        // a single transaction per forward event with aggregated paid amount to
        // avoid duplicates in vendor view.
      });

      // Get voucher events for pending/unpaid work
      const vouchersRef = collection(db, 'vouchers');
      const vouchersQuery = query(vouchersRef);
      const vouchersSnapshot = await getDocs(vouchersQuery);
      console.log('Found vouchers:', vouchersSnapshot.size);

      vouchersSnapshot.forEach((voucherDoc) => {
        const voucherData = voucherDoc.data();

        if (voucherData.events && voucherData.events.length > 0) {
          voucherData.events.forEach((event: any, index: number) => {
            if (
              event.event_type === 'forward' &&
              event.details &&
              event.details.sender_id === vendorId &&
              event.details.price_per_piece &&
              event.details.price_per_piece > 0
            ) {
              const netQty = event.details.quantity_forwarded || 0;
              const pricePerPiece = event.details.price_per_piece;
              const totalAmount = pricePerPiece * netQty;

              // Get vendor details from the event or voucher
              const vendorName = event.details.vendorName || voucherData.vendorName || 'Unknown Vendor';
              const vendorCode = event.details.vendorCode || voucherData.vendorCode || 'N/A';
              const jobWorkDone = event.details.jobWork || voucherData.jobWork || '';

              // Calculate amount paid for this specific forward event (preferred) with legacy fallback
              const perEventKey = `${voucherDoc.id}_${event.event_id}`;
              const legacyKey = `${voucherDoc.id}_${vendorId}_${jobWorkDone}`;
              const amountPaid = (paymentsByEvent[perEventKey] ?? paymentsMap[legacyKey] ?? 0);
              const pendingAmount = totalAmount - amountPaid;

              console.log('Voucher transaction:', {
                voucherId: voucherDoc.id,
                vendorId,
                jobWorkDone,
                perEventKey,
                amountPaid,
                totalAmount,
                pendingAmount
              });

              const actionDate = event.timestamp instanceof Date
                ? event.timestamp.toISOString().split('T')[0]
                : (typeof event.timestamp === 'string'
                  ? event.timestamp.split('T')[0]
                  : new Date().toISOString().split('T')[0]);

              // Calculate status based on amount paid vs total amount
              let status: 'Paid' | 'Partially Paid' | 'Unpaid';
              if (amountPaid === 0) {
                status = 'Unpaid';
              } else if (amountPaid >= totalAmount) {
                status = 'Paid';
              } else {
                status = 'Partially Paid';
              }

              // Only add if not already included as a payment record
              const existingPayment = transactions.find(t =>
                t.voucherId === voucherDoc.id &&
                t.type === 'payment' &&
                t.jobWorkDone === jobWorkDone
              );

              if (!existingPayment) {
                // Create a more robust unique key
                const timestampKey = event.timestamp instanceof Date
                  ? event.timestamp.getTime().toString()
                  : (typeof event.timestamp === 'string'
                    ? event.timestamp
                    : (event.timestamp?.toDate?.()?.getTime?.()?.toString() || Date.now().toString()));

                const uniqueKey = `${voucherDoc.id}_${vendorId}_${timestampKey}_${index}`;

                transactions.push({
                  id: uniqueKey,
                  voucherId: voucherDoc.id,
                  voucherNo: voucherData.voucher_no || `V-${voucherDoc.id.substring(0, 6)}`,
                  itemName: voucherData.item_details?.item_name || voucherData.item || '',
                  jobWorkDone: jobWorkDone,
                  quantity: netQty,
                  pricePerPiece: pricePerPiece,
                  totalAmount: totalAmount,
                  amountPaid: amountPaid,
                  pendingAmount: pendingAmount,
                  status: status as 'Paid' | 'Partially Paid' | 'Unpaid',
                  actionDate: actionDate,
                  type: 'voucher'
                });
              }
            }
          });
        }
      });

      // Sort transactions by action date (newest first)
      transactions.sort((a, b) => new Date(b.actionDate).getTime() - new Date(a.actionDate).getTime());

      console.log('Total transactions:', transactions.length);
      console.log('Transactions:', transactions);

      // Calculate total pending amount
      const totalPendingAmount = transactions
        .filter(t => t.pendingAmount > 0)
        .reduce((sum, t) => sum + t.pendingAmount, 0);

      setAllTransactions(transactions);
      setPendingPayments(totalPendingAmount);
      setLoadingTransactions(false);
    } catch (error) {
      console.error('Error loading all transactions:', error);
      setLoadingTransactions(false);
    }
  };

  // Filter and sort transactions
  const getFilteredAndSortedTransactions = () => {
    let filtered = allTransactions;

    // Apply filter
    switch (transactionFilter) {
      case 'paid':
        filtered = allTransactions.filter(t => t.status === 'Paid');
        break;
      case 'unpaid':
        filtered = allTransactions.filter(t => t.status === 'Unpaid');
        break;
      case 'partially':
        filtered = allTransactions.filter(t => t.status === 'Partially Paid');
        break;
      default:
        filtered = allTransactions;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (transactionSortBy) {
        case 'date':
          aValue = new Date(a.actionDate).getTime();
          bValue = new Date(b.actionDate).getTime();
          break;
        case 'amount':
          aValue = a.totalAmount;
          bValue = b.totalAmount;
          break;
        case 'voucher':
          aValue = a.voucherNo;
          bValue = b.voucherNo;
          break;
        default:
          aValue = new Date(a.actionDate).getTime();
          bValue = new Date(b.actionDate).getTime();
      }

      if (transactionSortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  };

  // Function to handle profile photo upload
  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePhotoFile(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Function to save profile photo to Firebase Storage
  const uploadProfilePhoto = async () => {
    if (!profilePhotoFile || !userData?.uid) {
      setSaveMessage({ type: 'error', message: 'No photo selected or user data not available' });
      return;
    }

    try {
      setIsUploadingPhoto(true);
      setSaving(true);

      // Create a storage reference
      const storageRef = ref(storage, `users/${userData.uid}/profile-photo`);

      // Create file metadata including the content type
      const metadata = {
        contentType: profilePhotoFile.type,
      };

      // Upload the file with metadata
      const uploadTask = uploadBytesResumable(storageRef, profilePhotoFile, metadata);

      // Monitor upload progress
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Calculate progress percentage
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Error uploading profile photo:', error);
          setSaveMessage({ type: 'error', message: 'Failed to upload profile photo. Please try again.' });
          setIsUploadingPhoto(false);
          setSaving(false);
        },
        async () => {
          // Upload completed successfully
          // Get download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Save URL to Firestore user document
          const userRef = doc(db, 'users', userData.uid);
          await updateDoc(userRef, {
            profilePhotoUrl: downloadURL
          });

          // Update local state
          setUserData(prev => ({
            ...prev!,
            profilePhotoUrl: downloadURL
          }));

          setSaveMessage({ type: 'success', message: 'Profile photo uploaded successfully' });
          setIsUploadingPhoto(false);
          setSaving(false);
        }
      );
    } catch (error) {
      console.error('Error in upload process:', error);
      setSaveMessage({ type: 'error', message: 'An unexpected error occurred. Please try again.' });
      setIsUploadingPhoto(false);
      setSaving(false);
    }
  };

  // Function to handle file uploads for KYC documents
  const handleFileUpload = (documentType: keyof KycDocuments) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setKycDocuments(prev => ({
        ...prev,
        [documentType]: file
      }));
    }
  };

  // Function to save KYC documents to Firebase
  const saveKycDocuments = async () => {
    if (!userData || !userData.uid) {
      setSaveMessage({ type: 'error', message: 'User data not available' });
      return;
    }

    try {
      setSaving(true);
      setSaveMessage({ type: '', message: '' });

      const updatedKycDocuments: KycDocuments = {};
      const uploadPromises = [];

      // Process each document
      for (const [docType, docFile] of Object.entries(kycDocuments)) {
        if (docFile) {
          // If it's a File object, upload to storage
          if (docFile instanceof File) {
            // Create a reference with a timestamp prefix to avoid name collisions
            const timestamp = new Date().getTime();
            const storageRef = ref(storage, `users/${userData.uid}/kyc/${docType}_${timestamp}`);

            console.log(`Uploading ${docType} to storage path: users/${userData.uid}/kyc/${docType}_${timestamp}`);

            const uploadTask = uploadBytesResumable(storageRef, docFile);

            const uploadPromise = new Promise<string>((resolve, reject) => {
              uploadTask.on(
                'state_changed',
                (snapshot) => {
                  const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                  console.log(`Upload progress for ${docType}: ${progress}%`);
                },
                (error) => {
                  console.error(`Error uploading ${docType}:`, error);
                  reject(error);
                },
                async () => {
                  const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                  console.log(`Successfully uploaded ${docType}, URL: ${downloadURL}`);
                  resolve(downloadURL);
                }
              );
            });

            uploadPromises.push(
              uploadPromise.then(url => {
                updatedKycDocuments[docType as keyof KycDocuments] = url;
              })
            );
          } else {
            // If it's already a URL (string), keep it
            updatedKycDocuments[docType as keyof KycDocuments] = docFile as string;
          }
        }
      }

      // Wait for all uploads to complete
      await Promise.all(uploadPromises);

      // Create a user document reference
      const userRef = doc(db, 'users', userData.uid);

      // Only update the KYC documents, not other user fields
      await updateDoc(userRef, {
        kycDocuments: updatedKycDocuments
      });

      setSaveMessage({ type: 'success', message: 'KYC documents saved successfully' });

      // Update local user data to reflect changes
      if (userData) {
        setUserData({
          ...userData,
          kycDocuments: updatedKycDocuments
        });
      }

      // Reset kycDocuments state with the new URLs
      setKycDocuments(updatedKycDocuments);
    } catch (error) {
      console.error('Error saving KYC documents:', error);
      setSaveMessage({ type: 'error', message: 'Failed to save documents. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // Format date for better display
  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';

    try {
      // Handle Firebase Timestamp
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate().toLocaleDateString();
      }

      // Handle serialized timestamps
      if (dateValue.seconds) {
        return new Date(dateValue.seconds * 1000).toLocaleDateString();
      }

      // Handle ISO strings
      if (typeof dateValue === 'string') {
        return new Date(dateValue).toLocaleDateString();
      }

      return new Date(dateValue).toLocaleDateString();
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Invalid date';
    }
  };

  // Backup functionality
  const handleBackupData = async () => {
    if (!userData || userData.role !== 'admin') {
      setSaveMessage({ type: 'error', message: 'Only admins can create backups' });
      return;
    }

    try {
      setIsBackingUp(true);
      setBackupProgress(0);
      setSaveMessage({ type: '', message: '' });

      const collections = ['users', 'payments', 'passwordChangeRequests'];
      const allData: any = {};
      const progressStep = 100 / (collections.length + 2); // +2 for vouchers and events

      // Handle regular collections
      for (let i = 0; i < collections.length; i++) {
        const collectionName = collections[i];
        setBackupProgress((i + 0.5) * progressStep);

        try {
          const collectionRef = collection(db, collectionName);
          const snapshot = await getDocs(collectionRef);

          const collectionData: any[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            // Convert Firebase timestamps to readable dates
            const processedData = processFirebaseData({ id: doc.id, ...data });
            collectionData.push(processedData);
          });

          allData[collectionName] = collectionData;
          setBackupProgress((i + 1) * progressStep);
        } catch (error) {
          console.error(`Error fetching ${collectionName}:`, error);
          allData[collectionName] = []; // Add empty array if collection fails
        }
      }

      // Handle vouchers with detailed events
      setBackupProgress((collections.length + 0.5) * progressStep);
      const voucherBackup = await createDetailedVoucherBackup();
      allData['vouchers'] = voucherBackup.vouchers;
      allData['voucher_events'] = voucherBackup.events;
      setBackupProgress((collections.length + 1) * progressStep);

      // Create Excel workbook
      const workbook = XLSX.utils.book_new();

      const localNow = new Date();

      // Create summary sheet
      const summaryData = [
        { 'Collection': 'Users', 'Count': allData.users?.length || 0, 'Description': 'All user accounts (admin and vendors)' },
        { 'Collection': 'Vouchers', 'Count': allData.vouchers?.length || 0, 'Description': 'All voucher records with complete data' },
        { 'Collection': 'Voucher Events', 'Count': allData.voucher_events?.length || 0, 'Description': 'Individual events within vouchers (dispatch, receive, forward)' },
        { 'Collection': 'Payments', 'Count': allData.payments?.length || 0, 'Description': 'All payment transactions' },
        // Notifications excluded
        { 'Collection': 'Password Requests', 'Count': allData.passwordChangeRequests?.length || 0, 'Description': 'Password change requests' },
        { 'Collection': 'Total Records', 'Count': Object.values(allData).reduce((sum: number, arr: any) => sum + (arr?.length || 0), 0), 'Description': 'Total records across all collections' },
        { 'Collection': 'Backup Date', 'Count': `${localNow.toLocaleDateString('en-GB')} ${localNow.toLocaleTimeString('en-GB')}`, 'Description': 'Date and time of backup creation' }
      ];

      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      (summaryWorksheet as any)['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 70 }];
      if ((summaryWorksheet as any)['!ref']) {
        (summaryWorksheet as any)['!autofilter'] = { ref: (summaryWorksheet as any)['!ref'] };
        (summaryWorksheet as any)['!freeze'] = { rows: 1, cols: 0 } as any;
      }
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

      // Add each collection as a separate worksheet with friendly formatting
      Object.keys(allData).forEach((rawCollectionName) => {
        const data = allData[rawCollectionName];
        if (!Array.isArray(data) || data.length === 0) return;
        const worksheet = createWorksheetForCollection(rawCollectionName, data);
        const safeName = sanitizeSheetName(toTitleCase(rawCollectionName));
        XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
      });

      // Generate filename with current date
      const now = new Date();
      const filename = `saree_management_backup_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}.xlsx`;

      // Save and download the file
      XLSX.writeFile(workbook, filename);

      setSaveMessage({ type: 'success', message: 'Backup created and downloaded successfully!' });
      setBackupProgress(100);
    } catch (error) {
      console.error('Error creating backup:', error);
      setSaveMessage({ type: 'error', message: 'Failed to create backup. Please try again.' });
    } finally {
      setIsBackingUp(false);
      setTimeout(() => {
        setBackupProgress(0);
        setSaveMessage({ type: '', message: '' });
      }, 3000);
    }
  };

  // Function to clear all data except users collection
  const handleClearAllData = async () => {
    // Check if user is admin
    if (userData?.role !== 'admin') {
      setSaveMessage({ type: 'error', message: 'Only administrators can clear data.' });
      return;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      '⚠️ WARNING: This action will permanently delete ALL data from the following collections:\n\n' +
      '• Vouchers and all voucher events\n' +
      '• Payments\n' +
      '• Notifications\n' +
      '• Vendor notifications\n' +
      '• Password change requests\n\n' +
      'This action CANNOT be undone. User accounts will be preserved.\n\n' +
      'Are you absolutely sure you want to proceed?'
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsClearingData(true);
      setClearProgress(0);
      setSaveMessage({ type: '', message: 'Starting data clearance process...' });

      // Define collections to clear (all except users)
      const collectionsToClear = [
        'vouchers',
        'payments',
        'notifications',
        'vendorNotifications',
        'passwordChangeRequests'
      ];

      let totalDeleted = 0;
      let totalDocuments = 0;

      // First, count total documents to calculate progress
      for (const collectionName of collectionsToClear) {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        totalDocuments += snapshot.size;
      }

      if (totalDocuments === 0) {
        setSaveMessage({ type: 'success', message: 'No data found to clear. All collections are already empty.' });
        setIsClearingData(false);
        setClearProgress(0);
        return;
      }

      // Clear each collection
      for (const collectionName of collectionsToClear) {
        setSaveMessage({ type: '', message: `Clearing ${collectionName} collection...` });

        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);

        // Delete documents in batches to avoid overwhelming the system
        const batchSize = 50;
        const documents = snapshot.docs;

        for (let i = 0; i < documents.length; i += batchSize) {
          const batch = documents.slice(i, i + batchSize);

          // Delete each document in the batch
          for (const docSnapshot of batch) {
            await deleteDoc(docSnapshot.ref);
            totalDeleted++;

            // Update progress
            const progress = (totalDeleted / totalDocuments) * 100;
            setClearProgress(progress);
          }

          // Small delay between batches to prevent overwhelming the system
          if (i + batchSize < documents.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      setSaveMessage({
        type: 'success',
        message: `Successfully cleared all data! Deleted ${totalDeleted} documents from ${collectionsToClear.length} collections.`
      });
      setClearProgress(100);

    } catch (error) {
      console.error('Error clearing data:', error);
      setSaveMessage({
        type: 'error',
        message: 'Failed to clear data. Please try again or contact support if the issue persists.'
      });
    } finally {
      setIsClearingData(false);
      setTimeout(() => {
        setClearProgress(0);
        setSaveMessage({ type: '', message: '' });
      }, 5000);
    }
  };

  // Helper function to process Firebase data and convert timestamps
  const processFirebaseData = (data: any): any => {
    const processed = { ...data };

    Object.keys(processed).forEach(key => {
      const value = processed[key];

      // Handle Firebase Timestamps
      if (value && typeof value === 'object' && value.toDate && typeof value.toDate === 'function') {
        processed[key] = value.toDate().toISOString();
      }
      // Handle objects with seconds property (serialized timestamps)
      else if (value && typeof value === 'object' && value.seconds) {
        processed[key] = new Date(value.seconds * 1000).toISOString();
      }
      // Handle nested objects/arrays
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        processed[key] = processFirebaseData(value);
      }
      // Handle arrays
      else if (Array.isArray(value)) {
        processed[key] = value.map(item =>
          typeof item === 'object' ? processFirebaseData(item) : item
        );
      }
    });

    return processed;
  };

  // Excel export helpers for non-technical readability
  interface ColumnConfig {
    headerLabel: string;
    dataKey?: string; // dot.notation path after flattening
    valueGetter?: (row: any, flatRow: Record<string, any>) => any; // compute value from row
    type?: 'text' | 'date' | 'currency' | 'number' | 'boolean';
    width?: number; // approximate characters
  }

  const toTitleCase = (rawKey: string): string => {
    const spaced = rawKey
      .replace(/[_.-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
    return spaced
      .split(' ')
      .map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');
  };

  const flattenObject = (obj: any, parentKey = '', result: Record<string, any> = {}): Record<string, any> => {
    if (obj === null || obj === undefined) return result;
    Object.keys(obj).forEach((key) => {
      const value = (obj as any)[key];
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      if (Array.isArray(value)) {
        if (value.every(v => ['string', 'number', 'boolean'].includes(typeof v))) {
          result[newKey] = value.join(', ');
        } else {
          result[newKey] = JSON.stringify(value);
        }
      } else if (value && typeof value === 'object' && !(value instanceof Date)) {
        flattenObject(value, newKey, result);
      } else {
        result[newKey] = value;
      }
    });
    return result;
  };

  const sanitizeSheetName = (name: string): string => {
    const invalid = /[\\\/*\[\]:?]/g;
    const cleaned = name.replace(invalid, ' ').trim();
    return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned || 'Sheet';
  };

  const inferTypeForKey = (key: string, values: any[]): ColumnConfig['type'] => {
    const keyLower = key.toLowerCase();
    if (/(date|time|created|updated|timestamp)/.test(keyLower)) return 'date';
    if (/(amount|price|total|balance|pay|paid|pending)/.test(keyLower)) return 'currency';
    if (/(qty|quantity|count|number|no\b|id$)/.test(keyLower)) return 'number';
    const nonNulls = values.filter(v => v !== null && v !== undefined);
    if (nonNulls.every(v => typeof v === 'number')) return 'number';
    if (nonNulls.every(v => typeof v === 'boolean')) return 'boolean';
    return 'text';
  };

  const buildAutoColumnsFromData = (rows: any[]): ColumnConfig[] => {
    if (!rows || rows.length === 0) return [];
    const sample = flattenObject(rows[0]);
    return Object.keys(sample).map((key) => ({
      headerLabel: toTitleCase(key),
      dataKey: key,
      type: inferTypeForKey(key, rows.map(r => flattenObject(r)[key]))
    }));
  };

  // Optional curated column orders for known collections
  const columnConfigsByCollection: Record<string, ColumnConfig[]> = {
    users: [
      { headerLabel: 'Code', dataKey: 'userCode', type: 'text', width: 12 },
      { headerLabel: 'Category', valueGetter: (row) => row.category || row.role || '', type: 'text', width: 12 },
      { headerLabel: 'Name', valueGetter: (row) => [row.firstName, row.surname].filter(Boolean).join(' '), type: 'text', width: 22 },
      { headerLabel: 'Email', dataKey: 'email', type: 'text', width: 26 },
      { headerLabel: 'Phone', dataKey: 'phone', type: 'text', width: 14 },
      { headerLabel: 'State', dataKey: 'address.state', type: 'text', width: 14 },
      { headerLabel: 'District', dataKey: 'address.district', type: 'text', width: 14 },
      { headerLabel: 'City', dataKey: 'address.city', type: 'text', width: 14 },
      { headerLabel: 'Address', dataKey: 'address.line1', type: 'text', width: 30 },
      { headerLabel: 'Company', dataKey: 'companyName', type: 'text', width: 20 },
      { headerLabel: 'Job Work', valueGetter: (row) => row.vendorJobWork || row.jobWork || '', type: 'text', width: 16 },
      { headerLabel: 'Designation', dataKey: 'designation', type: 'text', width: 16 },
      // Keep extra helpful fields as well
      { headerLabel: 'Role', dataKey: 'role', type: 'text', width: 12 },
      { headerLabel: 'KYC Status', dataKey: 'kycStatus', type: 'text', width: 14 },
    ],
    payments: [
      { headerLabel: 'Payment Date', dataKey: 'paymentDate', type: 'date', width: 14 },
      { headerLabel: 'Voucher No', dataKey: 'voucherNo', type: 'text', width: 14 },
      { headerLabel: 'Vendor Name', dataKey: 'vendorName', type: 'text', width: 20 },
      { headerLabel: 'Vendor Code', dataKey: 'vendorCode', type: 'text', width: 12 },
      { headerLabel: 'Work Done', dataKey: 'jobWorkDone', type: 'text', width: 18 },
      { headerLabel: 'Quantity', dataKey: 'netQty', type: 'number', width: 12 },
      { headerLabel: 'Price Per Piece (₹)', dataKey: 'pricePerPiece', type: 'currency', width: 18 },
      { headerLabel: 'Total Amount (₹)', dataKey: 'totalAmount', type: 'currency', width: 18 },
      { headerLabel: 'Amount Paid (₹)', dataKey: 'amountPaid', type: 'currency', width: 18 },
    ],
    vouchers: [
      // Mirror of AllVouchers.tsx table view with requested changes
      { headerLabel: 'Voucher No', dataKey: 'voucher_no', type: 'text', width: 16 },
      { headerLabel: 'Voucher Date', dataKey: 'created_at', type: 'date', width: 16 },
      { headerLabel: 'Voucher Created By', valueGetter: (row) => row.createdByName || row.created_by_user_id || 'N/A', type: 'text', width: 24 },
      { headerLabel: 'Forwarded To', valueGetter: (row) => row.vendorName || 'N/A', type: 'text', width: 22 },
      { headerLabel: 'Vendor Code', valueGetter: (row) => row.userCode ?? 'N/A', type: 'text', width: 12 },
      { headerLabel: 'Item', dataKey: 'item_details.item_name', type: 'text', width: 20 },
      { headerLabel: 'Qty', dataKey: 'item_details.initial_quantity', type: 'number', width: 10 },
      { headerLabel: 'Job Work', valueGetter: (row) => row.vendorJobWork || '', type: 'text', width: 16 },
      { headerLabel: 'LR Date', valueGetter: (row) => row.events?.find((e: any) => e.event_type === 'dispatch')?.details?.transport?.lr_date || '', type: 'date', width: 14 },
      { headerLabel: 'LR Number', valueGetter: (row) => row.events?.find((e: any) => e.event_type === 'dispatch')?.details?.transport?.lr_no || '', type: 'text', width: 16 },
      { headerLabel: 'Transport Name', valueGetter: (row) => row.events?.find((e: any) => e.event_type === 'dispatch')?.details?.transport?.transporter_name || '', type: 'text', width: 18 },
      { headerLabel: 'Status', dataKey: 'voucher_status', type: 'text', width: 14 },
    ],
    voucher_events: [
      // Enriched event export with voucher context
      { headerLabel: 'Voucher No', dataKey: 'voucher_no', type: 'text', width: 16 },
      { headerLabel: 'Event ID', dataKey: 'event_id', type: 'text', width: 18 },
      { headerLabel: 'Event Type', dataKey: 'event_type', type: 'text', width: 14 },
      { headerLabel: 'Timestamp', dataKey: 'timestamp', type: 'date', width: 18 },
      { headerLabel: 'Sender (User ID)', dataKey: 'details.sender_id', type: 'text', width: 24 },
      { headerLabel: 'Receiver (User ID)', dataKey: 'details.receiver_id', type: 'text', width: 24 },
      { headerLabel: 'Job Work', dataKey: 'details.jobWork', type: 'text', width: 16 },
      { headerLabel: 'Qty Dispatched', dataKey: 'details.quantity_dispatched', type: 'number', width: 14 },
      { headerLabel: 'Qty Expected', dataKey: 'details.quantity_expected', type: 'number', width: 14 },
      { headerLabel: 'Qty Received', dataKey: 'details.quantity_received', type: 'number', width: 14 },
      { headerLabel: 'Qty Before Job', dataKey: 'details.quantity_before_job', type: 'number', width: 16 },
      { headerLabel: 'Qty Forwarded', dataKey: 'details.quantity_forwarded', type: 'number', width: 14 },
      { headerLabel: 'Price Per Piece (₹)', dataKey: 'details.price_per_piece', type: 'currency', width: 18 },
      { headerLabel: 'Transport Name', dataKey: 'details.transport.transporter_name', type: 'text', width: 20 },
      { headerLabel: 'LR Number', dataKey: 'details.transport.lr_no', type: 'text', width: 16 },
      { headerLabel: 'LR Date', dataKey: 'details.transport.lr_date', type: 'date', width: 16 },
      { headerLabel: 'Missing On Arrival', dataKey: 'details.discrepancies.missing', type: 'number', width: 18 },
      { headerLabel: 'Damaged On Arrival', dataKey: 'details.discrepancies.damaged_on_arrival', type: 'number', width: 20 },
      { headerLabel: 'Damaged After Job', dataKey: 'details.discrepancies.damaged_after_job', type: 'number', width: 18 },
      { headerLabel: 'Damage Reason', dataKey: 'details.discrepancies.damage_reason', type: 'text', width: 24 },
      { headerLabel: 'Comment', dataKey: 'comment', type: 'text', width: 30 },
    ],
    notifications: [],
    vendorNotifications: [],
    passwordChangeRequests: [],
  };

  const getValueByPath = (obj: any, path: string): any => {
    if (!path) return undefined;
    return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
  };

  const createWorksheetForCollection = (collectionName: string, data: any[]) => {
    if (!data || data.length === 0) {
      return XLSX.utils.aoa_to_sheet([[`No records in ${toTitleCase(collectionName)}`]]);
    }

    const flatRows = data.map((row) => flattenObject(row));

    let columns: ColumnConfig[] = columnConfigsByCollection[collectionName] && columnConfigsByCollection[collectionName].length > 0
      ? columnConfigsByCollection[collectionName]
      : buildAutoColumnsFromData(flatRows);

    const headers = columns.map(c => c.headerLabel);
    const body = flatRows.map((flatRow, idx) => {
      const row = data[idx];
      const shaped: Record<string, any> = {};
      columns.forEach((col) => {
        let value: any;
        if (col.valueGetter) {
          value = col.valueGetter(row, flatRow);
        } else if (col.dataKey) {
          value = getValueByPath(flatRow, col.dataKey);
        } else {
          value = '';
        }
        if (value === undefined || value === null) {
          shaped[col.headerLabel] = '';
          return;
        }
        switch (col.type) {
          case 'date': {
            try {
              const d = typeof value === 'string' ? new Date(value) : value;
              shaped[col.headerLabel] = isNaN(new Date(d).getTime())
                ? String(value)
                : new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            } catch {
              shaped[col.headerLabel] = String(value);
            }
            break;
          }
          case 'currency': {
            const num = Number(value);
            shaped[col.headerLabel] = isNaN(num) ? String(value) : num;
            break;
          }
          case 'number': {
            const num = Number(value);
            shaped[col.headerLabel] = isNaN(num) ? String(value) : num;
            break;
          }
          case 'boolean':
            shaped[col.headerLabel] = value ? 'Yes' : 'No';
            break;
          default:
            shaped[col.headerLabel] = String(value);
        }
      });
      return shaped;
    });

    const ws = XLSX.utils.json_to_sheet(body, { header: headers, skipHeader: false });

    const cols = headers.map((header, i) => {
      const configured = columns[i]?.width || 0;
      const maxContent = Math.max(
        header.length,
        ...body.map(r => (r[header] !== undefined && r[header] !== null) ? String(r[header]).length : 0)
      );
      return { wch: Math.min(Math.max(configured || maxContent + 2, 10), 60) };
    });
    (ws as any)['!cols'] = cols;

    if ((ws as any)['!ref']) {
      (ws as any)['!autofilter'] = { ref: (ws as any)['!ref'] };
    }
    (ws as any)['!freeze'] = { rows: 1, cols: 0 } as any;

    const range = XLSX.utils.decode_range((ws as any)['!ref'] as string);
    headers.forEach((header, colIdx) => {
      const colType = columns[colIdx]?.type;
      if (colType === 'currency' || colType === 'number') {
        for (let r = range.s.r + 1; r <= range.e.r; r++) {
          const addr = XLSX.utils.encode_cell({ r, c: colIdx });
          const cell = (ws as any)[addr];
          if (!cell) continue;
          if (typeof cell.v === 'number') {
            cell.t = 'n';
            if (colType === 'currency') {
              cell.z = '₹#,##0.00';
            } else {
              cell.z = '#,##0';
            }
          }
        }
      }
    });

    return ws;
  };

  // Enhanced function to create detailed voucher backup with events
  const createDetailedVoucherBackup = async () => {
    try {
      const vouchersRef = collection(db, 'vouchers');
      const snapshot = await getDocs(vouchersRef);

      const vouchersData: any[] = [];
      const eventsData: any[] = [];

      // Build user map for name/code lookups
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const userMap: Record<string, { firstName?: string; surname?: string; userCode?: string; companyName?: string }> = {};
      usersSnapshot.forEach(u => {
        const d = u.data() as any;
        userMap[u.id] = {
          firstName: d.firstName,
          surname: d.surname,
          userCode: d.userCode,
          companyName: d.companyName,
        };
      });

      snapshot.forEach((doc) => {
        const voucher = doc.data();
        const voucherId = doc.id;

        // Process main voucher data
        const processedVoucher = processFirebaseData({
          id: voucherId,
          ...voucher
        });
        // Enrich voucher with fields used in AllVouchers.tsx
        try {
          // Creator name
          if (voucher.created_by_user_id) {
            const creator = userMap[voucher.created_by_user_id];
            if (creator) {
              const fullName = [creator.firstName, creator.surname].filter(Boolean).join(' ').trim();
              processedVoucher.createdByName = fullName || voucher.created_by_user_id;
            } else {
              processedVoucher.createdByName = voucher.created_by_user_id;
            }
          }
          // Dispatch receiver → Forwarded To and Vendor Code
          const dispatchEvent = voucher.events?.find((e: any) => e.event_type === 'dispatch');
          const receiverId = dispatchEvent?.details?.receiver_id;
          if (receiverId) {
            const receiver = userMap[receiverId];
            if (receiver) {
              const rName = [receiver.firstName, receiver.surname].filter(Boolean).join(' ').trim();
              processedVoucher.vendorName = rName || receiver.companyName || receiverId;
              processedVoucher.userCode = receiver.userCode || 'N/A';
            } else {
              processedVoucher.vendorName = receiverId;
              processedVoucher.userCode = 'N/A';
            }
            processedVoucher.vendorJobWork = processedVoucher.vendorJobWork || dispatchEvent?.details?.jobWork || '';
          }
        } catch { }

        vouchersData.push(processedVoucher);

        // Extract and process events separately for better analysis
        if (voucher.events && Array.isArray(voucher.events)) {
          voucher.events.forEach((event: any, index: number) => {
            const processedEvent = processFirebaseData({
              voucher_id: voucherId,
              voucher_no: voucher.voucher_no,
              event_index: index + 1,
              ...event
            });
            eventsData.push(processedEvent);
          });
        }
      });

      return { vouchers: vouchersData, events: eventsData };
    } catch (error) {
      console.error('Error creating detailed voucher backup:', error);
      return { vouchers: [], events: [] };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-800">Loading profile data...</p>
        </div>
      </div>
    );
  }

  const displayAddress = () => {
    if (!userData?.address) return 'Not provided';

    if (typeof userData.address === 'string') {
      return userData.address;
    } else {
      // Format the address object into a string
      const addr = userData.address as AddressObject;
      return `${addr.line1}, ${addr.city}, ${addr.district}, ${addr.state}, ${addr.country} - ${addr.pincode}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 py-4">
      <div className="max-w-7xl mx-auto px-0 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden p-0 ">
          {/* Enhanced Header */}
          <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 py-6 px-4 sm:py-8 sm:px-8">
            {/* Mobile header (image left of heading) */}
            <div className="sm:hidden text-white">
              <div className="flex items-center">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border-4 border-white shadow-lg">
                  {profilePhotoUrl ? (
                    <Image src={profilePhotoUrl} alt="Profile" fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full w-full bg-white/20 ">
                      <User className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>
                <div className="ml-3">
                  <h1 className="text-2xl font-bold">My Profile</h1>
                </div>
              </div>

              {userData?.role === 'admin' && (
                <div className="mt-3 flex items-center space-x-2">
                  <input
                    type="file"
                    id="profile-photo-upload-mobile"
                    className="hidden"
                    accept="image/*"
                    onChange={handleProfilePhotoUpload}
                  />
                  <label
                    htmlFor="profile-photo-upload-mobile"
                    className="cursor-pointer bg-white text-blue-700 px-3 py-1.5 rounded-md text-xs font-medium shadow hover:bg-blue-50 transition-all duration-200"
                  >
                    Add Photo
                  </label>
                  {profilePhotoFile && !isUploadingPhoto && (
                    <button
                      onClick={uploadProfilePhoto}
                      className="bg-white/90 text-blue-700 px-3 py-1.5 rounded-md text-xs font-semibold shadow hover:bg-white"
                    >
                      Upload
                    </button>
                  )}
                </div>
              )}

              {isUploadingPhoto && (
                <div className="mt-2 text-[11px] text-white w-full max-w-[200px]">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Uploading: {uploadProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-1 mt-1">
                    <div className="bg-white h-1 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop header (image left of heading with add photo below image) */}
            <div className="hidden sm:flex items-center justify-between text-white">
              <div className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-white shadow-lg">
                    {profilePhotoUrl ? (
                      <Image src={profilePhotoUrl} alt="Profile" fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full">
                        <User className="h-10 w-10 text-white" />
                      </div>
                    )}
                  </div>
                  {userData?.role === 'admin' && (
                    <div className="mt-2">
                      <input
                        type="file"
                        id="profile-photo-upload-desktop"
                        className="hidden"
                        accept="image/*"
                        onChange={handleProfilePhotoUpload}
                      />
                      <label
                        htmlFor="profile-photo-upload-desktop"
                        className="cursor-pointer bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-all duration-200 inline-block border border-white/30 text-sm"
                      >
                        Add Photo
                      </label>
                      {profilePhotoFile && !isUploadingPhoto && (
                        <button
                          onClick={uploadProfilePhoto}
                          className="ml-2 bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-all duration-200 font-medium text-sm"
                        >
                          Upload
                        </button>
                      )}
                      {isUploadingPhoto && (
                        <div className="mt-2 text-xs text-white">
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                            <span>Uploading: {uploadProgress.toFixed(0)}%</span>
                          </div>
                          <div className="w-32 bg-white/20 rounded-full h-1 mt-1">
                            <div className="bg-white h-1 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="ml-6">
                  <h1 className="text-3xl font-bold">My Profile</h1>
                  <p className="text-blue-100 mt-1">Manage your account and preferences</p>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => setActiveTab('personal')}
                className={`px-4 py-3 sm:px-6 sm:py-4 font-medium text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${activeTab === 'personal'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-white/50'
                  }`}
              >
                <User className="h-4 w-4 inline mr-2" />
                Personal Details
              </button>
              {userData?.role !== 'admin' && (
                <button
                  onClick={() => setActiveTab('kyc')}
                  className={`px-4 py-3 sm:px-6 sm:py-4 font-medium text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${activeTab === 'kyc'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-white/50'
                    }`}
                >
                  <Shield className="h-4 w-4 inline mr-2" />
                  KYC Documents
                </button>
              )}
              {userData?.role !== 'admin' && (
                <button
                  onClick={() => setActiveTab('account')}
                  className={`px-4 py-3 sm:px-6 sm:py-4 font-medium text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${activeTab === 'account'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-white/50'
                    }`}
                >
                  <CreditCard className="h-4 w-4 inline mr-2" />
                  My Account
                </button>
              )}
              {/* {userData?.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-4 py-3 sm:px-6 sm:py-4 font-medium text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${activeTab === 'settings'
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-white/50'
                    }`}
                >
                  <Settings className="h-4 w-4 inline mr-2" />
                  Settings
                </button>
              )} */}
            </div>
          </div>

          {/* Status Messages */}
          {saveMessage.message && (
            <div className={`mx-8 mt-6 p-4 rounded-lg border-l-4 ${saveMessage.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-400'
              : 'bg-red-50 text-red-800 border-red-400'
              }`}>
              <div className="flex items-center">
                {saveMessage.type === 'success' ? (
                  <div className="h-5 w-5 bg-green-400 rounded-full flex items-center justify-center mr-3">
                    <div className="h-2 w-2 bg-white rounded-full"></div>
                  </div>
                ) : (
                  <AlertTriangle className="h-5 w-5 mr-3" />
                )}
                {saveMessage.message}
              </div>
            </div>
          )}

          <div className="p-1 lg:p-4 pt-2">
            {/* Personal Details Tab */}
            {activeTab === 'personal' && userData && (
              <div>
                <h2 className="text-2xl pt-2 pl-2 font-bold text-gray-800 mb-4 flex items-center">
                  <User className="h-6 w-6 mr-1 text-blue-600" />
                  Personal Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-2">First Name</h3>
                    <p className="text-lg text-blue-900 font-medium">{userData.firstName || 'N/A'}</p>
                    <p className="text-xs text-blue-500 mt-2">Added by admin - cannot be changed</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-2">Surname</h3>
                    <p className="text-lg text-blue-900 font-medium">{userData.surname || 'N/A'}</p>
                    <p className="text-xs text-blue-500 mt-2">Added by admin - cannot be changed</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-2">Phone</h3>
                    <p className="text-lg text-blue-900 font-medium">{userData.phone || 'N/A'}</p>
                    <p className="text-xs text-blue-500 mt-2">Added by admin - cannot be changed</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-2">Email</h3>
                    <p className="text-lg text-blue-900 font-medium">{userData.email || 'N/A'}</p>
                    <p className="text-xs text-blue-500 mt-2">Added by admin - cannot be changed</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-2">Company Name</h3>
                    <p className="text-lg text-blue-900 font-medium">{userData.companyName || 'N/A'}</p>
                    <p className="text-xs text-blue-500 mt-2">Added by admin - cannot be changed</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-2">Address</h3>
                    <p className="text-lg text-blue-900 font-medium">{displayAddress()}</p>
                    <p className="text-xs text-blue-500 mt-2">Added by admin - cannot be changed</p>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-800 mt-12 mb-4 flex items-center">
                  <Package className="h-6 w-6 mr-3 text-blue-600" />
                  Work Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-6">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 sm:p-6 rounded-xl border border-green-200">
                    <h3 className="text-sm font-semibold text-green-700 mb-2">Code</h3>
                    <p className="text-lg text-green-900 font-medium">{userData.userCode || 'N/A'}</p>
                    <p className="text-xs text-green-500 mt-2">Added by admin - cannot be changed</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 sm:p-6 rounded-xl border border-green-200">
                    <h3 className="text-sm font-semibold text-green-700 mb-2">Category</h3>
                    <p className="text-lg text-green-900 font-medium">
                      {(userData.category || userData.role || 'N/A').charAt(0).toUpperCase() +
                        (userData.category || userData.role || 'N/A').slice(1)}
                    </p>
                    <p className="text-xs text-green-500 mt-2">Added by admin - cannot be changed</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 sm:p-6 rounded-xl border border-green-200">
                    <h3 className="text-sm font-semibold text-green-700 mb-2">Work</h3>
                    <p className="text-lg text-green-900 font-medium">{userData.vendorJobWork || 'Not provided'}</p>
                    <p className="text-xs text-green-500 mt-2">Added by admin - cannot be changed</p>
                  </div>
                </div>
              </div>
            )}

            {/* KYC Documents Tab */}
            {activeTab === 'kyc' && userData && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <Shield className="h-6 w-6 mr-3 text-blue-600" />
                    KYC Documents
                  </h2>
                  {userData?.role === 'vendor' && kycStatus !== 'Verified' && (
                    <button
                      onClick={saveKycDocuments}
                      disabled={saving}
                      className="flex items-center px-3 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-blue-300 disabled:to-blue-400 transition-all duration-200 shadow-lg"
                    >
                      {saving ? (
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Documents
                    </button>
                  )}
                </div>

                {/* Display KYC Status */}
                {kycStatus && (
                  <div className={`mb-6 p-4 rounded-lg border-l-4 text-center font-medium ${kycStatus === 'Verified' ? 'bg-green-50 text-green-800 border-green-400' :
                    kycStatus === 'Rejected' ? 'bg-red-50 text-red-800 border-red-400' :
                      'bg-yellow-50 text-yellow-800 border-yellow-400'
                    }`}>
                    <div className="flex items-center justify-center">
                      {kycStatus === 'Verified' ? (
                        <div className="h-5 w-5 bg-green-400 rounded-full flex items-center justify-center mr-3">
                          <div className="h-2 w-2 bg-white rounded-full"></div>
                        </div>
                      ) : kycStatus === 'Rejected' ? (
                        <AlertTriangle className="h-5 w-5 mr-3" />
                      ) : (
                        <div className="h-5 w-5 bg-yellow-400 rounded-full flex items-center justify-center mr-3">
                          <div className="h-2 w-2 bg-white rounded-full"></div>
                        </div>
                      )}
                      KYC Status: {kycStatus}
                    </div>
                  </div>
                )}

                {/* Display save message if any */}
                {saveMessage.message && (
                  <div className={`mb-4 p-3 rounded-md ${saveMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {saveMessage.message}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-6">
                  {/* Photo */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3">Photo</h3>
                    <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40 shadow-sm">
                      {kycDocuments.photo && typeof kycDocuments.photo === 'string' && kycDocuments.photo.length > 0 ? (
                        <div className="relative h-32 w-32">
                          {kycDocuments.photo.endsWith('.pdf') ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <FileText className="h-12 w-12 text-blue-500" />
                              <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                            </div>
                          ) : (
                            <Image
                              src={kycDocuments.photo || '/placeholder-image.png'}
                              alt="Photo"
                              fill
                              className="object-cover rounded"
                              onError={(e) => (e.currentTarget.src = '/placeholder-image.png')}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                          <p className="text-sm text-blue-600">Upload Photo</p>
                        </div>
                      )}
                    </div>
                    {userData?.role === 'vendor' && kycStatus !== 'Verified' && (
                      <div className="mt-4">
                        <label className="block w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center rounded-lg cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-medium">
                          Upload Photo
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileUpload('photo')}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Aadhar */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3">Aadhar</h3>
                    <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40 shadow-sm">
                      {kycDocuments.aadhar && typeof kycDocuments.aadhar === 'string' && kycDocuments.aadhar.length > 0 ? (
                        <div className="relative h-32 w-full">
                          {kycDocuments.aadhar.endsWith('.pdf') ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <FileText className="h-12 w-12 text-blue-500" />
                              <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                            </div>
                          ) : (
                            <Image
                              src={kycDocuments.aadhar || '/placeholder-image.png'}
                              alt="Aadhar"
                              fill
                              className="object-contain"
                              onError={(e) => (e.currentTarget.src = '/placeholder-image.png')}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                          <p className="text-sm text-blue-600">Upload Aadhar</p>
                        </div>
                      )}
                    </div>
                    {userData?.role === 'vendor' && kycStatus !== 'Verified' && (
                      <div className="mt-4">
                        <label className="block w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center rounded-lg cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-medium">
                          Upload Aadhar
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload('aadhar')}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Company ID */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3">Company ID</h3>
                    <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40 shadow-sm">
                      {kycDocuments.companyId && typeof kycDocuments.companyId === 'string' && kycDocuments.companyId.length > 0 ? (
                        <div className="relative h-32 w-full">
                          {kycDocuments.companyId.endsWith('.pdf') ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <FileText className="h-12 w-12 text-blue-500" />
                              <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                            </div>
                          ) : (
                            <Image
                              src={kycDocuments.companyId || '/placeholder-image.png'}
                              alt="Company ID"
                              fill
                              className="object-contain"
                              onError={(e) => (e.currentTarget.src = '/placeholder-image.png')}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                          <p className="text-sm text-blue-600">Upload Company ID</p>
                        </div>
                      )}
                    </div>
                    {userData?.role === 'vendor' && kycStatus !== 'Verified' && (
                      <div className="mt-4">
                        <label className="block w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center rounded-lg cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-medium">
                          Upload Company ID
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload('companyId')}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Driving License */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3">Driving License</h3>
                    <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40 shadow-sm">
                      {kycDocuments.drivingLicense && typeof kycDocuments.drivingLicense === 'string' && kycDocuments.drivingLicense.length > 0 ? (
                        <div className="relative h-32 w-full">
                          {kycDocuments.drivingLicense.endsWith('.pdf') ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <FileText className="h-12 w-12 text-blue-500" />
                              <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                            </div>
                          ) : (
                            <Image
                              src={kycDocuments.drivingLicense || '/placeholder-image.png'}
                              alt="Driving License"
                              fill
                              className="object-contain"
                              onError={(e) => (e.currentTarget.src = '/placeholder-image.png')}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                          <p className="text-sm text-blue-600">Upload Driving License</p>
                        </div>
                      )}
                    </div>
                    {userData?.role === 'vendor' && kycStatus !== 'Verified' && (
                      <div className="mt-4">
                        <label className="block w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center rounded-lg cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-medium">
                          Upload Driving License
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload('drivingLicense')}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* GSTIN */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3">GSTIN</h3>
                    <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40 shadow-sm">
                      {kycDocuments.gstin && typeof kycDocuments.gstin === 'string' && kycDocuments.gstin.length > 0 ? (
                        <div className="relative h-32 w-full">
                          {kycDocuments.gstin.endsWith('.pdf') ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <FileText className="h-12 w-12 text-blue-500" />
                              <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                            </div>
                          ) : (
                            <Image
                              src={kycDocuments.gstin || '/placeholder-image.png'}
                              alt="GSTIN"
                              fill
                              className="object-contain"
                              onError={(e) => (e.currentTarget.src = '/placeholder-image.png')}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                          <p className="text-sm text-blue-600">Upload GSTIN</p>
                        </div>
                      )}
                    </div>
                    {userData?.role === 'vendor' && kycStatus !== 'Verified' && (
                      <div className="mt-4">
                        <label className="block w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center rounded-lg cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-medium">
                          Upload GSTIN
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload('gstin')}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* PAN Card */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3">PAN Card</h3>
                    <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40 shadow-sm">
                      {kycDocuments.pancard && typeof kycDocuments.pancard === 'string' && kycDocuments.pancard.length > 0 ? (
                        <div className="relative h-32 w-full">
                          {kycDocuments.pancard.endsWith('.pdf') ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <FileText className="h-12 w-12 text-blue-500" />
                              <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                            </div>
                          ) : (
                            <Image
                              src={kycDocuments.pancard || '/placeholder-image.png'}
                              alt="PAN Card"
                              fill
                              className="object-contain"
                              onError={(e) => (e.currentTarget.src = '/placeholder-image.png')}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                          <p className="text-sm text-blue-600">Upload PAN Card</p>
                        </div>
                      )}
                    </div>
                    {userData?.role === 'vendor' && kycStatus !== 'Verified' && (
                      <div className="mt-4">
                        <label className="block w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center rounded-lg cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-medium">
                          Upload PAN Card
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload('pancard')}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Passport */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3">Passport</h3>
                    <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40 shadow-sm">
                      {kycDocuments.passport && typeof kycDocuments.passport === 'string' && kycDocuments.passport.length > 0 ? (
                        <div className="relative h-32 w-full">
                          {kycDocuments.passport.endsWith('.pdf') ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <FileText className="h-12 w-12 text-blue-500" />
                              <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                            </div>
                          ) : (
                            <Image
                              src={kycDocuments.passport || '/placeholder-image.png'}
                              alt="Passport"
                              fill
                              className="object-contain"
                              onError={(e) => (e.currentTarget.src = '/placeholder-image.png')}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                          <p className="text-sm text-blue-600">Upload Passport</p>
                        </div>
                      )}
                    </div>
                    {userData?.role === 'vendor' && kycStatus !== 'Verified' && (
                      <div className="mt-4">
                        <label className="block w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center rounded-lg cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-medium">
                          Upload Passport
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload('passport')}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Voter ID */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                    <h3 className="text-sm font-semibold text-blue-700 mb-3">Voter ID</h3>
                    <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40 shadow-sm">
                      {kycDocuments.voterId && typeof kycDocuments.voterId === 'string' && kycDocuments.voterId.length > 0 ? (
                        <div className="relative h-32 w-full">
                          {kycDocuments.voterId.endsWith('.pdf') ? (
                            <div className="flex flex-col items-center justify-center h-full">
                              <FileText className="h-12 w-12 text-blue-500" />
                              <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                            </div>
                          ) : (
                            <Image
                              src={kycDocuments.voterId || '/placeholder-image.png'}
                              alt="Voter ID"
                              fill
                              className="object-contain"
                              onError={(e) => (e.currentTarget.src = '/placeholder-image.png')}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                          <p className="text-sm text-blue-600">Upload Voter ID</p>
                        </div>
                      )}
                    </div>
                    {userData?.role === 'vendor' && kycStatus !== 'Verified' && (
                      <div className="mt-4">
                        <label className="block w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center rounded-lg cursor-pointer hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm font-medium">
                          Upload Voter ID
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={handleFileUpload('voterId')}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Account Tab */}
            {activeTab === 'account' && userData && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 pl-3 p-2 flex items-center">
                  <CreditCard className="h-6 w-6 mr-3 text-blue-600" />
                  My Account
                </h2>

                {/* Payment Summary Card (compact with refresh) */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-1 sm:p-4 rounded-xl border border-blue-200 mb-6">
                  <div className="flex items-center justify-between pt-3 px-2">
                    <h3 className="text-lg font-bold text-blue-800 flex items-center">
                      <IndianRupee className="h-4 w-4 mr-2" />
                      Payment Summary
                    </h3>
                    <button
                      onClick={handleRefreshAccount}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-blue-300 bg-white text-blue-700 hover:bg-blue-50"
                      title="Refresh payments"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center">
                          <IndianRupee className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 font-medium">Total Payments Received</p>
                          <p className="text-2xl font-bold text-green-600 leading-tight">₹{totalPaid.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-sm border border-red-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center">
                          <CreditCard className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 font-medium">Pending Payments</p>
                          <p className="text-2xl font-bold text-red-600 leading-tight">₹{pendingPayments.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* All Transactions Section */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-1 sm:p-8 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-between pt-4 pl-2 mb-6">
                    <h3 className="text-lg font-bold text-blue-800 flex items-center">
                      <Package className="h-5 w-5 mr-2" />
                      All Transactions
                    </h3>
                  </div>

                  {/* Filter and Sort Controls */}
                  <div className="mb-6 flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                    {/* Filter Controls */}
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-semibold text-blue-700">Filter:</label>
                      <select
                        value={transactionFilter}
                        onChange={(e) => setTransactionFilter(e.target.value as any)}
                        className="px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="all">All Transactions</option>
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="partially">Partially Paid</option>
                      </select>
                    </div>

                    {/* Sort Controls */}
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-semibold text-blue-700">Sort by:</label>
                      <select
                        value={transactionSortBy}
                        onChange={(e) => setTransactionSortBy(e.target.value as any)}
                        className="px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="date">Date</option>
                        <option value="amount">Amount</option>
                        <option value="voucher">Voucher</option>
                      </select>
                      <button
                        onClick={() => setTransactionSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-xs hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm"
                      >
                        {transactionSortOrder === 'asc' ? '↑' : '↓'}
                      </button>
                    </div>

                    {/* Transaction Count */}
                    <div className="text-sm text-blue-600 font-medium">
                      Showing {getFilteredAndSortedTransactions().length} of {allTransactions.length} transactions
                    </div>
                  </div>

                  {loadingTransactions ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-blue-600">Loading transactions...</p>
                    </div>
                  ) : getFilteredAndSortedTransactions().length > 0 ? (
                    <>
                      {/* Mobile list view */}
                      <div className="space-y-3 md:hidden">
                        {getFilteredAndSortedTransactions().map((transaction) => (
                          <div key={transaction.id} className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-blue-600">
                                {new Date(transaction.actionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                              <span className={`inline-flex px-2.5 py-0.5 text-[10px] font-semibold rounded-full ${transaction.status === 'Paid' ? 'bg-green-100 text-green-800' : transaction.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                {transaction.status}
                              </span>
                            </div>
                            <div className="mt-1 text-blue-800 font-semibold text-sm">{transaction.voucherNo}</div>
                            {transaction.itemName && (
                              <div className="text-[11px] text-blue-600">{transaction.itemName}</div>
                            )}
                            <div className="mt-2 text-sm text-blue-800">{transaction.jobWorkDone}</div>
                            <div className="text-[11px] text-blue-600">{transaction.quantity} pcs × ₹{transaction.pricePerPiece}/pc</div>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              <div className="bg-blue-50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-blue-600">Total</div>
                                <div className="text-sm font-semibold text-blue-800">₹{transaction.totalAmount.toLocaleString('en-IN')}</div>
                              </div>
                              <div className="bg-green-50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-green-600">Paid</div>
                                <div className="text-sm font-semibold text-green-700">₹{transaction.amountPaid.toLocaleString('en-IN')}</div>
                              </div>
                              <div className="bg-red-50 rounded-lg p-2 text-center">
                                <div className="text-[10px] text-red-600">Pending</div>
                                <div className="text-sm font-semibold text-red-700">₹{transaction.pendingAmount.toLocaleString('en-IN')}</div>
                              </div>
                            </div>
                            <div className="mt-2 text-[10px] text-gray-500">{transaction.type === 'payment' ? 'Payment' : 'Work Done'}{transaction.paymentDate ? ` • Paid: ${new Date(transaction.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}</div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop table view */}
                      <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-lg hidden md:block">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-blue-200">
                            <thead className="bg-gradient-to-r from-blue-50 to-blue-100">
                              <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">
                                  Date
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">
                                  Voucher
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">
                                  Item & Work Done
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">
                                  Amount Details
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-blue-100">
                              {getFilteredAndSortedTransactions().map((transaction) => (
                                <tr key={transaction.id} className="hover:bg-blue-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-800">
                                    {new Date(transaction.actionDate).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                    {transaction.paymentDate && (
                                      <div className="text-xs text-green-600 font-medium">
                                        Paid: {new Date(transaction.paymentDate).toLocaleDateString('en-GB', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric'
                                        })}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-blue-800 font-medium">{transaction.voucherNo}</div>
                                    {transaction.itemName && (
                                      <div className="text-xs text-blue-600">{transaction.itemName}</div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-blue-800">{transaction.jobWorkDone}</div>
                                    <div className="text-xs text-blue-600">
                                      {transaction.quantity} pcs × ₹{transaction.pricePerPiece}/pc
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-blue-800">
                                      Total: ₹{transaction.totalAmount.toLocaleString('en-IN')}
                                    </div>
                                    {transaction.amountPaid > 0 && (
                                      <div className="text-xs text-green-600 font-medium">
                                        Paid: ₹{transaction.amountPaid.toLocaleString('en-IN')}
                                      </div>
                                    )}
                                    {transaction.pendingAmount > 0 && (
                                      <div className="text-xs text-red-600 font-medium">
                                        Pending: ₹{transaction.pendingAmount.toLocaleString('en-IN')}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${transaction.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                      transaction.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                      }`}>
                                      {transaction.status}
                                    </span>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {transaction.type === 'payment' ? 'Payment' : 'Work Done'}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl bg-white p-8 border border-blue-200 text-center shadow-lg">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package className="h-8 w-8 text-blue-600" />
                      </div>
                      <p className="text-lg font-bold text-blue-600">No Transactions Found</p>
                      <p className="text-sm text-blue-500 mt-2">
                        {transactionFilter === 'all'
                          ? 'Your transaction history will appear here once you complete work or receive payments.'
                          : `No ${transactionFilter} transactions found.`
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Settings Tab - NEW */}
            {activeTab === 'settings' && userData && userData.role === 'admin' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-8 flex items-center">
                  <Settings className="h-6 w-6 mr-3 text-blue-600" />
                  Delete
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Backup Data Section */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-8 rounded-xl border border-green-200">
                    <div className="flex items-center mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mr-4">
                        <Database className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-green-800">Backup Data</h3>
                        <p className="text-green-600 text-sm">Create a complete backup of all system data</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg border border-green-200">
                        <h4 className="font-semibold text-green-800 mb-2">What's included:</h4>
                        <ul className="text-sm text-green-700 space-y-1">
                          <li>• All user accounts and profiles</li>
                          <li>• Complete voucher records and events</li>
                          <li>• Payment transactions and history</li>
                          <li>• Notifications and system logs</li>
                          <li>• KYC documents and verification status</li>
                        </ul>
                      </div>

                      <button
                        onClick={handleBackupData}
                        disabled={isBackingUp}
                        className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:from-green-300 disabled:to-green-400 transition-all duration-200 shadow-lg font-medium"
                      >
                        {isBackingUp ? (
                          <>
                            <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                            Creating Backup... {backupProgress.toFixed(0)}%
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Create Backup
                          </>
                        )}
                      </button>

                      {isBackingUp && (
                        <div className="w-full bg-white rounded-full h-2 border border-green-200">
                          <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${backupProgress}%` }}></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clear All Data Section */}
                  <div className="bg-gradient-to-br from-red-50 to-red-100 p-8 rounded-xl border border-red-200">
                    <div className="flex items-center mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mr-4">
                        <Trash2 className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-red-800">Clear All Data</h3>
                        <p className="text-red-600 text-sm">Permanently delete all system data</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg border border-red-200">
                        <h4 className="font-semibold text-red-800 mb-2">⚠️ Warning:</h4>
                        <ul className="text-sm text-red-700 space-y-1">
                          <li>• This action is IRREVERSIBLE</li>
                          <li>• All vouchers and events will be deleted</li>
                          <li>• All payment records will be removed</li>
                          <li>• All notifications will be cleared</li>
                          <li>• All vendor notifications will be removed</li>
                          <li>• All password change requests will be deleted</li>
                        </ul>
                        <p className="text-sm text-red-600 mt-2 font-medium">User accounts will be preserved.</p>
                      </div>

                      <button
                        onClick={() => setShowClearConfirmation(true)}
                        disabled={isClearingData}
                        className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:from-red-300 disabled:to-red-400 transition-all duration-200 shadow-lg font-medium"
                      >
                        {isClearingData ? (
                          <>
                            <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                            Clearing Data... {clearProgress.toFixed(0)}%
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear All Data
                          </>
                        )}
                      </button>

                      {isClearingData && (
                        <div className="w-full bg-white rounded-full h-2 border border-red-200">
                          <div className="bg-red-500 h-2 rounded-full transition-all duration-300" style={{ width: `${clearProgress}%` }}></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* System Information */}
                <div className="mt-8 bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-xl border border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-gray-600" />
                    System Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-700 mb-2">Backup Format</h4>
                      <p className="text-2xl font-bold text-green-600">Excel</p>
                      <p className="text-sm text-gray-500">Multiple sheets with detailed data</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <h4 className="font-semibold text-gray-700 mb-2">Security</h4>
                      <p className="text-2xl font-bold text-purple-600">Admin Only</p>
                      <p className="text-sm text-gray-500">Restricted to administrator access</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear Data Confirmation Modal */}
      {showClearConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Confirm Data Deletion</h3>
                <p className="text-red-600 text-sm">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6">
              <h4 className="font-semibold text-red-800 mb-2">The following will be permanently deleted:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• All voucher records and events</li>
                <li>• All payment transactions</li>
                <li>• All notifications</li>
                <li>• All vendor notifications</li>
                <li>• All password change requests</li>
              </ul>
              <p className="text-sm text-red-600 mt-2 font-medium">Only User accounts will be preserved.</p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowClearConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowClearConfirmation(false);
                  handleClearAllData();
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
