'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, User, Users, Phone, Mail, Key, Building, MapPin, Hash, UserPlus, Save, Plus, Edit, Trash, X } from 'lucide-react';
import Image from 'next/image';
import { doc, getDoc, updateDoc, serverTimestamp, FieldValue, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { useJobWorks } from '@/hooks/useJobWorks';
import { updateJobWork, deleteJobWork, getCurrentUser, addJobWork, generateUserCode } from '@/config/firebase';
import {
  getAllStateNames,
  getDistrictsForState,
  validatePinCode,
  isValidIndianPinCode,
  getLocationFromPinCode,
  isValidDistrictForState,
  type PinCodeData
} from '@/utils/indianGeographicData';

interface UserFormData {
  category: 'admin' | 'vendor';
  firstName: string;
  surname: string;
  phone: string;
  email: string;
  companyName: string;
  address: {
    line1: string;
    city: string;
    district: string;
    state: string;
    country: string;
    pincode: string;
  };
  userCode: string;
  photo: string | null;
  profilePhotoUrl?: string | null;
  status?: string;
  designation?: string;
  vendorJobWork?: string;
}

export default function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUserUpdated, setIsUserUpdated] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const successMessageRef = useRef<HTMLDivElement>(null);
  const [adminData, setAdminData] = useState<any>(null);

  // Use the job works hook
  const { jobWorks, jobWorkNames, loading: jobWorksLoading, error: jobWorksError, refetch: refetchJobWorks } = useJobWorks();

  // New states for autocomplete functionality
  const [availableStates] = useState<string[]>(getAllStateNames());
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
  const [districtSearchTerm, setDistrictSearchTerm] = useState<string>('');
  const [showDistrictDropdown, setShowDistrictDropdown] = useState<boolean>(false);
  const [filteredDistricts, setFilteredDistricts] = useState<string[]>([]);

  const [pincodeSearchTerm, setPincodeSearchTerm] = useState<string>('');
  const [showPincodeDropdown, setShowPincodeDropdown] = useState<boolean>(false);
  const [filteredPincodes, setFilteredPincodes] = useState<string[]>([]);

  // Designation management states
  const [designations, setDesignations] = useState<string[]>([
    'Proprietor',
    'Partner',
    'Manager',
    'Accountant',
    'Packing'
  ]);
  const [showDesignationDropdown, setShowDesignationDropdown] = useState(false);
  const [showAddDesignationModal, setShowAddDesignationModal] = useState(false);
  const [showEditDesignationModal, setShowEditDesignationModal] = useState(false);
  const [newDesignationName, setNewDesignationName] = useState('');
  const [editingDesignationIndex, setEditingDesignationIndex] = useState<number | null>(null);
  const [editingDesignationName, setEditingDesignationName] = useState('');
  const [activeDesignationMenu, setActiveDesignationMenu] = useState<number | null>(null);
  const [isDesignationOperationInProgress, setIsDesignationOperationInProgress] = useState(false);

  // Vendor job work management states - Updated to use dynamic data
  const [vendorJobWorks, setVendorJobWorks] = useState<string[]>([]);

  // Update vendor job works when job work names are loaded
  useEffect(() => {
    if (jobWorkNames.length > 0) {
      setVendorJobWorks(jobWorkNames);
    }
  }, [jobWorkNames]);

  // Fetch admin data for job work operations
  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const currentUser = await getCurrentUser();
        setAdminData(currentUser);
      } catch (error) {
        console.error('Error fetching admin data:', error);
      }
    };

    fetchAdminData();
  }, []);

  const [showVendorJobWorkDropdown, setShowVendorJobWorkDropdown] = useState(false);
  const [showAddVendorJobWorkModal, setShowAddVendorJobWorkModal] = useState(false);
  const [showEditVendorJobWorkModal, setShowEditVendorJobWorkModal] = useState(false);
  const [newVendorJobWorkName, setNewVendorJobWorkName] = useState('');
  const [editingVendorJobWorkIndex, setEditingVendorJobWorkIndex] = useState<number | null>(null);
  const [editingVendorJobWorkName, setEditingVendorJobWorkName] = useState('');
  const [activeVendorJobWorkMenu, setActiveVendorJobWorkMenu] = useState<number | null>(null);
  const [isVendorJobWorkOperationInProgress, setIsVendorJobWorkOperationInProgress] = useState(false);

  // Phone validation states
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Phone validation functions
  const validatePhoneNumber = (phone: string): string | null => {
    if (!phone) return 'Phone number is required.';
    if (!/^\d{10}$/.test(phone)) return 'Phone number must be exactly 10 digits.';
    if (!/^[6-9]/.test(phone)) return 'Phone number must start with 6, 7, 8, or 9.';
    return null;
  };

  const validatePhoneRealTime = (phone: string): string | null => {
    if (!phone) return null; // Don't show error for empty field while typing
    if (!/^\d+$/.test(phone)) return 'Only numbers are allowed.';
    if (phone.length < 10) return `Enter ${10 - phone.length} more digit${10 - phone.length > 1 ? 's' : ''}.`;
    if (!/^[6-9]/.test(phone)) return 'Phone number must start with 6, 7, 8, or 9.';
    return null; // Valid
  };

  const isValidPhoneNumber = (phone: string): boolean => {
    return /^[6-9]\d{9}$/.test(phone);
  };

  // Sample pincode data for autocomplete (in real app, this would come from API)
  const samplePincodes = [
    '400001', '400002', '400003', '400004', '400005', '400006', '400007', '400008', '400009', '400010',
    '110001', '110002', '110003', '110004', '110005', '110006', '110007', '110008', '110009', '110010',
    '560001', '560002', '560003', '560004', '560005', '560006', '560007', '560008', '560009', '560010',
    '600001', '600002', '600003', '600004', '600005', '600006', '600007', '600008', '600009', '600010',
    '700001', '700002', '700003', '700004', '700005', '700006', '700007', '700008', '700009', '700010'
  ];

  const [formData, setFormData] = useState<UserFormData>({
    category: 'vendor',
    firstName: '',
    surname: '',
    phone: '',
    email: '',
    companyName: '',
    address: {
      line1: '',
      city: '',
      district: '',
      state: '',
      country: '',
      pincode: ''
    },
    userCode: '',
    photo: null,
    profilePhotoUrl: null,
    status: 'Active',
    designation: '',
    vendorJobWork: ''
  });

  // Monitor changes in fields that affect user code generation
  useEffect(() => {
    // Only regenerate user code if we have the required fields
    if (formData.firstName && formData.surname && formData.phone && formData.category) {
      const newUserCode = generateUserCode(
        formData.firstName,
        formData.surname,
        formData.phone,
        formData.category as 'admin' | 'vendor'
      );

      // Only update if the generated code is different from current
      if (newUserCode !== formData.userCode) {
        setFormData(prev => ({
          ...prev,
          userCode: newUserCode
        }));
      }
    }
  }, [formData.category, formData.firstName, formData.surname, formData.phone]);

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setUserId(resolvedParams.id);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (userId) {
      fetchUserData(userId);
    }
  }, [userId]);

  // Handle clicking outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      // Close designation dropdown if clicking outside
      if (showDesignationDropdown && !target.closest('.designation-dropdown')) {
        setShowDesignationDropdown(false);
      }

      // Close designation menu if clicking outside
      if (activeDesignationMenu !== null && !target.closest('.designation-menu')) {
        setActiveDesignationMenu(null);
      }

      // Close vendor job work dropdown if clicking outside
      if (showVendorJobWorkDropdown && !target.closest('.vendor-job-work-dropdown')) {
        setShowVendorJobWorkDropdown(false);
      }

      // Close vendor job work menu if clicking outside
      if (activeVendorJobWorkMenu !== null && !target.closest('.vendor-job-work-menu')) {
        setActiveVendorJobWorkMenu(null);
      }

      // Close district dropdown if clicking outside
      if (showDistrictDropdown && !target.closest('.district-autocomplete')) {
        setShowDistrictDropdown(false);
      }

      // Close pincode dropdown if clicking outside
      if (showPincodeDropdown && !target.closest('.pincode-autocomplete')) {
        setShowPincodeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDesignationDropdown, activeDesignationMenu, showVendorJobWorkDropdown, activeVendorJobWorkMenu, showDistrictDropdown, showPincodeDropdown]);

  // Handle state change to update available districts
  const handleStateChange = (stateName: string) => {
    const districts = getDistrictsForState(stateName);
    setAvailableDistricts(districts);
    setFilteredDistricts(districts);

    // Clear district if it doesn't belong to the new state
    if (formData.address.district && !districts.includes(formData.address.district)) {
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          state: stateName,
          district: ''
        }
      }));
      setDistrictSearchTerm('');
    } else {
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          state: stateName
        }
      }));
    }
  };

  // Handle district search and filtering
  const handleDistrictSearch = (searchTerm: string) => {
    setDistrictSearchTerm(searchTerm);
    setShowDistrictDropdown(true);

    if (!searchTerm.trim()) {
      setFilteredDistricts(availableDistricts);
    } else {
      const filtered = availableDistricts.filter(district =>
        district.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDistricts(filtered);
    }
  };

  const handleDistrictSelect = (district: string) => {
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        district: district
      }
    }));
    setDistrictSearchTerm(district);
    setShowDistrictDropdown(false);
  };

  // Handle pincode search and filtering
  const handlePincodeSearch = (searchTerm: string) => {
    setPincodeSearchTerm(searchTerm);
    setShowPincodeDropdown(true);

    if (!searchTerm.trim()) {
      setFilteredPincodes([]);
    } else {
      const filtered = samplePincodes.filter(pincode =>
        pincode.startsWith(searchTerm)
      );
      setFilteredPincodes(filtered.slice(0, 10)); // Limit to 10 suggestions
    }
  };

  const handlePincodeSelect = (pincode: string) => {
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        pincode: pincode
      }
    }));
    setPincodeSearchTerm(pincode);
    setShowPincodeDropdown(false);
  };

  const fetchUserData = async (id: string) => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', id));

      if (userDoc.exists()) {
        const userData = userDoc.data();

        // Helper function to set empty address fields to "N/A"
        const formatAddressField = (value: string | undefined | null): string => {
          return value && value.trim() !== '' ? value.trim() : 'N/A';
        };

        const userAddress = userData.address || {};

        setFormData({
          category: userData.role || 'vendor',
          firstName: userData.firstName || '',
          surname: userData.surname || '',
          phone: userData.phone || '',
          email: userData.email || '',
          companyName: userData.companyName || '',
          address: {
            line1: formatAddressField(userAddress.line1),
            city: formatAddressField(userAddress.city),
            district: formatAddressField(userAddress.district),
            state: formatAddressField(userAddress.state),
            country: formatAddressField(userAddress.country),
            pincode: formatAddressField(userAddress.pincode)
          },
          userCode: userData.userCode || '',
          photo: userData.photo || null,
          profilePhotoUrl: userData.profilePhotoUrl || null,
          status: userData.status || 'Active',
          designation: userData.designation || '',
          vendorJobWork: userData.vendorJobWork || ''
        });

        if (userData.profilePhotoUrl) {
          setPhotoPreview(userData.profilePhotoUrl);
        } else if (userData.photo) {
          setPhotoPreview(userData.photo);
        }
      } else {
        setError('User not found');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        console.error('Image too large. Maximum size is 5MB');
        setError('Image too large. Maximum size is 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        console.error('Unsupported file type. Please upload an image');
        setError('Unsupported file type. Please upload an image');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        console.log('Image loaded as data URL:', dataUrl.substring(0, 50) + '...');

        // Debug info about the image
        if (dataUrl.length > 1024 * 1024) {
          console.warn(`Large image detected: ${(dataUrl.length / (1024 * 1024)).toFixed(2)}MB as base64`);
        }

        if (dataUrl.startsWith('data:image/')) {
          setPhotoPreview(dataUrl);
          setFormData(prev => ({ ...prev, photo: dataUrl }));
        } else {
          console.error('Unsupported image format');
          setError('Unsupported image format');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent form submission if designation operations are in progress
    if (isDesignationOperationInProgress) {
      return;
    }

    // Prevent form submission if vendor job work operations are in progress
    if (isVendorJobWorkOperationInProgress) {
      return;
    }

    // Validate phone number before submission
    const phoneValidationError = validatePhoneNumber(formData.phone);
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      return;
    }

    setIsSubmitting(true);
    setError('');
    setIsUserUpdated(false);

    try {
      // Update user in firestore
      const userRef = doc(db, 'users', userId);

      try {
        // Helper function to set empty address fields to "N/A"
        const formatAddressField = (value: string): string => {
          return value && value.trim() !== '' ? value.trim() : 'N/A';
        };

        // Create update data object without the photo field initially
        const updateData: {
          firstName: string;
          surname: string;
          role: 'admin' | 'vendor';
          phone: string;
          email: string;
          companyName: string;
          address: {
            line1: string;
            city: string;
            district: string;
            state: string;
            country: string;
            pincode: string;
          };
          userCode: string;
          status?: string;
          updatedAt: FieldValue | Timestamp;
          profilePhotoUrl?: string | null;
          designation?: string;
          vendorJobWork?: string;
        } = {
          firstName: formData.firstName,
          surname: formData.surname,
          role: formData.category,
          phone: formData.phone,
          email: formData.email,
          companyName: formData.companyName,
          address: {
            line1: formatAddressField(formData.address.line1),
            city: formatAddressField(formData.address.city),
            district: formatAddressField(formData.address.district),
            state: formatAddressField(formData.address.state),
            country: formatAddressField(formData.address.country),
            pincode: formatAddressField(formData.address.pincode)
          },
          userCode: formData.userCode,
          status: formData.status,
          updatedAt: serverTimestamp()
        };

        // Handle profile photo upload separately
        if (formData.photo && formData.photo.startsWith('data:image/')) {
          try {
            console.log('Uploading profile photo to Firebase Storage...');
            // Create a storage reference
            const storageRef = ref(storage, `users/${userId}/profile-photo`);

            // Upload the data URL to Firebase Storage
            await uploadString(storageRef, formData.photo, 'data_url');

            // Get the download URL
            const downloadURL = await getDownloadURL(storageRef);
            console.log('Photo uploaded successfully. Download URL:', downloadURL);

            // Add the download URL to the update data
            updateData.profilePhotoUrl = downloadURL;
          } catch (uploadError) {
            console.error('Error uploading profile photo:', uploadError);
            setError('Failed to upload profile photo. Please try again with a smaller image.');
            setIsSubmitting(false);
            return;
          }
        } else if (formData.photo === null) {
          // If photo was removed, set profilePhotoUrl to null
          updateData.profilePhotoUrl = null;
        }

        // Add designation and vendorJobWork to update data
        updateData.designation = formData.designation;
        updateData.vendorJobWork = formData.vendorJobWork;

        // Update the document in Firestore
        await updateDoc(userRef, updateData);

        setIsUserUpdated(true);

        // Scroll to success message
        setTimeout(() => {
          successMessageRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }, 200);

        // Redirect to list users page after showing success message
        setTimeout(() => {
          console.log('Redirecting to admin dashboard with List Users tab...');
          // Try router first, fallback to window.location
          try {
            router.push('/admin-dashboard?tab=List Users');
          } catch (error) {
            console.log('Router failed, using window.location...');
            window.location.href = '/admin-dashboard?tab=List Users';
          }
        }, 2500);
      } catch (err: any) {
        console.error('Failed to update user:', err);

        // If the error is related to photo upload but the rest of the user data was updated
        if (err.message && err.message.includes("photo")) {
          setIsUserUpdated(true);
          setError('User profile was updated, but there was an issue with the profile picture upload. The user can still use the system normally.');

          // Scroll to success message
          setTimeout(() => {
            successMessageRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }, 200);

          setTimeout(() => {
            console.log('Redirecting to admin dashboard with List Users tab (photo error case)...');
            // Try router first, fallback to window.location
            try {
              router.push('/admin-dashboard?tab=List Users');
            } catch (error) {
              console.log('Router failed, using window.location...');
              window.location.href = '/admin-dashboard?tab=List Users';
            }
          }, 3500);
        } else {
          // Other types of errors
          setError(err.message || 'Failed to update user');
        }
      }
    } catch (err: any) {
      console.error('Error preparing data for update:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Designation management functions
  const handleAddDesignation = () => {
    if (newDesignationName.trim() && !designations.includes(newDesignationName.trim())) {
      setIsDesignationOperationInProgress(true);
      setDesignations([...designations, newDesignationName.trim()]);
      setNewDesignationName('');
      setShowAddDesignationModal(false);
      setTimeout(() => setIsDesignationOperationInProgress(false), 100);
    }
  };

  const handleEditDesignation = () => {
    if (editingDesignationIndex !== null && editingDesignationName.trim()) {
      setIsDesignationOperationInProgress(true);
      const updatedDesignations = [...designations];
      const oldDesignation = updatedDesignations[editingDesignationIndex];
      updatedDesignations[editingDesignationIndex] = editingDesignationName.trim();
      setDesignations(updatedDesignations);

      // Update form data if the edited designation was selected
      if (formData.designation === oldDesignation) {
        setFormData(prev => ({ ...prev, designation: editingDesignationName.trim() }));
      }

      setEditingDesignationIndex(null);
      setEditingDesignationName('');
      setShowEditDesignationModal(false);
      setTimeout(() => setIsDesignationOperationInProgress(false), 100);
    }
  };

  const handleDeleteDesignation = (index: number) => {
    setIsDesignationOperationInProgress(true);
    const designationToDelete = designations[index];
    const updatedDesignations = designations.filter((_, i) => i !== index);
    setDesignations(updatedDesignations);

    // Clear form data if the deleted designation was selected
    if (formData.designation === designationToDelete) {
      setFormData(prev => ({ ...prev, designation: '' }));
    }

    setActiveDesignationMenu(null);
    setTimeout(() => setIsDesignationOperationInProgress(false), 100);
  };

  const openEditDesignationModal = (index: number) => {
    setEditingDesignationIndex(index);
    setEditingDesignationName(designations[index]);
    setShowEditDesignationModal(true);
  };

  const handleVendorJobWorkChange = (jobWork: string) => {
    setFormData(prev => ({ ...prev, vendorJobWork: jobWork }));
  };

  // New vendor job work management functions
  const handleAddVendorJobWork = async () => {
    if (newVendorJobWorkName.trim() && !vendorJobWorks.includes(newVendorJobWorkName.trim())) {
      setIsVendorJobWorkOperationInProgress(true);

      try {
        if (!adminData?.uid) {
          throw new Error('Admin authentication required');
        }

        // Add job work to backend
        await addJobWork(newVendorJobWorkName.trim(), adminData.uid);

        // Refresh job works from backend
        await refetchJobWorks();

        setNewVendorJobWorkName('');
        setShowAddVendorJobWorkModal(false);
      } catch (error: any) {
        console.error('Error adding job work:', error);
        alert(error.message || 'Failed to add job work');
      } finally {
        setTimeout(() => setIsVendorJobWorkOperationInProgress(false), 100);
      }
    }
  };

  const handleEditVendorJobWork = async () => {
    if (editingVendorJobWorkIndex !== null && editingVendorJobWorkName.trim()) {
      setIsVendorJobWorkOperationInProgress(true);

      try {
        // Get the job work ID from the current job works
        const jobWorkToEdit = jobWorks.find(jw => jw.name === vendorJobWorks[editingVendorJobWorkIndex]);

        if (!jobWorkToEdit) {
          throw new Error('Job work not found');
        }

        // Check if the job work is default and prevent editing
        if (jobWorkToEdit.isDefault) {
          throw new Error('Default job works cannot be edited');
        }

        // Update job work in backend
        await updateJobWork(jobWorkToEdit.id, editingVendorJobWorkName.trim(), adminData.uid);

        // Refresh job works from backend
        await refetchJobWorks();

        setEditingVendorJobWorkIndex(null);
        setEditingVendorJobWorkName('');
        setShowEditVendorJobWorkModal(false);
      } catch (error: any) {
        console.error('Error updating job work:', error);
        alert(error.message || 'Failed to update job work');
      } finally {
        setTimeout(() => setIsVendorJobWorkOperationInProgress(false), 100);
      }
    }
  };

  const handleDeleteVendorJobWork = async (index: number) => {
    setIsVendorJobWorkOperationInProgress(true);

    try {
      const vendorJobWorkToDelete = vendorJobWorks[index];

      // Get the job work ID from the current job works
      const jobWorkToDelete = jobWorks.find(jw => jw.name === vendorJobWorkToDelete);

      if (!jobWorkToDelete) {
        throw new Error('Job work not found');
      }

      // Check if the job work is default and prevent deleting
      if (jobWorkToDelete.isDefault) {
        throw new Error('Default job works cannot be deleted');
      }

      // Delete job work from backend
      await deleteJobWork(jobWorkToDelete.id, adminData.uid);

      // Refresh job works from backend
      await refetchJobWorks();

      setActiveVendorJobWorkMenu(null);
    } catch (error: any) {
      console.error('Error deleting job work:', error);
      alert(error.message || 'Failed to delete job work');
    } finally {
      setTimeout(() => setIsVendorJobWorkOperationInProgress(false), 100);
    }
  };

  const openEditVendorJobWorkModal = (index: number) => {
    const jobWorkName = vendorJobWorks[index];
    const fullJobWork = jobWorks.find(jw => jw.name === jobWorkName);

    // Check if the job work is default and prevent editing
    if (fullJobWork?.isDefault) {
      alert('Default job works cannot be edited');
      return;
    }

    setEditingVendorJobWorkIndex(index);
    setEditingVendorJobWorkName(jobWorkName);
    setShowEditVendorJobWorkModal(true);
    setActiveVendorJobWorkMenu(null);
  };

  return (
    <AdminProtectedRoute>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-8">
                <div className="flex items-center mb-6">
                  <button
                    onClick={() => router.back()}
                    className="flex items-center text-blue-600 hover:text-blue-800 transition-colors duration-200"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Back
                  </button>
                </div>

                <div className="flex items-center mb-6">
                  <User className="h-6 w-6 text-blue-600 mr-2" />
                  <h2 className="text-2xl font-bold text-blue-800">Edit User</h2>
                </div>

                {error && (
                  <div className="mb-6 p-4 text-red-700 bg-red-50 border border-red-100 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {isUserUpdated && (
                  <div ref={successMessageRef} className="mb-6 p-4 text-green-700 bg-green-50 border border-green-100 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium">User updated successfully! Redirecting to user list...</p>
                      </div>
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Photo Upload */}
                    <div className="bg-blue-50 p-5 rounded-lg border border-blue-200">
                      <h2 className="text-lg font-semibold text-blue-800 mb-3">User Profile Photo</h2>
                      <p className="text-blue-600 mb-4 text-sm">Upload a profile photo for this user (recommended size: 300x300px)</p>

                      <div className="flex items-center space-x-6">
                        <div className="flex-shrink-0">
                          <div className="relative h-24 w-24 rounded-full overflow-hidden bg-gray-100 border-2 border-blue-300">
                            {photoPreview ? (
                              <Image
                                src={photoPreview}
                                alt="User profile preview"
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full w-full">
                                <User className="h-12 w-12 text-blue-300" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-grow">
                          <input
                            type="file"
                            id="photo"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white border border-blue-300 rounded px-4 py-2 text-blue-600 hover:bg-blue-50 font-medium text-sm flex items-center"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {photoPreview ? 'Change Photo' : 'Upload Photo'}
                          </button>
                          {photoPreview && (
                            <button
                              type="button"
                              onClick={() => {
                                setPhotoPreview(null);
                                setFormData(prev => ({ ...prev, photo: null, profilePhotoUrl: null }));
                              }}
                              className="ml-2 text-sm text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* User Category */}
                      <div>
                        <label htmlFor="category" className="block text-sm font-medium text-blue-700 items-center">
                          <Users className="h-5 w-5 mr-2 text-blue-500" />
                          User Category
                        </label>
                        <select
                          id="category"
                          name="category"
                          value={formData.category}
                          onChange={handleChange}
                          className="mt-1 block w-full py-2 px-3 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="vendor">Vendor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>

                      {/* User Status */}
                      <div>
                        <label htmlFor="status" className="block text-sm font-medium text-blue-700 items-center">
                          <Users className="h-5 w-5 mr-2 text-blue-500" />
                          Status
                        </label>
                        <select
                          id="status"
                          name="status"
                          value={formData.status}
                          onChange={handleChange}
                          className="mt-1 block w-full py-2 px-3 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    {/* User Code */}
                    <div>
                      <label htmlFor="userCode" className="block text-sm font-medium text-blue-700 items-center">
                        <Hash className="h-5 w-5 mr-2 text-blue-500" />
                        User Code
                      </label>
                      <input
                        type="text"
                        id="userCode"
                        name="userCode"
                        value={formData.userCode}
                        onChange={handleChange}
                        className="mt-1 block w-full py-2 px-3 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        readOnly
                      />
                    </div>

                    {/* Basic Information */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <h3 className="text-lg font-medium text-blue-800 mb-4 flex items-center">
                        <User className="h-5 w-5 mr-2 text-blue-600" />
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                          <label htmlFor="firstName" className="block text-sm font-medium text-blue-700">
                            First Name
                          </label>
                          <input
                            type="text"
                            id="firstName"
                            name="firstName"
                            required
                            value={formData.firstName}
                            onChange={handleChange}
                            className="mt-1 block w-full py-2 px-3 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="surname" className="block text-sm font-medium text-blue-700">
                            Surname
                          </label>
                          <input
                            type="text"
                            id="surname"
                            name="surname"
                            required
                            value={formData.surname}
                            onChange={handleChange}
                            className="mt-1 block w-full py-2 px-3 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <h3 className="text-lg font-medium text-blue-800 mb-4 flex items-center">
                        <Phone className="h-5 w-5 mr-2 text-blue-600" />
                        Contact Information
                      </h3>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                          <label htmlFor="phone" className="block text-sm font-medium text-blue-700">
                            Phone Number
                          </label>
                          <div className="mt-1 relative">
                            <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <input
                              type="tel"
                              id="phone"
                              name="phone"
                              maxLength={10}
                              required
                              value={formData.phone}
                              onChange={(e) => {
                                const numeric = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                                setFormData(prev => ({ ...prev, phone: numeric }));
                                setPhoneError(validatePhoneRealTime(numeric));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === ' ' || e.key === 'Tab') {
                                  e.preventDefault();
                                }
                              }}
                              className={`appearance-none block w-full pl-10 pr-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${phoneError ? 'border-red-500 bg-red-50' : (formData.phone && isValidPhoneNumber(formData.phone) ? 'border-green-500 bg-green-50' : 'border-blue-300')}`}
                              placeholder="Enter phone number"
                            />
                            {phoneError && (
                              <p className="mt-1 text-sm text-red-600">{phoneError}</p>
                            )}
                            {!phoneError && formData.phone.length === 10 && isValidPhoneNumber(formData.phone) && (
                              <p className="mt-1 text-sm text-green-600">✓ Valid phone number</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-blue-700">
                            <span className="flex items-center">
                              <Mail className="h-4 w-4 mr-1 text-blue-500" />
                              Email <span className="text-gray-500">(Optional)</span>
                            </span>
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="mt-1 block w-full py-2 px-3 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="user@example.com (optional)"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Company Information - For both vendors and admins */}
                    {(formData.category === 'vendor' || formData.category === 'admin') && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h3 className="text-lg font-medium text-blue-800 mb-4 flex items-center">
                          <Building className="h-5 w-5 mr-2 text-blue-600" />
                          Company Information
                        </h3>
                        <div className="grid grid-cols-1 gap-6">
                          <div>
                            <label htmlFor="companyName" className="block text-sm font-medium text-blue-700">
                              Company Name
                            </label>
                            <input
                              type="text"
                              id="companyName"
                              name="companyName"
                              value={formData.companyName}
                              onChange={handleChange}
                              className="mt-1 block w-full py-2 px-3 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          {/* Vendor-specific fields */}
                          {formData.category === 'vendor' && (
                            <>
                              {/* Enhanced Vendor Job Work Dropdown - Editable */}
                              <div className="relative vendor-job-work-dropdown">
                                <label htmlFor="vendorJobWork" className="block text-sm font-medium text-blue-700 mb-2">
                                  Vendor Job Work
                                </label>
                                <div className="relative">
                                  {/* Custom dropdown input with arrow */}
                                  <div
                                    onClick={() => setShowVendorJobWorkDropdown(!showVendorJobWorkDropdown)}
                                    className="mt-1 block w-full py-2 px-3 pr-10 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white cursor-pointer"
                                  >
                                    <span className={formData.vendorJobWork ? 'text-gray-900' : 'text-gray-500'}>
                                      {formData.vendorJobWork || 'Select Job Work'}
                                    </span>
                                    {/* Dropdown arrow */}
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  </div>

                                  {/* Custom dropdown overlay for enhanced functionality */}
                                  {showVendorJobWorkDropdown && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-blue-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                      {/* Add new vendor job work option - moved to top */}
                                      <div className="border-b border-gray-200">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowAddVendorJobWorkModal(true);
                                            setShowVendorJobWorkDropdown(false);
                                          }}
                                          className="w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 flex items-center font-medium"
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          Add New Job Work
                                        </button>
                                      </div>

                                      {/* Default option */}
                                      <div
                                        onClick={() => {
                                          setFormData(prev => ({ ...prev, vendorJobWork: '' }));
                                          setShowVendorJobWorkDropdown(false);
                                        }}
                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-gray-500"
                                      >
                                        Select Job Work
                                      </div>

                                      {/* Vendor job work options with inline edit/delete buttons */}
                                      {vendorJobWorks.map((jobWork, index) => {
                                        // Find the full job work object to check if it's default
                                        const fullJobWork = jobWorks.find(jw => jw.name === jobWork);
                                        const isDefault = fullJobWork?.isDefault || false;

                                        return (
                                          <div key={index} className="flex items-center justify-between px-3 py-2 hover:bg-blue-50 group">
                                            <div className="flex items-center flex-1 cursor-pointer" onClick={() => {
                                              setFormData(prev => ({ ...prev, vendorJobWork: jobWork }));
                                              setShowVendorJobWorkDropdown(false);
                                            }}>
                                              <span className="flex-1">{jobWork}</span>

                                            </div>
                                            {!isDefault && (
                                              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEditVendorJobWorkModal(index);
                                                    setShowVendorJobWorkDropdown(false);
                                                  }}
                                                  className="p-1 rounded hover:bg-blue-100 text-blue-600"
                                                  title="Edit job work"
                                                >
                                                  <Edit className="h-3 w-3" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const jobWorkName = jobWork;
                                                    const fullJobWork = jobWorks.find(jw => jw.name === jobWorkName);

                                                    // Check if the job work is default and prevent deleting
                                                    if (fullJobWork?.isDefault) {
                                                      alert('Default job works cannot be deleted');
                                                      return;
                                                    }

                                                    if (confirm(`Are you sure you want to delete "${jobWork}"?`)) {
                                                      handleDeleteVendorJobWork(index);
                                                    }
                                                    setShowVendorJobWorkDropdown(false);
                                                  }}
                                                  className="p-1 rounded hover:bg-red-100 text-red-600"
                                                  title="Delete job work"
                                                >
                                                  <Trash className="h-3 w-3" />
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-blue-600">
                                  Select the primary job work type for this vendor
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                  Default job works (marked with "Default" badge) cannot be edited or deleted
                                </p>
                              </div>
                            </>
                          )}

                          {/* Enhanced Designation Dropdown - Available for both admin and vendor */}
                          <div className="relative designation-dropdown">
                            <label htmlFor="designation" className="block text-sm font-medium text-blue-700 mb-2">
                              Assign Designation
                            </label>
                            <div className="relative">
                              {/* Custom dropdown input with arrow */}
                              <div
                                onClick={() => setShowDesignationDropdown(!showDesignationDropdown)}
                                className="mt-1 block w-full py-2 px-3 pr-10 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white cursor-pointer"
                              >
                                <span className={formData.designation ? 'text-gray-900' : 'text-gray-500'}>
                                  {formData.designation || 'Select Designation'}
                                </span>
                                {/* Dropdown arrow */}
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>

                              {/* Custom dropdown overlay for enhanced functionality */}
                              {showDesignationDropdown && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-blue-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                  {/* Add new designation option - moved to top */}
                                  <div className="border-b border-gray-200">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowAddDesignationModal(true);
                                        setShowDesignationDropdown(false);
                                      }}
                                      className="w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 flex items-center font-medium"
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Add New Designation
                                    </button>
                                  </div>

                                  {/* Default option */}
                                  <div
                                    onClick={() => {
                                      setFormData(prev => ({ ...prev, designation: '' }));
                                      setShowDesignationDropdown(false);
                                    }}
                                    className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-gray-500"
                                  >
                                    Select Designation
                                  </div>

                                  {/* Designation options with inline edit/delete buttons */}
                                  {designations.map((designation, index) => (
                                    <div key={index} className="flex items-center justify-between px-3 py-2 hover:bg-blue-50 group">
                                      <span
                                        onClick={() => {
                                          setFormData(prev => ({ ...prev, designation }));
                                          setShowDesignationDropdown(false);
                                        }}
                                        className="flex-1 cursor-pointer"
                                      >
                                        {designation}
                                      </span>
                                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openEditDesignationModal(index);
                                            setShowDesignationDropdown(false);
                                          }}
                                          className="p-1 rounded hover:bg-blue-100 text-blue-600"
                                          title="Edit designation"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Are you sure you want to delete "${designation}"?`)) {
                                              handleDeleteDesignation(index);
                                            }
                                            setShowDesignationDropdown(false);
                                          }}
                                          className="p-1 rounded hover:bg-red-100 text-red-600"
                                          title="Delete designation"
                                        >
                                          <Trash className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Address Information */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <h3 className="text-lg font-medium text-blue-800 mb-4 flex items-center">
                        <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                        Address
                      </h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="address.line1" className="block text-sm font-medium text-blue-700">
                            Street Address <span className="text-gray-500">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            id="address.line1"
                            name="address.line1"
                            value={formData.address.line1}
                            onChange={handleChange}
                            className="mt-1 block w-full py-2 px-3 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="address.city" className="block text-sm font-medium text-blue-700">
                            City <span className="text-gray-500">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            id="address.city"
                            name="address.city"
                            value={formData.address.city}
                            onChange={handleChange}
                            className="mt-1 block w-full py-2 px-3 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="address.state" className="block text-sm font-medium text-blue-700">
                            State <span className="text-gray-500">(Optional)</span>
                          </label>
                          <select
                            id="address.state"
                            name="address.state"
                            value={formData.address.state}
                            onChange={(e) => {
                              handleChange(e);
                              handleStateChange(e.target.value);
                            }}
                            className="mt-1 block w-full py-2 px-3 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select State</option>
                            {availableStates.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="address.district" className="block text-sm font-medium text-blue-700">
                            District <span className="text-gray-500">(Optional)</span>
                          </label>
                          <div className="relative district-autocomplete">
                            <input
                              type="text"
                              id="address.district"
                              name="address.district"
                              value={districtSearchTerm || formData.address.district}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDistrictSearchTerm(value);
                                setFormData(prev => ({
                                  ...prev,
                                  address: {
                                    ...prev.address,
                                    district: value
                                  }
                                }));
                                handleDistrictSearch(value);
                              }}
                              onFocus={() => {
                                if (formData.address.state) {
                                  setShowDistrictDropdown(true);
                                  handleDistrictSearch(districtSearchTerm);
                                }
                              }}
                              disabled={!formData.address.state}
                              className={`mt-1 block w-full py-2 px-3 pr-10 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${!formData.address.state ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                }`}
                              placeholder={!formData.address.state ? 'Select State First' : 'Type to search districts...'}
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </div>
                            {showDistrictDropdown && formData.address.state && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {filteredDistricts.length > 0 ? (
                                  filteredDistricts.map((district) => (
                                    <button
                                      key={district}
                                      type="button"
                                      onClick={() => handleDistrictSelect(district)}
                                      className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center"
                                    >
                                      {district}
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-3 py-2 text-gray-500">No districts found matching your search.</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label htmlFor="address.country" className="block text-sm font-medium text-blue-700">
                            Country <span className="text-gray-500">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            id="address.country"
                            name="address.country"
                            value={formData.address.country}
                            onChange={handleChange}
                            className="mt-1 block w-full py-2 px-3 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="address.pincode" className="block text-sm font-medium text-blue-700">
                            Pincode <span className="text-gray-500">(Optional)</span>
                          </label>
                          <div className="relative pincode-autocomplete">
                            <input
                              type="text"
                              id="address.pincode"
                              name="address.pincode"
                              value={pincodeSearchTerm || formData.address.pincode}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Only allow digits and limit to 6 characters
                                if (/^\d{0,6}$/.test(value)) {
                                  setPincodeSearchTerm(value);
                                  setFormData(prev => ({
                                    ...prev,
                                    address: {
                                      ...prev.address,
                                      pincode: value
                                    }
                                  }));
                                  handlePincodeSearch(value);
                                }
                              }}
                              onFocus={() => {
                                setShowPincodeDropdown(true);
                                handlePincodeSearch(pincodeSearchTerm);
                              }}
                              maxLength={6}
                              className="mt-1 block w-full py-2 px-3 pr-10 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Type to search pincodes..."
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </div>
                            {showPincodeDropdown && filteredPincodes.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {filteredPincodes.map((pincode) => (
                                  <button
                                    key={pincode}
                                    type="button"
                                    onClick={() => handlePincodeSelect(pincode)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center"
                                  >
                                    {pincode}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating User...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Update User
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Designation Modal */}
      {showAddDesignationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add New Designation</h3>
              <button
                onClick={() => {
                  setShowAddDesignationModal(false);
                  setNewDesignationName('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4">
              <label htmlFor="newDesignation" className="block text-sm font-medium text-gray-700 mb-2">
                Designation Name
              </label>
              <input
                type="text"
                id="newDesignation"
                value={newDesignationName}
                onChange={(e) => setNewDesignationName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddDesignation()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter designation name"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddDesignationModal(false);
                  setNewDesignationName('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDesignation}
                disabled={!newDesignationName.trim() || designations.includes(newDesignationName.trim())}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Designation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Designation Modal */}
      {showEditDesignationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Designation</h3>
              <button
                onClick={() => {
                  setShowEditDesignationModal(false);
                  setEditingDesignationIndex(null);
                  setEditingDesignationName('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4">
              <label htmlFor="editDesignation" className="block text-sm font-medium text-gray-700 mb-2">
                Designation Name
              </label>
              <input
                type="text"
                id="editDesignation"
                value={editingDesignationName}
                onChange={(e) => setEditingDesignationName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleEditDesignation()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter designation name"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditDesignationModal(false);
                  setEditingDesignationIndex(null);
                  setEditingDesignationName('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleEditDesignation}
                disabled={!editingDesignationName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vendor Job Work Modal */}
      {showAddVendorJobWorkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add New Vendor Job Work</h3>
              <button
                onClick={() => {
                  setShowAddVendorJobWorkModal(false);
                  setNewVendorJobWorkName('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4">
              <label htmlFor="newVendorJobWork" className="block text-sm font-medium text-gray-700 mb-2">
                Job Work Name
              </label>
              <input
                type="text"
                id="newVendorJobWork"
                value={newVendorJobWorkName}
                onChange={(e) => setNewVendorJobWorkName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddVendorJobWork()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter job work name"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddVendorJobWorkModal(false);
                  setNewVendorJobWorkName('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddVendorJobWork}
                disabled={!newVendorJobWorkName.trim() || vendorJobWorks.includes(newVendorJobWorkName.trim())}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Job Work
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vendor Job Work Modal */}
      {showEditVendorJobWorkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Vendor Job Work</h3>
              <button
                onClick={() => {
                  setShowEditVendorJobWorkModal(false);
                  setEditingVendorJobWorkIndex(null);
                  setEditingVendorJobWorkName('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4">
              <label htmlFor="editVendorJobWork" className="block text-sm font-medium text-gray-700 mb-2">
                Job Work Name
              </label>
              <input
                type="text"
                id="editVendorJobWork"
                value={editingVendorJobWorkName}
                onChange={(e) => setEditingVendorJobWorkName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleEditVendorJobWork()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter job work name"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditVendorJobWorkModal(false);
                  setEditingVendorJobWorkIndex(null);
                  setEditingVendorJobWorkName('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleEditVendorJobWork}
                disabled={!editingVendorJobWorkName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminProtectedRoute>
  );
}
