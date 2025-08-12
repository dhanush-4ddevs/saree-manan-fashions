'use client';

import { useState, useEffect, useRef } from 'react';
import { VoucherFormData, Voucher, JobWorkType } from '@/types/voucher';
import { getNextAvailableVoucherNumber, VoucherNumberOptions } from '@/utils/voucherNumberGenerator';
import Image from 'next/image';
import { Calendar, User, Briefcase, Package, IndianRupee, Truck, Mail, Phone, Building, FileText, Camera, Send, Save, RefreshCw, Printer, Upload, X, Eye, Trash2 } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { ImageWithWatermark, addWatermarkToImage, resizeImage, generateImageId } from '@/utils/imageUtils';
import { getSupplierSuggestions, saveSupplier } from '@/utils/supplierUtils';
import { ImageContainer } from './ImageContainer';
import { getCurrentUser } from '@/config/firebase';
import { PrintPreviewModal } from './PrintPreviewModal';
import { useJobWorks } from '@/hooks/useJobWorks';

interface VendorOption {
  uid: string;
  firstName: string;
  surname: string;
  companyName: string;
  address?: {
    line1: string;
    city: string;
    district: string;
    state: string;
    country: string;
    pincode: string;
  };
  phone?: string;
  email: string;
  userCode: string;
  vendorJobWork?: string;
}

export interface VoucherFormSubmitData {
  formData: VoucherFormData;
  images: ImageWithWatermark[];
}

interface VoucherFormProps {
  onSubmit: (data: VoucherFormSubmitData) => Promise<void>;
  editingVoucher?: Voucher | null;
  initialVoucherNo?: string;
  isSubmitting?: boolean;
  onSuccess?: () => void;
}

// Helper function to extract form data from new voucher structure
const extractFormDataFromVoucher = (voucher: Voucher | null | undefined): Partial<VoucherFormData> => {
  if (!voucher) return {};

  const dispatchEvent = voucher.events.find(e => e.event_type === 'dispatch');

  return {
    voucherDate: voucher.created_at ? new Date(voucher.created_at).toISOString().split('T')[0] : '',
    senderName: '', // This will be fetched from user data
    senderDesignation: '',
    item: voucher.item_details?.item_name || '',
    quantity: voucher.item_details?.initial_quantity || 0,
    supplierName: voucher.item_details?.supplier_name || '',
    supplierPrice: voucher.item_details?.supplier_price_per_piece || 0,
    jobWork: dispatchEvent?.details.jobWork || 'Dying Chaap',
    vendorUserId: dispatchEvent?.details.receiver_id || '',
    vendorFirstName: '', // This will be fetched from selected vendor
    vendorLastName: '',
    vendorCompanyName: '',
    vendorAddress: '',
    vendorPhone: '',
    vendorEmail: '',
    vendorCode: '',
    lrDate: dispatchEvent?.details.transport?.lr_date || '',
    lrNumber: dispatchEvent?.details.transport?.lr_no || '',
    transportName: dispatchEvent?.details.transport?.transporter_name || '',
    comment: dispatchEvent?.comment || ''
  };
};

