'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, FileText, Search, User } from 'lucide-react';
import { getCurrentUser } from '@/config/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/config/firebase';
import { ref, listAll, getDownloadURL, uploadBytesResumable, deleteObject } from 'firebase/storage';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import Image from 'next/image';

interface Vendor {
  uid: string;
  firstName: string;
  surname: string;
  companyName: string;
  email: string;
  phone: string;
  kycStatus?: string;
}

interface KycDocument {
  name: string;
  url: string;
  path: string;
  size?: string;
  uploadedAt?: string;
  type?: string;
}

export default function VendorKycPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [kycDocuments, setKycDocuments] = useState<KycDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [adminData, setAdminData] = useState<any>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [updatingKycStatus, setUpdatingKycStatus] = useState(false);

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        const userData = await getCurrentUser();
        if (userData && userData.role === 'admin') {
          setAdminData(userData);
          await fetchVendors();
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading admin data:', error);
        setLoading(false);
      }
    };

    loadAdminData();
  }, []);

  const fetchVendors = async () => {
    try {
      const vendorsRef = collection(db, 'users');
      const vendorsQuery = query(vendorsRef, where('role', '==', 'vendor'));
      const snapshot = await getDocs(vendorsQuery);
      console.debug(`Found ${snapshot.docs.length} vendors`);

      const vendorsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          firstName: data.firstName || '',
          surname: data.surname || '',
          companyName: data.companyName || '',
          email: data.email || '',
          phone: data.phone || '',
          kycStatus: data.kycStatus || 'Pending'
        } as Vendor;
      });

      setVendors(vendorsList);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchVendorKycDocuments = async (vendorId: string) => {
    try {
      setKycDocuments([]);
      console.debug(`Fetching KYC documents for vendor ID: ${vendorId}`);

      // First try to get KYC documents from Firestore
      const userRef = doc(db, 'users', vendorId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists() && userDoc.data().kycDocuments) {
        console.debug('Found KYC documents in Firestore');
        const kycData = userDoc.data().kycDocuments;
        const currentKycStatus = userDoc.data().kycStatus || 'Pending';
        const docs: KycDocument[] = [];

        // Update selected vendor with current KYC status
        if (selectedVendor && selectedVendor.uid === vendorId) {
          setSelectedVendor(prev => prev ? { ...prev, kycStatus: currentKycStatus } : null);
        }

        // Convert Firestore KYC documents to our format
        for (const [type, url] of Object.entries(kycData)) {
          if (url && typeof url === 'string') {
            docs.push({
              name: type,
              url: url as string,
              path: `users/${vendorId}/kyc/${type}`,
              type: type,
              uploadedAt: new Date().toLocaleDateString()
            });
          }
        }

        setKycDocuments(docs);
      } else {
        // If no KYC documents in Firestore, try storage directly
        console.debug('No KYC documents found in Firestore, checking storage');
        const kycFolderRef = ref(storage, `users/${vendorId}/kyc`);

        try {
          const result = await listAll(kycFolderRef);
          console.debug(`Found ${result.items.length} KYC documents in storage`);

          const docs = await Promise.all(
            result.items.map(async (itemRef) => {
              const url = await getDownloadURL(itemRef);
              // Extract document type from path (e.g. "aadhar_12345678" -> "aadhar")
              const name = itemRef.name;
              const type = name.split('_')[0];

              return {
                name: name,
                url,
                path: itemRef.fullPath,
                type: type || 'document',
                uploadedAt: new Date().toLocaleDateString()
              };
            })
          );

          setKycDocuments(docs);
        } catch (error: any) {
          // If the folder doesn't exist yet, it's normal for new vendors
          if (error.code !== 'storage/object-not-found') {
            console.error('Error fetching KYC documents from storage:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error in fetchVendorKycDocuments:', error);
    }
  };

  const handleSelectVendor = (vendor: Vendor) => {
    console.debug(`Selected vendor: ${vendor.firstName} ${vendor.surname} (${vendor.uid})`);
    setSelectedVendor(vendor);
    fetchVendorKycDocuments(vendor.uid);
  };

  const handleUpdateKycStatus = async (vendorId: string, status: 'Verified' | 'Rejected' | 'Pending') => {
    if (!selectedVendor) return;
    setUpdatingKycStatus(true);
    try {
      const userRef = doc(db, 'users', vendorId);
      await updateDoc(userRef, {
        kycStatus: status
      });
      // Update local state for selected vendor
      setSelectedVendor(prev => prev ? { ...prev, kycStatus: status } : null);
      // Update vendors list as well
      setVendors(prevVendors =>
        prevVendors.map(v => v.uid === vendorId ? { ...v, kycStatus: status } : v)
      );
      console.log(`KYC status for vendor ${vendorId} updated to ${status}`);
    } catch (error) {
      console.error('Error updating KYC status:', error);
      alert('Failed to update KYC status. Please try again.');
    } finally {
      setUpdatingKycStatus(false);
    }
  };

  const handleUploadKyc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedVendor?.uid) return;

    setUploadingKyc(true);
    setUploadProgress(0);
    setUploadError('');
    setUploadSuccess(false);

    // Create a reference with a timestamp prefix to avoid name collisions
    const timestamp = new Date().getTime();
    const docType = file.name.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const storageRef = ref(storage, `users/${selectedVendor.uid}/kyc/${docType}_${timestamp}`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(progress);
      },
      (error) => {
        console.error('Error uploading KYC document:', error);
        setUploadError('Failed to upload document. Please try again.');
        setUploadingKyc(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

        // Add the new document to the list
        setKycDocuments(prev => [...prev, {
          name: file.name,
          url: downloadURL,
          path: storageRef.fullPath,
          type: docType,
          uploadedAt: new Date().toLocaleDateString()
        }]);

        // Also update the user's Firestore document
        try {
          const userRef = doc(db, 'users', selectedVendor.uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const currentKycDocs = userDoc.data().kycDocuments || {};
            await updateDoc(userRef, {
              kycDocuments: {
                ...currentKycDocs,
                [docType]: downloadURL
              }
            });
          }
        } catch (error) {
          console.error('Error updating Firestore with KYC document:', error);
        }

        setUploadSuccess(true);
        setUploadingKyc(false);

        // Reset the file input
        e.target.value = '';
      }
    );
  };

  const handleDeleteKycDocument = async (doc: KycDocument) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      console.debug(`Deleting document: ${doc.name} from path: ${doc.path}`);
      const docRef = ref(storage, doc.path);
      await deleteObject(docRef);
      console.debug('Document deleted successfully');

      // Remove from the list
      setKycDocuments(prev => prev.filter(item => item.path !== doc.path));
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete the document. Please try again.');
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    const searchValue = searchTerm.toLowerCase();
    return (
      vendor.firstName.toLowerCase().includes(searchValue) ||
      vendor.surname.toLowerCase().includes(searchValue) ||
      vendor.companyName.toLowerCase().includes(searchValue) ||
      vendor.email.toLowerCase().includes(searchValue) ||
      vendor.phone.toLowerCase().includes(searchValue)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-800">Loading vendor data...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminProtectedRoute>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <button
            onClick={() => router.push('/admin-dashboard')}
            className="mb-6 flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-blue-600 py-6 px-8">
              <div className="flex items-center text-white">
                <div className="bg-white/10 p-3 rounded-full">
                  <FileText className="h-8 w-8" />
                </div>
                <h1 className="text-2xl font-bold ml-4">Vendor KYC Management</h1>
              </div>
            </div>

            <div className="p-8">
              <div className="flex flex-col md:flex-row">
                {/* Vendors List - Left Side */}
                <div className="w-full md:w-1/3 md:pr-6 mb-6 md:mb-0">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">Vendors</h2>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search vendors..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-md pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto border border-gray-200 rounded-md">
                    {filteredVendors.length > 0 ? (
                      <ul className="divide-y divide-gray-200">
                        {filteredVendors.map((vendor) => (
                          <li
                            key={vendor.uid}
                            onClick={() => handleSelectVendor(vendor)}
                            className={`p-3 hover:bg-blue-50 cursor-pointer transition-colors ${
                              selectedVendor?.uid === vendor.uid ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-800">{vendor.firstName} {vendor.surname}</p>
                                <p className="text-sm text-gray-500">{vendor.companyName || 'No company'}</p>
                                <p className="text-xs text-gray-400">{vendor.email}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                vendor.kycStatus === 'Verified' ? 'bg-green-100 text-green-700' :
                                vendor.kycStatus === 'Rejected' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {vendor.kycStatus || 'Pending'}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        {searchTerm ? 'No vendors match your search.' : 'No vendors found.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* KYC Documents - Right Side */}
                <div className="w-full md:w-2/3 md:pl-6 border-t pt-6 md:pt-0 md:border-t-0 md:border-l border-gray-200">
                  {selectedVendor ? (
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h2 className="text-xl font-semibold text-blue-800">
                            KYC Documents for {selectedVendor.firstName ?? 'N/A'} {selectedVendor.surname ?? 'N/A'}
                          </h2>
                          <p className="text-sm text-blue-500">{selectedVendor.companyName ?? 'N/A'}</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            selectedVendor.kycStatus === 'Verified' ? 'bg-green-100 text-green-700' :
                            selectedVendor.kycStatus === 'Rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            KYC: {selectedVendor.kycStatus || 'Pending'}
                          </span>
                          {selectedVendor.kycStatus !== 'Verified' && (
                            <button
                              onClick={() => handleUpdateKycStatus(selectedVendor.uid, 'Verified')}
                              disabled={updatingKycStatus || kycDocuments.length === 0}
                              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 transition-colors text-sm"
                            >
                              {updatingKycStatus ? 'Verifying...' : 'Verify'}
                            </button>
                          )}
                          {selectedVendor.kycStatus !== 'Rejected' && (
                            <button
                              onClick={() => handleUpdateKycStatus(selectedVendor.uid, 'Rejected')}
                              disabled={updatingKycStatus}
                              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-300 transition-colors text-sm"
                            >
                              {updatingKycStatus ? 'Rejecting...' : 'Reject'}
                            </button>
                          )}
                          {selectedVendor.kycStatus === 'Rejected' && (
                            <button
                              onClick={() => handleUpdateKycStatus(selectedVendor.uid, 'Pending')}
                              disabled={updatingKycStatus}
                              className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:bg-gray-300 transition-colors text-sm"
                            >
                              {updatingKycStatus ? 'Resetting...' : 'Set to Pending'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Upload new KYC document */}
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h3 className="text-md font-medium text-gray-700 mb-2">Upload KYC Document</h3>
                        <p className="text-sm text-gray-500 mb-4">
                          Upload a new KYC document for this vendor.
                          Supported formats: PDF, JPG, PNG (max 5MB).
                        </p>

                        <div className="flex items-center">
                          <input
                            type="file"
                            id="kycDocument"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleUploadKyc}
                            className="hidden"
                          />
                          <label
                            htmlFor="kycDocument"
                            className={`flex items-center px-4 py-2 rounded-md text-white cursor-pointer transition-colors ${
                              uploadingKyc ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadingKyc ? 'Uploading...' : 'Upload Document'}
                          </label>

                          {uploadingKyc && (
                            <div className="ml-4 flex-1">
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                  className="bg-blue-600 h-2.5 rounded-full"
                                  style={{ width: `${uploadProgress}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{uploadProgress}% uploaded</p>
                            </div>
                          )}
                        </div>

                        {uploadError && (
                          <p className="mt-2 text-red-500 text-sm">{uploadError}</p>
                        )}

                        {uploadSuccess && (
                          <p className="mt-2 text-green-500 text-sm">Document uploaded successfully!</p>
                        )}
                      </div>

                      {/* Documents list */}
                      {kycDocuments.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Photo */}
                          {kycDocuments.find(doc => doc.type === 'photo' || doc.name.toLowerCase().includes('photo')) && (
                            <div className="bg-blue-50 p-6 rounded-lg">
                              <h3 className="text-sm font-medium text-blue-500 mb-3">Photo</h3>
                              <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40">
                                {kycDocuments.find(doc => doc.type === 'photo' || doc.name.toLowerCase().includes('photo'))?.url && (
                                  <div className="relative h-32 w-32">
                                    {kycDocuments.find(doc => doc.type === 'photo' || doc.name.toLowerCase().includes('photo'))?.url?.endsWith('.pdf') ? (
                                      <div className="flex flex-col items-center justify-center h-full">
                                        <FileText className="h-12 w-12 text-blue-500" />
                                        <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                                      </div>
                                    ) : (
                                      <Image
                                        src={kycDocuments.find(doc => doc.type === 'photo' || doc.name.toLowerCase().includes('photo'))!.url}
                                        alt="Photo"
                                        fill
                                        className="object-cover rounded"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="mt-4 flex justify-between">
                                <a
                                  href={kycDocuments.find(doc => doc.type === 'photo' || doc.name.toLowerCase().includes('photo'))?.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700 flex-1 mr-2"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => handleDeleteKycDocument(
                                    kycDocuments.find(doc => doc.type === 'photo' || doc.name.toLowerCase().includes('photo'))!
                                  )}
                                  className="px-4 py-2 bg-red-600 text-white text-center rounded hover:bg-red-700 flex-1 ml-2"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Aadhar */}
                          {kycDocuments.find(doc => doc.type === 'aadhar' || doc.name.toLowerCase().includes('aadhar')) && (
                            <div className="bg-blue-50 p-6 rounded-lg">
                              <h3 className="text-sm font-medium text-blue-500 mb-3">Aadhar</h3>
                              <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40">
                                {kycDocuments.find(doc => doc.type === 'aadhar' || doc.name.toLowerCase().includes('aadhar'))?.url && (
                                  <div className="relative h-32 w-full">
                                    {kycDocuments.find(doc => doc.type === 'aadhar' || doc.name.toLowerCase().includes('aadhar'))?.url?.endsWith('.pdf') ? (
                                      <div className="flex flex-col items-center justify-center h-full">
                                        <FileText className="h-12 w-12 text-blue-500" />
                                        <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                                      </div>
                                    ) : (
                                      <Image
                                        src={kycDocuments.find(doc => doc.type === 'aadhar' || doc.name.toLowerCase().includes('aadhar'))!.url}
                                        alt="Aadhar"
                                        fill
                                        className="object-contain"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="mt-4 flex justify-between">
                                <a
                                  href={kycDocuments.find(doc => doc.type === 'aadhar' || doc.name.toLowerCase().includes('aadhar'))?.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700 flex-1 mr-2"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => handleDeleteKycDocument(
                                    kycDocuments.find(doc => doc.type === 'aadhar' || doc.name.toLowerCase().includes('aadhar'))!
                                  )}
                                  className="px-4 py-2 bg-red-600 text-white text-center rounded hover:bg-red-700 flex-1 ml-2"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Company ID */}
                          {kycDocuments.find(doc => doc.type === 'companyId' || doc.name.toLowerCase().includes('company')) && (
                            <div className="bg-blue-50 p-6 rounded-lg">
                              <h3 className="text-sm font-medium text-blue-500 mb-3">Company ID</h3>
                              <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40">
                                {kycDocuments.find(doc => doc.type === 'companyId' || doc.name.toLowerCase().includes('company'))?.url && (
                                  <div className="relative h-32 w-full">
                                    {kycDocuments.find(doc => doc.type === 'companyId' || doc.name.toLowerCase().includes('company'))?.url?.endsWith('.pdf') ? (
                                      <div className="flex flex-col items-center justify-center h-full">
                                        <FileText className="h-12 w-12 text-blue-500" />
                                        <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                                      </div>
                                    ) : (
                                      <Image
                                        src={kycDocuments.find(doc => doc.type === 'companyId' || doc.name.toLowerCase().includes('company'))!.url}
                                        alt="Company ID"
                                        fill
                                        className="object-contain"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="mt-4 flex justify-between">
                                <a
                                  href={kycDocuments.find(doc => doc.type === 'companyId' || doc.name.toLowerCase().includes('company'))?.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700 flex-1 mr-2"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => handleDeleteKycDocument(
                                    kycDocuments.find(doc => doc.type === 'companyId' || doc.name.toLowerCase().includes('company'))!
                                  )}
                                  className="px-4 py-2 bg-red-600 text-white text-center rounded hover:bg-red-700 flex-1 ml-2"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Other Documents */}
                          {kycDocuments.filter(doc =>
                            !(doc.type === 'photo' || doc.name.toLowerCase().includes('photo') ||
                              doc.type === 'aadhar' || doc.name.toLowerCase().includes('aadhar') ||
                              doc.type === 'companyId' || doc.name.toLowerCase().includes('company'))
                          ).map((doc, index) => (
                            <div key={index} className="bg-blue-50 p-6 rounded-lg">
                              <h3 className="text-sm font-medium text-blue-500 mb-3">
                                {doc.type ? (doc.type.charAt(0).toUpperCase() + doc.type.slice(1)) : 'Document'}
                              </h3>
                              <div className="flex items-center justify-center bg-white rounded-lg p-4 border border-blue-200 h-40">
                                {doc.url && (
                                  <div className="relative h-32 w-full">
                                    {doc.url.endsWith('.pdf') ? (
                                      <div className="flex flex-col items-center justify-center h-full">
                                        <FileText className="h-12 w-12 text-blue-500" />
                                        <p className="text-xs text-blue-500 mt-2">PDF Document</p>
                                      </div>
                                    ) : (
                                      <Image
                                        src={doc.url}
                                        alt={doc.name}
                                        fill
                                        className="object-contain"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="mt-4 flex justify-between">
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700 flex-1 mr-2"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => handleDeleteKycDocument(doc)}
                                  className="px-4 py-2 bg-red-600 text-white text-center rounded hover:bg-red-700 flex-1 ml-2"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">No KYC documents uploaded yet.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-20 w-20 text-gray-300 mx-auto mb-4" />
                      <p className="text-xl font-medium text-gray-500 mb-2">No Vendor Selected</p>
                      <p className="text-gray-400">Select a vendor from the list to view their KYC documents.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminProtectedRoute>
  );
}