export function VoucherForm({ onSubmit, editingVoucher, initialVoucherNo, isSubmitting = false, onSuccess }: VoucherFormProps) {
  const extractedData = extractFormDataFromVoucher(editingVoucher);

  // Use the job works hook
  const { jobWorkNames, loading: jobWorksLoading, error: jobWorksError } = useJobWorks();

  const [formData, setFormData] = useState<VoucherFormData>({
    voucherDate: extractedData.voucherDate || new Date().toISOString().split('T')[0],
    senderName: extractedData.senderName || '',
    senderDesignation: extractedData.senderDesignation || '',
    item: extractedData.item || '',
    quantity: extractedData.quantity || 0,
    supplierName: extractedData.supplierName || '',
    supplierPrice: extractedData.supplierPrice || 0,
    jobWork: extractedData.jobWork || 'Dying Chaap',
    vendorUserId: extractedData.vendorUserId || '',
    vendorFirstName: extractedData.vendorFirstName || '',
    vendorLastName: extractedData.vendorLastName || '',
    vendorCompanyName: extractedData.vendorCompanyName || '',
    vendorAddress: extractedData.vendorAddress || '',
    vendorPhone: extractedData.vendorPhone || '',
    vendorEmail: extractedData.vendorEmail || '',
    vendorCode: extractedData.vendorCode || '',
    lrDate: extractedData.lrDate || new Date().toISOString().split('T')[0],
    lrNumber: extractedData.lrNumber || '',
    transportName: extractedData.transportName || '',
    comment: extractedData.comment || ''
  });

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<VendorOption[]>([]);
  const [voucherNo, setVoucherNo] = useState<string>(initialVoucherNo || '');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [images, setImages] = useState<ImageWithWatermark[]>([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [supplierInputRef] = useState(useRef<HTMLInputElement>(null));
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewVoucher, setPreviewVoucher] = useState<Voucher | null>(null);

  // Job work options - Updated to use dynamic data from database
  const jobWorkOptions = jobWorkNames;

  useEffect(() => {
    // Fetch all vendors
    const fetchVendors = async () => {
      try {
        const vendorsRef = collection(db, 'users');
        const vendorQuery = query(vendorsRef, where('role', '==', 'vendor'));
        const vendorSnapshot = await getDocs(vendorQuery);

        const vendorList: VendorOption[] = [];
        vendorSnapshot.forEach((doc) => {
          const vendorData = doc.data();
          vendorList.push({
            uid: doc.id,
            firstName: vendorData.firstName || '',
            surname: vendorData.surname || '',
            companyName: vendorData.companyName || '',
            address: vendorData.address,
            phone: vendorData.phone,
            email: vendorData.email || '',
            userCode: vendorData.userCode || '',
            vendorJobWork: vendorData.vendorJobWork || ''
          });
        });

        setVendors(vendorList);
      } catch (error) {
        console.error("Error fetching vendors:", error);
      }
    };

    fetchVendors();
  }, []);

  useEffect(() => {
    // Always update voucherNo if initialVoucherNo is explicitly passed (not undefined),
    // even if it's an empty string, to ensure faithful synchronization.
    if (initialVoucherNo !== undefined) {
      setVoucherNo(initialVoucherNo);
    }
  }, [initialVoucherNo]);

  // Filter vendors based on selected job work
  useEffect(() => {
    if (formData.jobWork && vendors.length > 0) {
      const filtered = vendors.filter(vendor =>
        vendor.vendorJobWork === formData.jobWork
      );
      setFilteredVendors(filtered);

      // Clear selected vendor if it doesn't match the job work
      if (formData.vendorUserId) {
        const selectedVendor = vendors.find(v => v.uid === formData.vendorUserId);
        if (selectedVendor && selectedVendor.vendorJobWork !== formData.jobWork) {
          setFormData(prev => ({
            ...prev,
            vendorUserId: '',
            // Clear vendor form data
            vendorFirstName: '',
            vendorLastName: '',
            vendorCompanyName: '',
            vendorAddress: '',
            vendorPhone: '',
            vendorEmail: '',
            vendorCode: '',
          }));
        }
      }
    } else {
      setFilteredVendors([]);
      // Clear vendor fields if no job work is selected
      setFormData(prev => ({
        ...prev,
        vendorUserId: '',
        vendorFirstName: '',
        vendorLastName: '',
        vendorCompanyName: '',
        vendorAddress: '',
        vendorPhone: '',
        vendorEmail: '',
        vendorCode: '',
      }));
    }
  }, [formData.jobWork, vendors]);

  // Auto-fill vendor details when vendorUserId changes (e.g., on load of an editing voucher)
  useEffect(() => {
    if (formData.vendorUserId && vendors.length > 0) {
      const selectedVendor = vendors.find(v => v.uid === formData.vendorUserId);
      if (selectedVendor) {
        setFormData(prev => ({
          ...prev,
          vendorFirstName: selectedVendor.firstName || '',
          vendorLastName: selectedVendor.surname || '',
          vendorCompanyName: selectedVendor.companyName || '',
          vendorAddress: selectedVendor.address
            ? `${selectedVendor.address.line1}, ${selectedVendor.address.city}, ${selectedVendor.address.state}, ${selectedVendor.address.pincode}`
            : '',
          vendorPhone: selectedVendor.phone || '',
          vendorEmail: selectedVendor.email || '',
          vendorCode: selectedVendor.userCode || '',
        }));
      }
    }
  }, [formData.vendorUserId, vendors]);

  useEffect(() => {
    if (editingVoucher) {
      // Extract data from new voucher structure
      const extractedData = extractFormDataFromVoucher(editingVoucher);
      // Exclude sender details from this update, as they are fetched for the current user separately.
      const { senderName, senderDesignation, ...restOfData } = extractedData;

      setFormData(prev => ({
        ...prev, // Keeps current user's sender details
        ...restOfData, // Applies the rest of the data from the voucher
      }));

      setVoucherNo(editingVoucher.voucher_no);

      // Set images if available
      if (editingVoucher.item_details.images && editingVoucher.item_details.images.length > 0) {
        const existingImages: ImageWithWatermark[] = editingVoucher.item_details.images.map((imageUrl, index) => ({
          id: `existing_${index}`,
          file: new File([], `existing-image-${index}.jpg`),
          dataUrl: imageUrl,
          watermarkedDataUrl: imageUrl
        }));
        setImages(existingImages);
      }

      // Update filtered vendors based on the job work from the voucher
      if (extractedData.jobWork && vendors.length > 0) {
        const filtered = vendors.filter(vendor =>
          vendor.vendorJobWork === extractedData.jobWork
        );
        setFilteredVendors(filtered);
      }
    }
  }, [editingVoucher, vendors]);

  useEffect(() => {
    // Fetch the current user and auto-fill the sender name and designation fields
    const fetchCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          const fullName = user.firstName && user.surname
            ? `${user.firstName} ${user.surname}`
            : 'Admin';
          const designation = user.designation || (user.role === 'admin' ? 'Proprietor' : 'Vendor');

          setFormData(prev => ({
            ...prev,
            senderName: fullName,
            senderDesignation: designation,
          }));
          setCurrentUser(user);
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };

    fetchCurrentUser();
  }, []);

  // Handle multiple image uploads
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed the limit of 3
    if (images.length + files.length > 3) {
      alert('You can upload a maximum of 3 images');
      return;
    }

    const newImages: ImageWithWatermark[] = [];

    for (const file of files) {
      try {
        // Resize image first
        const resizedDataUrl = await resizeImage(file);

        // Add watermark with voucher number
        const watermarkText = voucherNo || 'VOUCHER';
        const watermarkedDataUrl = await addWatermarkToImage(resizedDataUrl, watermarkText);

        const imageWithWatermark: ImageWithWatermark = {
          id: generateImageId(),
          file,
          dataUrl: resizedDataUrl,
          watermarkedDataUrl
        };

        newImages.push(imageWithWatermark);
      } catch (error) {
        console.error('Error processing image:', error);
        alert(`Error processing image ${file.name}`);
      }
    }

    setImages(prev => [...prev, ...newImages]);

    // Clear the input
    e.target.value = '';
  };

  // Handle supplier input changes with autocomplete
  const handleSupplierNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, supplierName: value });

    if (value.trim()) {
      const suggestions = getSupplierSuggestions(value);
      setSupplierSuggestions(suggestions);
      setShowSupplierSuggestions(suggestions.length > 0);
    } else {
      setShowSupplierSuggestions(false);
    }
  };

  // Handle supplier suggestion selection
  const handleSupplierSuggestionSelect = (suggestion: string) => {
    setFormData({ ...formData, supplierName: suggestion });
    setShowSupplierSuggestions(false);
  };

  // Remove an image
  const removeImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleVendorSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vendorId = e.target.value;
    setFormData(prev => ({
      ...prev,
      vendorUserId: vendorId,
      vendorFirstName: '',
      vendorLastName: '',
      vendorCompanyName: '',
      vendorAddress: '',
      vendorPhone: '',
      vendorEmail: '',
      vendorCode: '',
    }));

    if (vendorId) {
      const selectedVendor = filteredVendors.find(v => v.uid === vendorId);

      if (selectedVendor) {
        setFormData(prev => ({
          ...prev,
          vendorFirstName: selectedVendor.firstName || '',
          vendorLastName: selectedVendor.surname || '',
          vendorCompanyName: selectedVendor.companyName || '',
          vendorAddress: selectedVendor.address ?
            `${selectedVendor.address.line1}, ${selectedVendor.address.city}, ${selectedVendor.address.state}, ${selectedVendor.address.pincode}` : '',
          vendorPhone: selectedVendor.phone || '',
          vendorEmail: selectedVendor.email || '',
          vendorCode: selectedVendor.userCode || '',
        }));
      }
    } else {
      // Clear vendor fields if no vendor is selected
      setFormData(prev => ({
        ...prev,
        vendorUserId: '',
        vendorFirstName: '',
        vendorLastName: '',
        vendorCompanyName: '',
        vendorAddress: '',
        vendorPhone: '',
        vendorEmail: '',
        vendorCode: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Save supplier name for autocomplete
    if (formData.supplierName.trim()) {
      saveSupplier(formData.supplierName);
    }

    await onSubmit({ formData, images });

    if (onSuccess) {
      onSuccess();
    }

    // Reset form after successful submission if creating new voucher (not editing)
    if (!editingVoucher) {
      handleReset();
    }
  };

  const handleReset = () => {
    if (!editingVoucher) {
      setFormData({
        voucherDate: new Date().toISOString().split('T')[0],
        senderName: 'Admin',
        senderDesignation: 'Proprietor',
        item: 'Saree',
        quantity: 0,
        supplierName: '',
        supplierPrice: 0,
        jobWork: 'Dying Chaap',
        vendorUserId: '',
        vendorFirstName: '',
        vendorLastName: '',
        vendorCompanyName: '',
        vendorAddress: '',
        vendorPhone: '',
        vendorEmail: '',
        vendorCode: '',
        lrDate: new Date().toISOString().split('T')[0],
        lrNumber: '',
        transportName: '',
        comment: ''
      });
      setImages([]);
      // Reset additional state variables
      setSupplierSuggestions([]);
      setShowSupplierSuggestions(false);
    }
  };

  const handlePrint = () => {
    // Create a temporary voucher object for printing
    const imageUrls = images.map(img => img.watermarkedDataUrl);

    const tempVoucher: Voucher = {
      id: 'preview',
      voucher_no: voucherNo || 'PREVIEW',
      created_at: new Date().toISOString(),
      created_by_user_id: 'preview',
      voucher_status: 'Dispatched',
      item_details: {
        item_name: formData.item,
        images: imageUrls,
        initial_quantity: formData.quantity,
        supplier_name: formData.supplierName,
        supplier_price_per_piece: formData.supplierPrice
      },
      events: [],
      // Add missing required properties
      total_dispatched: formData.quantity,
      total_received: 0,
      total_forwarded: 0,
      total_missing_on_arrival: 0,
      total_damaged_on_arrival: 0,
      total_damaged_after_work: 0,
      admin_received_quantity: 0
    };

    setPreviewVoucher(tempVoucher);
    setShowPrintPreview(true);
  };

  // Function to disable mouse wheel and arrow key events on number inputs
  const handleNumberInputEvents = (e: React.WheelEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
    // Disable mouse wheel events
    if (e.type === 'wheel') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
    // Disable arrow key up/down events
    if (e.type === 'keydown') {
      const keyEvent = e as React.KeyboardEvent<HTMLInputElement>;
      if (keyEvent.key === 'ArrowUp' || keyEvent.key === 'ArrowDown') {
        e.preventDefault();
      }
    }
  };

  return (
    <div className="pb-8 bg-gradient-to-br from-blue-50 to-white min-h-screen">
      {/* CSS to hide number input spinner buttons */}
      <style jsx>{`
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="max-w-6xl mx-auto bg-gray-50 rounded-lg overflow-hidden p-2">
        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Voucher Header */}
          <div className="bg-white p-3 rounded-lg border border-blue-200 mt-6">
            <h3 className="text-lg font-medium text-blue-800 mb-4">VOUCHER INFO</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="voucherNo" className="block text-sm font-medium text-blue-700 mb-1">
                  VOUCHER NO
                </label>
                <input
                  readOnly
                  type="text"
                  id="voucherNo"
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                  placeholder="Auto-generated if left empty"
                />
              </div>
              <div>
                <label htmlFor="voucherDate" className="block text-sm font-medium text-blue-700 mb-1">
                  VOUCHER DATE
                </label>
                <input
                  type="date"
                  id="voucherDate"
                  value={formData.voucherDate}
                  onChange={(e) => setFormData({ ...formData, voucherDate: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Sender Details */}
          <div className="bg-white p-3 rounded-lg border border-blue-200 mt-6">
            <h3 className="text-lg font-medium text-blue-800 mb-4">SENDER DETAILS</h3>
            <div>
              <label htmlFor="senderName" className="block text-sm font-medium text-blue-700 mb-1">
                NAME
              </label>
              <input
                type="text"
                id="senderName"
                value={formData.senderName}
                readOnly
                className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm cursor-not-allowed"
              />
            </div>
            <div className="mt-4">
              <label htmlFor="senderDesignation" className="block text-sm font-medium text-blue-700 mb-1">
                DESIGNATION
              </label>
              <input
                type="text"
                id="senderDesignation"
                value={formData.senderDesignation}
                readOnly
                className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm cursor-not-allowed"
              />
            </div>
          </div>

          {/* Item Details */}
          <div className="bg-white p-3 rounded-lg border border-blue-200 mt-6">
            <h3 className="text-lg font-medium text-blue-800 mb-4">ITEM DETAILS</h3>

            {/* Image Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-blue-700 mb-1">
                IMAGES / PHOTOS (Max 3)
              </label>

              {/* Upload Button */}
              <div className="mt-1 mb-4">
                <button
                  type="button"
                  onClick={() => document.getElementById('image-upload')?.click()}
                  disabled={images.length >= 3}
                  className={`inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium ${images.length >= 3
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-blue-700 hover:bg-blue-50'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {images.length >= 3 ? 'Maximum images reached' : 'Upload Images'}
                </button>
                <input
                  id="image-upload"
                  name="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={handleImageChange}
                />
                <p className="text-xs text-blue-500 mt-1">
                  Images will be automatically watermarked with voucher number and saved
                </p>
              </div>

              {/* Image Gallery */}
              {images.length > 0 && (
                <div className="mb-4">
                  <ImageContainer
                    images={images.map(img => img.watermarkedDataUrl)}
                    size="lg"
                    className="mb-2"
                  />

                  {/* Image Management Actions */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {images.map((image, index) => (
                      <div key={image.id} className="flex items-center bg-blue-50 rounded-md px-2 py-1 text-sm">
                        <span className="text-blue-700 mr-2">Image {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className="text-red-600 hover:text-red-800 ml-1"
                          title="Delete image"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="item" className="block text-sm font-medium text-blue-700 mb-1">
                  ITEM
                </label>
                <input
                  type="text"
                  id="item"
                  value={formData.item}
                  onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-blue-700 mb-1">
                  QTY
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    id="quantity"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                    onWheel={handleNumberInputEvents}
                    onKeyDown={handleNumberInputEvents}
                  />
                  <span className="ml-2 text-blue-700">pieces</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="relative">
                <label htmlFor="supplierName" className="block text-sm font-medium text-blue-700 mb-1">
                  SUPPLIER NAME
                </label>
                <input
                  ref={supplierInputRef}
                  type="text"
                  id="supplierName"
                  value={formData.supplierName}
                  onChange={handleSupplierNameChange}
                  onFocus={() => {
                    if (formData.supplierName.trim()) {
                      const suggestions = getSupplierSuggestions(formData.supplierName);
                      setSupplierSuggestions(suggestions);
                      setShowSupplierSuggestions(suggestions.length > 0);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding suggestions to allow for clicks
                    setTimeout(() => setShowSupplierSuggestions(false), 200);
                  }}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter supplier name"
                />

                {/* Supplier Suggestions Dropdown */}
                {showSupplierSuggestions && supplierSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-blue-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {supplierSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSupplierSuggestionSelect(suggestion)}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none text-sm"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="supplierPrice" className="block text-sm font-medium text-blue-700 mb-1">
                  SUPPLIER PRICE
                </label>
                <div className="flex items-center">
                  <div className="relative flex-grow">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      id="supplierPrice"
                      min="0"
                      step="0.01"
                      value={formData.supplierPrice}
                      onChange={(e) => setFormData({ ...formData, supplierPrice: parseFloat(e.target.value) })}
                      className="mt-1 block w-full pl-8 px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      onWheel={handleNumberInputEvents}
                      onKeyDown={handleNumberInputEvents}
                    />
                  </div>
                  <span className="ml-2 text-blue-700">INR / piece</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="totalPrice" className="block text-sm font-medium text-blue-700 mb-1">
                TOTAL VALUE
              </label>
              <div className="flex items-center">
                <div className="relative bg-blue-100 border border-blue-300 rounded-md px-3 py-2 flex items-center">
                  <span className="text-blue-500 mr-1">₹</span>
                  <span className="text-blue-800 font-medium">{(formData.quantity * formData.supplierPrice).toFixed(2)}</span>
                </div>
                <span className="ml-2 text-blue-700">INR</span>
              </div>
            </div>
          </div>

          {/* Job Work and Vendor Details */}
          <div className="bg-white p-3 rounded-lg border border-blue-200 mt-6">
            <div className="mb-4">
              <label htmlFor="jobWork" className="block text-sm font-medium text-blue-700 mb-1">
                JOB WORK
              </label>
              <select
                id="jobWork"
                value={formData.jobWork}
                onChange={(e) => setFormData({ ...formData, jobWork: e.target.value as JobWorkType })}
                className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
              >
                <option value="">Select Job Work</option>
                {jobWorkOptions.map((job) => (
                  <option key={job} value={job}>{job}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="vendorSelect" className="block text-sm font-medium text-blue-700 mb-1">
                Select Vendor
              </label>
              <select
                id="vendorSelect"
                value={formData.vendorUserId}
                onChange={handleVendorSelect}
                className="block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                required
                disabled={!formData.jobWork}
              >
                {!formData.jobWork ? (
                  <option value="">Please select a job work first</option>
                ) : filteredVendors.length === 0 ? (
                  <option value="">No vendors available for {formData.jobWork}</option>
                ) : (
                  <>
                    <option value="">Select a Vendor</option>
                    {filteredVendors.map((vendor) => (
                      <option key={vendor.uid} value={vendor.uid}>
                        {vendor.firstName} {vendor.surname} ({vendor.companyName})
                      </option>
                    ))}
                  </>
                )}
              </select>
              {formData.jobWork && filteredVendors.length === 0 && (
                <p className="mt-1 text-sm text-orange-600">
                  No vendors are registered for "{formData.jobWork}" job work. Please contact admin to add vendors for this job type.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="vendorName" className="block text-sm font-medium text-blue-700 mb-1">
                  VENDOR FNAME & LNAME
                </label>
                <input
                  type="text"
                  id="vendorName"
                  value={`${formData.vendorFirstName} ${formData.vendorLastName}`}
                  readOnly
                  className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="vendorCompany" className="block text-sm font-medium text-blue-700 mb-1">
                  VENDOR COMPANY NAME
                </label>
                <input
                  type="text"
                  id="vendorCompany"
                  value={formData.vendorCompanyName}
                  readOnly
                  className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <label htmlFor="vendorAddress" className="block text-sm font-medium text-blue-700 mb-1">
                  VENDOR ADD
                </label>
                <textarea
                  id="vendorAddress"
                  value={formData.vendorAddress}
                  readOnly
                  rows={2}
                  className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="vendorPhone" className="block text-sm font-medium text-blue-700 mb-1">
                  VENDOR PHONE
                </label>
                <input
                  type="text"
                  id="vendorPhone"
                  value={formData.vendorPhone}
                  readOnly
                  className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <label htmlFor="vendorEmail" className="block text-sm font-medium text-blue-700 mb-1">
                  VENDOR EMAIL
                </label>
                <input
                  type="email"
                  id="vendorEmail"
                  value={formData.vendorEmail}
                  readOnly
                  className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="vendorCode" className="block text-sm font-medium text-blue-700 mb-1">
                  VENDOR CODE
                </label>
                <input
                  type="text"
                  id="vendorCode"
                  value={formData.vendorCode}
                  readOnly
                  className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Transport Details */}
          <div className="bg-white p-3  rounded-lg border border-blue-200 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="lrDate" className="block text-sm font-medium text-blue-700 mb-1">
                  LR DATE
                </label>
                <input
                  type="date"
                  id="lrDate"
                  value={formData.lrDate}
                  onChange={(e) => setFormData({ ...formData, lrDate: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="lrNumber" className="block text-sm font-medium text-blue-700 mb-1">
                  LR NUMBER
                </label>
                <input
                  type="text"
                  id="lrNumber"
                  value={formData.lrNumber}
                  onChange={(e) => setFormData({ ...formData, lrNumber: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter LR Number"
                />
              </div>

              <div>
                <label htmlFor="transportName" className="block text-sm font-medium text-blue-700 mb-1">
                  TRANSPORT NAME
                </label>
                <input
                  type="text"
                  id="transportName"
                  value={formData.transportName}
                  onChange={(e) => setFormData({ ...formData, transportName: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Comment */}
          <div className="bg-white p-3 rounded-lg border border-blue-200 mt-6">
            <label htmlFor="comment" className="block text-sm font-medium text-blue-700 mb-1">
              COMMENT
            </label>
            <textarea
              id="comment"
              rows={3}
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              className="mt-1 block w-full px-3 py-2 bg-white border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Add any additional notes or instructions here..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-4 pb-4">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              RESET
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Submitting...' : editingVoucher ? 'Update Voucher' : 'Create Voucher'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
            >
              <Printer className="h-4 w-4 mr-2" />
              PRINT PREVIEW
            </button>
          </div>
        </form>
      </div>

      {/* Print Preview Modal */}
      <PrintPreviewModal
        voucher={previewVoucher}
        isOpen={showPrintPreview}
        onClose={() => {
          setShowPrintPreview(false);
          setPreviewVoucher(null);
        }}
      />
    </div>
  );
}
