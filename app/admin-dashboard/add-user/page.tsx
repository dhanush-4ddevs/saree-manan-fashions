'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, User, Users, Phone, Mail, Key, Building, MapPin, Hash, UserPlus, Edit, Trash, Printer, CheckCircle, Eye, EyeOff, MoreVertical, Plus, X } from 'lucide-react';
import Image from 'next/image';
import { createUser, getCurrentUser, addJobWork, updateJobWork, deleteJobWork, getAllJobWorks } from '@/config/firebase';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { collection, query, orderBy, limit, getDocs, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  getAllStateNames,
  getDistrictsForState,
  validatePinCode,
  isValidIndianPinCode,
  getLocationFromPinCode,
  isValidDistrictForState,
  type PinCodeData
} from '../../utils/indianGeographicData';
import { useJobWorks } from '@/hooks/useJobWorks';
import { Toast } from '@/components/shared/Toast';

interface UserFormData {
  category: 'admin' | 'vendor' | '';
  firstName: string;
  surname: string;
  phone: string;
  email: string;
  password: string;
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
  designation?: string;
  vendorJobWork?: string;
}

// Interface for user data
interface UserData {
  id: string;
  userCode: string;
  firstName: string;
  surname: string;
  category: string;
  jobWork?: string;
  vendorJobWork?: string;
  designation?: string;
  phone: string;
  address: {
    line1: string;
    city: string;
    district: string;
    state: string;
    country: string;
    pincode: string;
  };
  email: string;
  companyName: string;
  status?: string;
  role?: string;
  createdAt?: any;
  profilePhotoUrl?: string; // Firebase Storage URL
  photo?: string | null;    // Base64 photo data (fallback)
}

// Validation errors interface
interface ValidationErrors {
  phone?: string;
  email?: string;
  firstName?: string;
  surname?: string;
  companyName?: string;
  category?: string;
  vendorJobWork?: string;
  address?: {
    line1?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };
}

export default function AddUser() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorMessageRef = useRef<HTMLDivElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [realTimeErrors, setRealTimeErrors] = useState<{ phone?: string | null; email?: string | null; pincode?: string | null }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUserCreated, setIsUserCreated] = useState(false);
  const [adminData, setAdminData] = useState<any>(null);
  const [recentUsers, setRecentUsers] = useState<UserData[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [isPincodeLoading, setIsPincodeLoading] = useState(false);
  const [availableStates] = useState<string[]>(getAllStateNames());
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

  // New state for designation management
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
  // Add state to track designation operations to prevent form submission
  const [isDesignationOperationInProgress, setIsDesignationOperationInProgress] = useState(false);

  // New state for vendor job work management - Updated to use dynamic data
  const [vendorJobWorks, setVendorJobWorks] = useState<string[]>([]);
  const [showVendorJobWorkDropdown, setShowVendorJobWorkDropdown] = useState(false);
  const [showAddVendorJobWorkModal, setShowAddVendorJobWorkModal] = useState(false);
  const [showEditVendorJobWorkModal, setShowEditVendorJobWorkModal] = useState(false);
  const [newVendorJobWorkName, setNewVendorJobWorkName] = useState('');
  const [editingVendorJobWorkIndex, setEditingVendorJobWorkIndex] = useState<number | null>(null);
  const [editingVendorJobWorkName, setEditingVendorJobWorkName] = useState('');
  const [activeVendorJobWorkMenu, setActiveVendorJobWorkMenu] = useState<number | null>(null);
  // Add state to track vendor job work operations to prevent form submission
  const [isVendorJobWorkOperationInProgress, setIsVendorJobWorkOperationInProgress] = useState(false);

  // Toast state
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // New states for autocomplete functionality
  const [districtSearchTerm, setDistrictSearchTerm] = useState<string>('');
  const [showDistrictDropdown, setShowDistrictDropdown] = useState<boolean>(false);
  const [filteredDistricts, setFilteredDistricts] = useState<string[]>([]);

  const [pincodeSearchTerm, setPincodeSearchTerm] = useState<string>('');
  const [showPincodeDropdown, setShowPincodeDropdown] = useState<boolean>(false);
  const [filteredPincodes, setFilteredPincodes] = useState<string[]>([]);

  // Sample pincode data for autocomplete (in real app, this would come from API)
  const samplePincodes = [
    '400001', '400002', '400003', '400004', '400005', '400006', '400007', '400008', '400009', '400010',
    '110001', '110002', '110003', '110004', '110005', '110006', '110007', '110008', '110009', '110010',
    '560001', '560002', '560003', '560004', '560005', '560006', '560007', '560008', '560009', '560010',
    '600001', '600002', '600003', '600004', '600005', '600006', '600007', '600008', '600009', '600010',
    '700001', '700002', '700003', '700004', '700005', '700006', '700007', '700008', '700009', '700010'
  ];

  const [formData, setFormData] = useState<UserFormData>({
    category: '',
    firstName: '',
    surname: '',
    phone: '',
    email: '',
    password: '',
    companyName: '',
    address: {
      line1: '',
      city: '',
      district: '',
      state: '',
      country: 'India',
      pincode: ''
    },
    userCode: '',
    photo: null,
    designation: '',
    vendorJobWork: ''
  });

  // Use the job works hook
  const { jobWorks, jobWorkNames, loading: jobWorksLoading, error: jobWorksError, refetch: refetchJobWorks } = useJobWorks();

  // Update vendor job works when job work names are loaded
  useEffect(() => {
    if (jobWorkNames.length > 0) {
      setVendorJobWorks(jobWorkNames);
    }
  }, [jobWorkNames]);

  // Vendor job work options - Updated to use dynamic data from database
  const vendorJobWorkOptions = jobWorkNames;

  // Validation functions
  const validatePhoneNumber = (phone: string): string | null => {
    if (!phone) return 'Phone number is required.';
    if (!/^\d{10}$/.test(phone)) return 'Phone number must be exactly 10 digits.';
    if (!/^[6-9]/.test(phone)) return 'Phone number must start with 6, 7, 8, or 9.';
    return null;
  };

  const validateEmail = (email: string): string | null => {
    if (!email) return null; // Email is now optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Email address is not in a valid format, e.g., user@example.com.';
    return null;
  };

  const validatePincodeField = (pincode: string): string | null => {
    if (!pincode) return null; // Pincode is now optional
    if (!validatePinCode(pincode)) return 'PIN code must be exactly 6 digits.';
    if (!isValidIndianPinCode(pincode)) return 'Please enter a valid Indian PIN code.';
    return null;
  };

  // Real-time validation functions
  const validatePhoneRealTime = (phone: string): string | null => {
    if (!phone) return null; // Don't show error for empty field while typing
    if (!/^\d+$/.test(phone)) return 'Only numbers are allowed.';
    if (phone.length < 10) return `Enter ${10 - phone.length} more digit${10 - phone.length > 1 ? 's' : ''}.`;
    if (!/^[6-9]/.test(phone)) return 'Phone number must start with 6, 7, 8, or 9.';
    return null; // Valid
  };

  const validateEmailRealTime = (email: string): string | null => {
    if (!email) return null; // Don't show error for empty field while typing
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (!email.includes('@')) return 'Email must contain @ symbol.';
      if (!email.includes('.')) return 'Email must contain a domain (e.g., .com).';
      return 'Please enter a valid email format.';
    }
    return null; // Valid
  };

  const validatePincodeRealTime = (pincode: string): string | null => {
    if (!pincode) return null; // Don't show error for empty field while typing
    if (!/^\d+$/.test(pincode)) return 'Only numbers are allowed.';
    if (pincode.length < 6) return `Enter ${6 - pincode.length} more digit${6 - pincode.length > 1 ? 's' : ''}.`;
    if (pincode.length > 6) return 'PIN code cannot be more than 6 digits.';

    // If 6 digits, check if it's a valid Indian PIN code
    if (pincode.length === 6) {
      if (!isValidIndianPinCode(pincode)) {
        return 'Please enter a valid Indian PIN code.';
      }
    }

    return null; // Valid
  };

  const validateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {};

    // Validate category
    if (!formData.category) {
      errors.category = 'Please select a user category.';
    }

    // Validate phone
    const phoneError = validatePhoneNumber(formData.phone);
    if (phoneError) errors.phone = phoneError;

    // Validate email (now optional)
    const emailError = validateEmail(formData.email);
    if (emailError) errors.email = emailError;

    // Validate required fields
    if (!formData.firstName.trim()) errors.firstName = 'First name is required.';
    if (!formData.surname.trim()) errors.surname = 'Surname is required.';

    // Validate company name for both vendors and admins
    if (formData.category === 'vendor' || formData.category === 'admin') {
      if (!formData.companyName.trim()) {
        errors.companyName = `Company name is required for ${formData.category}s.`;
      }
    }

    if (formData.category === 'vendor') {
      if (!formData.vendorJobWork || formData.vendorJobWork.trim() === '') {
        errors.vendorJobWork = 'Please select a job work for vendors.';
      }
    } else if (formData.category === 'admin') {
      // For admin users, automatically set job work to 'admin'
      if (!formData.vendorJobWork || formData.vendorJobWork.trim() === '') {
        formData.vendorJobWork = 'admin';
      }
    }

    // Validate address fields (now optional)
    const addressErrors: any = {};
    // City is optional - no validation needed
    // District is optional - no validation needed
    // State is optional - no validation needed
    // Country is auto-filled as India - no validation needed

    // Validate PIN code (now optional)
    const pincodeError = validatePincodeField(formData.address.pincode);
    if (pincodeError) addressErrors.pincode = pincodeError;

    // Validate district belongs to selected state (only if both are provided)
    if (formData.address.state && formData.address.district) {
      if (!isValidDistrictForState(formData.address.state, formData.address.district)) {
        addressErrors.district = 'Selected district does not belong to the selected state.';
      }
    }

    if (Object.keys(addressErrors).length > 0) {
      errors.address = addressErrors;
    }

    return errors;
  };

  const scrollToErrors = () => {
    if (errorMessageRef.current) {
      errorMessageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  };

  // Get current admin data and recent users
  useEffect(() => {
    const loadAdminData = async () => {
      try {
        const userData = await getCurrentUser();
        setAdminData(userData);
      } catch (error) {
        console.error('Error loading admin data:', error);
      }
    };

    loadAdminData();
    fetchRecentUsers();
  }, []);

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

  // Fetch recent users
  const fetchRecentUsers = async () => {
    try {
      const usersCollection = collection(db, 'users');
      const usersQuery = query(usersCollection, orderBy('createdAt', 'desc'), limit(5));
      const usersSnapshot = await getDocs(usersQuery);

      const usersList = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          profilePhotoUrl: data.profilePhotoUrl || null,
          photo: data.photo || null,
          createdAt: data.createdAt instanceof Timestamp ?
            data.createdAt.toDate().toISOString() :
            data.createdAt
        } as UserData;
      });

      setRecentUsers(usersList);
    } catch (error) {
      console.error('Error fetching recent users:', error);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setFormData(prev => ({ ...prev, photo: reader.result as string }));
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

    setIsSubmitting(true);
    setError('');
    setValidationErrors({});
    setIsUserCreated(false);

    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setIsSubmitting(false);

      // Create error message summary
      const errorMessages = [] as string[];
      if (errors.phone) errorMessages.push(errors.phone);
      if (errors.email) errorMessages.push(errors.email);
      if (errors.category) errorMessages.push(errors.category);
      if (errors.firstName) errorMessages.push(errors.firstName);
      if (errors.surname) errorMessages.push(errors.surname);
      if (errors.companyName) errorMessages.push(errors.companyName);
      if (errors.vendorJobWork) errorMessages.push(errors.vendorJobWork);
      if (errors.address) {
        Object.values(errors.address).forEach(msg => errorMessages.push(msg));
      }
      const combined = errorMessages.join(' ');
      setError(combined);
      setToastMessage(combined);
      setToastType('error');
      setIsToastVisible(true);

      // Scroll to error message
      setTimeout(scrollToErrors, 100);
      return;
    }

    try {
      if (!adminData || !adminData.uid) {
        throw new Error('Admin authentication required');
      }

      // Ensure password is set - fallback to phone number if empty
      const dataToSubmit = {
        ...formData,
        password: formData.password || formData.phone,
        role: formData.category as 'admin' | 'vendor',
        vendorJobWork: formData.category === 'admin' ? 'admin' : formData.vendorJobWork
      };

      if (!dataToSubmit.password) {
        throw new Error('Phone number is required as it will be used as the default password');
      }

      // Ensure category is selected before proceeding
      if (!formData.category) {
        throw new Error('Please select a user category');
      }

      try {
        // Create user through firebase authentication and firestore
        await createUser(dataToSubmit, adminData.uid);
        setIsUserCreated(true);
        setToastMessage('User created successfully');
        setToastType('success');
        setIsToastVisible(true);

        // Refresh recent users list
        fetchRecentUsers();

        // Reset form after successful user creation
        setFormData({
          category: '',
          firstName: '',
          surname: '',
          phone: '',
          email: '',
          password: '',
          companyName: '',
          address: {
            line1: '',
            city: '',
            district: '',
            state: '',
            country: 'India',
            pincode: ''
          },
          userCode: '',
          photo: null,
          designation: '',
          vendorJobWork: ''
        });
        setPhotoPreview(null);
        setValidationErrors({});
        setRealTimeErrors({});

        // Do not redirect; remain on this page and show toast
      } catch (err: any) {
        console.error('Failed to add user:', err);

        // If the error message contains information about profile photo upload failure
        // but the user was successfully created
        if (err.message && (err.message.includes("User was created") || err.message.includes("User created"))) {
          setIsUserCreated(true);
          const msg = 'User was created successfully, but there was an issue with the profile picture upload. The user can still use the system normally.';
          setError(msg);
          setToastMessage(msg);
          setToastType('error');
          setIsToastVisible(true);
        } else {
          // Other types of errors
          const msg = err.message || 'Failed to add user. Please try again.';
          setError(msg);
          setToastMessage(msg);
          setToastType('error');
          setIsToastVisible(true);
        }
        setTimeout(scrollToErrors, 100);
      }
    } catch (err: any) {
      console.error('Failed to validate form or prepare data:', err);
      const msg = err.message || 'Invalid form data. Please check all fields and try again.';
      setError(msg);
      setToastMessage(msg);
      setToastType('error');
      setIsToastVisible(true);
      setTimeout(scrollToErrors, 100);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Handle category change
    if (name === 'category') {
      setFormData(prev => ({
        ...prev,
        category: value as 'admin' | 'vendor' | '',
        // Reset vendor-specific fields when changing category, but preserve company name for both admin and vendor
        companyName: (value === 'vendor' || value === 'admin') ? prev.companyName : '',
        designation: (value === 'vendor' || value === 'admin') ? prev.designation : '',
        vendorJobWork: value === 'vendor' ? prev.vendorJobWork : value === 'admin' ? 'admin' : ''
      }));

      // Clear category validation error
      if (validationErrors.category) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.category;
          return newErrors;
        });
      }
      return;
    }

    // Handle first name or surname changes - auto-fill company name
    if (name === 'firstName' || name === 'surname') {
      setFormData(prev => {
        const newData = {
          ...prev,
          [name]: value
        };

        // Auto-fill company name with first name + surname
        const firstName = name === 'firstName' ? value : prev.firstName;
        const surname = name === 'surname' ? value : prev.surname;
        const fullName = `${firstName} ${surname}`.trim();

        return {
          ...newData,
          companyName: fullName || prev.companyName
        };
      });

      // Clear validation errors
      if (validationErrors[name as keyof ValidationErrors]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name as keyof ValidationErrors];
          return newErrors;
        });
      }
      return;
    }

    // Handle phone number with restrictions and real-time validation
    if (name === 'phone') {
      // Only allow digits and limit to 10 characters
      const numericValue = value.replace(/\D/g, '').slice(0, 10);

      // Update form data
      setFormData(prev => ({
        ...prev,
        phone: numericValue,
        password: numericValue // Set password to match phone
      }));

      // Real-time validation for phone
      const phoneError = validatePhoneRealTime(numericValue);
      setRealTimeErrors(prev => ({
        ...prev,
        phone: phoneError
      }));

      // Clear form validation errors
      if (validationErrors.phone) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.phone;
          return newErrors;
        });
      }
      return;
    }

    // Handle email with real-time validation
    if (name === 'email') {
      // Update form data
      setFormData(prev => ({
        ...prev,
        email: value
      }));

      // Real-time validation for email
      const emailError = validateEmailRealTime(value);
      setRealTimeErrors(prev => ({
        ...prev,
        email: emailError
      }));

      // Clear form validation errors
      if (validationErrors.email) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.email;
          return newErrors;
        });
      }
      return;
    }

    // Handle PIN code with auto-fill functionality
    if (name === 'address.pincode') {
      const numericValue = value.replace(/\D/g, '').slice(0, 6);

      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          pincode: numericValue
        }
      }));

      // Real-time validation for PIN code
      const pincodeError = validatePincodeRealTime(numericValue);
      setRealTimeErrors(prev => ({
        ...prev,
        pincode: pincodeError
      }));

      // Auto-fill when PIN code is complete and valid
      if (numericValue.length === 6 && validatePinCode(numericValue)) {
        handlePincodeAutoFill(numericValue);
      }

      // Clear form validation errors
      if (validationErrors.address?.pincode) {
        setValidationErrors(prev => ({
          ...prev,
          address: {
            ...prev.address,
            pincode: undefined
          }
        }));
      }
      return;
    }

    // Handle state selection
    if (name === 'address.state') {
      handleStateChange(value);

      // Clear validation errors
      if (validationErrors.address?.state) {
        setValidationErrors(prev => ({
          ...prev,
          address: {
            ...prev.address,
            state: undefined
          }
        }));
      }
      return;
    }

    // Clear validation errors for the field being changed
    if (validationErrors[name as keyof ValidationErrors]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof ValidationErrors];
        return newErrors;
      });
    }

    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];

      // Clear address validation errors
      if (validationErrors.address?.[addressField as keyof ValidationErrors['address']]) {
        setValidationErrors(prev => ({
          ...prev,
          address: {
            ...prev.address,
            [addressField]: undefined
          }
        }));
      }

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

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        fetchRecentUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user. Please try again.');
      }
    }
  };

  const handleEditUser = (userId: string) => {
    router.push(`/admin-dashboard/edit-user/${userId}`);
  };

  const handlePrintUser = (user: UserData) => {
    const doc = new jsPDF();

    // Add company logo/header
    doc.setFontSize(20);
    doc.text('User Details Report', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 22, { align: 'center' });

    // Add user details in a structured format
    const userDetails = [
      ['User Code', user.userCode || 'N/A'],
      ['Name', `${user.firstName} ${user.surname}`],
      ['Category', user.category || user.role || 'N/A'],
      ['Designation', user.designation || 'N/A'],
      ['Job Work', user.vendorJobWork || user.jobWork || 'N/A'],
      ['Phone', user.phone || 'N/A'],
      ['Email', user.email],
      ['Company Name', user.companyName || 'N/A'],
      ['Status', user.status || 'Active']
    ];

    // Add address details if available
    if (user.address) {
      userDetails.push(
        ['Address', user.address.line1],
        ['City', user.address.city],
        ['District', user.address.district],
        ['State', user.address.state],
        ['Country', user.address.country],
        ['Pincode', user.address.pincode]
      );
    }

    // Create table with user details
    autoTable(doc, {
      startY: 30,
      head: [['Field', 'Value']],
      body: userDetails,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 245, 255] },
      styles: {
        fontSize: 10,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 40 }, // Field
        1: { cellWidth: 60 }  // Value
      }
    });

    doc.save(`user-${user.userCode || user.id}.pdf`);
  };

  // Handler for deleting recent users
  const handleDeleteRecentUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        fetchRecentUsers(); // Refresh the recent users list
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user. Please try again.');
      }
    }
  };

  // Handler for printing recent users (using same logic as handlePrintUser)
  const handlePrintRecentUser = (user: UserData) => {
    handlePrintUser(user);
  };

  // PIN code auto-fill functionality
  const handlePincodeAutoFill = async (pincode: string) => {
    if (!validatePinCode(pincode)) {
      return;
    }

    setIsPincodeLoading(true);
    setRealTimeErrors(prev => ({ ...prev, pincode: null }));

    try {
      const locationData: PinCodeData | null = await getLocationFromPinCode(pincode);

      if (locationData) {
        // Auto-fill state and district
        setFormData(prev => ({
          ...prev,
          address: {
            ...prev.address,
            state: locationData.state,
            district: locationData.district,
            city: locationData.city || prev.address.city, // Only update city if available
            pincode: pincode
          }
        }));

        // Update available districts for the auto-filled state
        const districts = getDistrictsForState(locationData.state);
        setAvailableDistricts(districts);

        // Clear any existing validation errors for auto-filled fields
        setValidationErrors(prev => ({
          ...prev,
          address: {
            ...prev.address,
            state: undefined,
            district: undefined,
            pincode: undefined
          }
        }));
      } else {
        // PIN code not found in local database
        // Check if it's a valid Indian PIN code pattern
        if (isValidIndianPinCode(pincode)) {
          // Valid Indian PIN code but not in our database - don't show error
          // Just clear any existing errors and let user enter manually
          setRealTimeErrors(prev => ({
            ...prev,
            pincode: null
          }));
        } else {
          // Invalid PIN code pattern
          setRealTimeErrors(prev => ({
            ...prev,
            pincode: 'Please enter a valid Indian PIN code.'
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching location from PIN code:', error);
      // Don't show error for network issues if PIN code is valid
      if (isValidIndianPinCode(pincode)) {
        setRealTimeErrors(prev => ({
          ...prev,
          pincode: null
        }));
      } else {
        setRealTimeErrors(prev => ({
          ...prev,
          pincode: 'Please enter a valid Indian PIN code.'
        }));
      }
    } finally {
      setIsPincodeLoading(false);
    }
  };

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

    // Clear validation error when district is selected
    if (validationErrors.address?.district) {
      setValidationErrors(prev => ({
        ...prev,
        address: {
          ...prev.address,
          district: undefined
        }
      }));
    }
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

    // Trigger pincode auto-fill
    handlePincodeAutoFill(pincode);
  };

  // New designation management functions
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
    setActiveDesignationMenu(null);
  };

  // Handle vendor job work selection
  const handleVendorJobWorkChange = (jobWork: string) => {
    setFormData(prev => ({
      ...prev,
      vendorJobWork: jobWork
    }));

    // Clear validation error when user selects job work
    if (validationErrors.vendorJobWork) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.vendorJobWork;
        return newErrors;
      });
    }
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
        if (!adminData?.uid) {
          throw new Error('Admin authentication required');
        }

        // Get the job work ID from the current job works
        const currentJobWorks = await getAllJobWorks();
        const jobWorkToEdit = currentJobWorks.find(jw => jw.name === vendorJobWorks[editingVendorJobWorkIndex]);

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
      if (!adminData?.uid) {
        throw new Error('Admin authentication required');
      }

      const vendorJobWorkToDelete = vendorJobWorks[index];

      // Get the job work ID from the current job works
      const currentJobWorks = await getAllJobWorks();
      const jobWorkToDelete = currentJobWorks.find(jw => jw.name === vendorJobWorkToDelete);

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

  // Check if fields should be disabled
  const isFieldsDisabled = !formData.category;

  return (
    <AdminProtectedRoute>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 py-0 px-0">
        <div className="max-w-7xl mx-auto px-0 sm:px-0 lg:px-8">
          {/* Back Button */}
          {/* <button
            onClick={() => router.push('/admin-dashboard')}
            className="mb-6 flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button> */}

          <div className="grid grid-cols-1 gap-4">
            {/* Add User Form */}
            <div>
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-blue-700 to-blue-600 py-6 px-8">
                  <div className="flex items-center text-white">
                    <div className="bg-white/10 p-3 rounded-full">
                      <UserPlus className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold ml-4">Add New User</h1>
                  </div>
                </div>

                <div className="p-2">
                  {isUserCreated && (
                    <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
                      <div className="flex">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                        <div>
                          <p className="font-medium">User created successfully!</p>
                          <p className="text-sm mt-1">The user has been added to the system and can now log in.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* User Profile Photo - Highlighted for emphasis */}
                    <div className={`p-5 rounded-lg border ${isFieldsDisabled ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
                      <h2 className={`text-lg font-semibold mb-3 ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-800'}`}>User Profile Photo</h2>
                      <p className={`mb-4 text-sm ${isFieldsDisabled ? 'text-gray-400' : 'text-blue-600'}`}>Upload a profile photo for this user (recommended size: 300x300px)</p>

                      <div className="flex items-center space-x-6">
                        <div className="flex-shrink-0">
                          <div className={`relative h-24 w-24 rounded-full overflow-hidden bg-gray-100 border-2 ${isFieldsDisabled ? 'border-gray-300' : 'border-blue-300'}`}>
                            {photoPreview ? (
                              <Image
                                src={photoPreview}
                                alt="User profile preview"
                                fill
                                className={`object-cover ${isFieldsDisabled ? 'opacity-50' : ''}`}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full w-full">
                                <User className={`h-12 w-12 ${isFieldsDisabled ? 'text-gray-300' : 'text-blue-300'}`} />
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
                            disabled={isFieldsDisabled}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isFieldsDisabled}
                            className={`border rounded px-4 py-2 font-medium text-sm flex items-center ${isFieldsDisabled
                              ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                              : 'bg-white border-blue-300 text-blue-600 hover:bg-blue-50'
                              }`}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {photoPreview ? 'Change Photo' : 'Upload Photo'}
                          </button>
                          {photoPreview && !isFieldsDisabled && (
                            <button
                              type="button"
                              onClick={() => {
                                setPhotoPreview(null);
                                setFormData(prev => ({ ...prev, photo: null }));
                              }}
                              className="ml-2 text-sm text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      {isFieldsDisabled && (
                        <p className="mt-2 text-sm text-red-600">Please select a user category first to enable this field.</p>
                      )}
                    </div>

                    {/* User Category */}
                    <div>
                      <label htmlFor="category" className=" text-sm font-medium inline-flex text-blue-700 items-center ml-2">
                        <Users className="h-5 w-5 mr-2 text-blue-500" />
                        User Category <span className="text-red-500 ml-[1px]">*</span>
                      </label>
                      <select
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className={`mt-1 block w-full py-2 px-3 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${validationErrors.category ? 'border-red-500 bg-red-50' : 'border-blue-300'
                          }`}
                      >
                        <option value="">Select Category</option>
                        <option value="vendor">Vendor</option>
                        <option value="admin">Admin</option>
                      </select>
                      {validationErrors.category && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.category}</p>
                      )}
                    </div>

                    {/* Basic Information */}
                    <div className={`p-2 rounded-lg border ${isFieldsDisabled ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
                      <h3 className={`text-lg font-medium mb-4 flex items-center ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-800'}`}>
                        <User className={`h-5 w-5 mr-2 ${isFieldsDisabled ? 'text-gray-400' : 'text-blue-600'}`} />
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                          <label htmlFor="firstName" className={`block text-sm font-medium ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-700'}`}>
                            First Name
                          </label>
                          <input
                            type="text"
                            id="firstName"
                            name="firstName"
                            required
                            value={formData.firstName}
                            onChange={handleChange}
                            disabled={isFieldsDisabled}
                            className={`mt-1 block w-full py-2 px-3 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                              ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                              : validationErrors.firstName ? 'border-red-500 bg-red-50' : 'border-blue-300'
                              }`}
                          />
                        </div>
                        <div>
                          <label htmlFor="surname" className={`block text-sm font-medium ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-700'}`}>
                            Surname
                          </label>
                          <input
                            type="text"
                            id="surname"
                            name="surname"
                            required
                            value={formData.surname}
                            onChange={handleChange}
                            disabled={isFieldsDisabled}
                            className={`mt-1 block w-full py-2 px-3 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                              ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                              : validationErrors.surname ? 'border-red-500 bg-red-50' : 'border-blue-300'
                              }`}
                          />
                        </div>
                      </div>
                      {isFieldsDisabled && (
                        <p className="mt-2 text-sm text-red-600">Please select a user category first to enable these fields.</p>
                      )}
                    </div>

                    {/* Contact Information */}
                    <div className={`p-2 rounded-lg border ${isFieldsDisabled ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
                      <h3 className={`text-lg font-medium mb-4 flex items-center ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-800'}`}>
                        <Phone className={`h-5 w-5 mr-2 ${isFieldsDisabled ? 'text-gray-400' : 'text-blue-600'}`} />
                        Contact Information
                      </h3>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                          <label htmlFor="phone" className={`block text-sm font-medium ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-700'}`}>
                            Phone Number (will be used as default password)
                          </label>
                          <input
                            type="tel"
                            id="phone"
                            name="phone"
                            required
                            value={formData.phone}
                            onChange={handleChange}
                            maxLength={10}
                            disabled={isFieldsDisabled}
                            className={`mt-1 block w-full py-2 px-3 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                              ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                              : validationErrors.phone || realTimeErrors.phone ? 'border-red-500 bg-red-50' :
                                realTimeErrors.phone === null && formData.phone.length === 10 ? 'border-green-500 bg-green-50' : 'border-blue-300'
                              }`}
                            placeholder="10 digits starting with 6, 7, 8, or 9"
                          />
                          {!isFieldsDisabled && realTimeErrors.phone && (
                            <p className="mt-1 text-sm text-red-600">{realTimeErrors.phone}</p>
                          )}
                          {!isFieldsDisabled && realTimeErrors.phone === null && formData.phone.length === 10 && (
                            <p className="mt-1 text-sm text-green-600">✓ Valid phone number</p>
                          )}
                        </div>
                        <div>
                          <label htmlFor="email" className={`block text-sm font-medium ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-700'}`}>
                            <span className="flex items-center">
                              <Mail className={`h-4 w-4 mr-1 ${isFieldsDisabled ? 'text-gray-400' : 'text-blue-500'}`} />
                              Email <span className="text-gray-500">(Optional)</span>
                            </span>
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={isFieldsDisabled}
                            className={`mt-1 block w-full py-2 px-3 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                              ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                              : validationErrors.email || realTimeErrors.email ? 'border-red-500 bg-red-50' :
                                realTimeErrors.email === null && formData.email ? 'border-green-500 bg-green-50' : 'border-blue-300'
                              }`}
                            placeholder="user@example.com (optional)"
                          />
                          {!isFieldsDisabled && realTimeErrors.email && (
                            <p className="mt-1 text-sm text-red-600">{realTimeErrors.email}</p>
                          )}
                          {!isFieldsDisabled && realTimeErrors.email === null && formData.email && (
                            <p className="mt-1 text-sm text-green-600">✓ Valid email address</p>
                          )}
                        </div>
                      </div>
                      {isFieldsDisabled && (
                        <p className="mt-2 text-sm text-red-600">Please select a user category first to enable these fields.</p>
                      )}
                    </div>

                    {/* Address Information */}
                    <div className={`p-2 rounded-lg border ${isFieldsDisabled ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
                      <h3 className={`text-lg font-medium mb-4 flex items-center ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-800'}`}>
                        <MapPin className={`h-5 w-5 mr-2 ${isFieldsDisabled ? 'text-gray-400' : 'text-blue-600'}`} />
                        Address Information
                      </h3>

                      {/* Country (Auto-filled) */}
                      <div className="mb-4">
                        <label htmlFor="address.country" className={`block text-sm font-medium ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-700'}`}>
                          Country
                        </label>
                        <input
                          type="text"
                          id="address.country"
                          name="address.country"
                          value={formData.address.country}
                          readOnly
                          disabled={isFieldsDisabled}
                          className={`mt-1 block w-full py-2 px-3 border rounded-md shadow-sm cursor-not-allowed ${isFieldsDisabled
                            ? 'bg-gray-100 border-gray-300 text-gray-500'
                            : 'border-blue-300 bg-blue-50 text-blue-700'
                            }`}
                          placeholder="India"
                        />
                        <p className={`mt-1 text-xs ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-600'}`}>Country is automatically set to India</p>
                      </div>

                      {/* State and District */}
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-4">
                        <div>
                          <label htmlFor="address.state" className={`block text-sm font-medium ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-700'}`}>
                            State <span className="text-gray-500">(Optional)</span>
                          </label>
                          <select
                            id="address.state"
                            name="address.state"
                            value={formData.address.state}
                            onChange={(e) => handleStateChange(e.target.value)}
                            disabled={isFieldsDisabled}
                            className={`mt-1 block w-full py-2 px-3 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                              ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                              : validationErrors.address?.state ? 'border-red-500 bg-red-50' : 'border-blue-300'
                              }`}
                          >
                            <option value="">Select State</option>
                            {availableStates.map((state) => (
                              <option key={state} value={state}>
                                {state}
                              </option>
                            ))}
                          </select>
                          {!isFieldsDisabled && validationErrors.address?.state && (
                            <p className="mt-1 text-sm text-red-600">{validationErrors.address.state}</p>
                          )}
                        </div>
                        <div>
                          <label htmlFor="address.district" className={`block text-sm font-medium ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-700'}`}>
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
                                if (!isFieldsDisabled && formData.address.state) {
                                  setShowDistrictDropdown(true);
                                  handleDistrictSearch(districtSearchTerm);
                                }
                              }}
                              disabled={isFieldsDisabled || !formData.address.state}
                              className={`mt-1 block w-full py-2 px-3 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled || !formData.address.state
                                ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                                : validationErrors.address?.district ? 'border-red-500 bg-red-50' : 'border-blue-300'
                                }`}
                              placeholder={!formData.address.state ? 'Select State First' : 'Type to search districts...'}
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </div>
                            {showDistrictDropdown && !isFieldsDisabled && formData.address.state && (
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
                          {!isFieldsDisabled && validationErrors.address?.district && (
                            <p className="mt-1 text-sm text-red-600">{validationErrors.address.district}</p>
                          )}
                        </div>
                      </div>

                      {/* City (Optional) */}
                      <div className="mb-4">
                        <label htmlFor="address.city" className={`block text-sm font-medium ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-700'}`}>
                          City <span className="text-gray-500">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          id="address.city"
                          name="address.city"
                          value={formData.address.city}
                          onChange={handleChange}
                          disabled={isFieldsDisabled}
                          className={`mt-1 block w-full py-2 px-3 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                            ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                            : 'border-blue-300'
                            }`}
                          placeholder="Enter city name (optional)"
                        />
                        <p className={`mt-1 text-xs ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-600'}`}>City field is optional and can be left blank</p>
                      </div>

                      {/* Street Address / Landmark */}
                      <div className="mb-4">
                        <label htmlFor="address.line1" className={`block text-sm font-medium ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-700'}`}>
                          Street Address / Landmark <span className="text-gray-500">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          id="address.line1"
                          name="address.line1"
                          value={formData.address.line1}
                          onChange={handleChange}
                          disabled={isFieldsDisabled}
                          className={`mt-1 block w-full py-2 px-3 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                            ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                            : validationErrors.address?.line1 ? 'border-red-500 bg-red-50' : 'border-blue-300'
                            }`}
                          placeholder="Enter street address, building name, or landmark (optional)"
                        />
                      </div>

                      {/* PIN Code with Auto-fill */}
                      <div>
                        <label htmlFor="address.pincode" className={`block text-sm font-medium ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-700'}`}>
                          PIN Code <span className="text-gray-500">(Optional)</span>
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

                                // Trigger real-time validation
                                const pincodeError = validatePincodeRealTime(value);
                                setRealTimeErrors(prev => ({ ...prev, pincode: pincodeError }));

                                // Auto-fill if valid 6-digit pincode
                                if (value.length === 6) {
                                  handlePincodeAutoFill(value);
                                }
                              }
                            }}
                            onFocus={() => {
                              if (!isFieldsDisabled) {
                                setShowPincodeDropdown(true);
                                handlePincodeSearch(pincodeSearchTerm);
                              }
                            }}
                            maxLength={6}
                            disabled={isFieldsDisabled}
                            className={`mt-1 block w-full py-2 px-3 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                              ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                              : validationErrors.address?.pincode || realTimeErrors.pincode ? 'border-red-500 bg-red-50' :
                                realTimeErrors.pincode === null && formData.address.pincode.length === 6 && isValidIndianPinCode(formData.address.pincode) ? 'border-green-500 bg-green-50' : 'border-blue-300'
                              }`}
                            placeholder="Type to search pincodes..."
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                          {showPincodeDropdown && !isFieldsDisabled && filteredPincodes.length > 0 && (
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
                          {!isFieldsDisabled && isPincodeLoading && (
                            <div className="absolute right-3 top-3">
                              <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                          )}
                        </div>
                        {!isFieldsDisabled && realTimeErrors.pincode && (
                          <p className="mt-1 text-sm text-red-600">{realTimeErrors.pincode}</p>
                        )}
                        {!isFieldsDisabled && validationErrors.address?.pincode && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.address.pincode}</p>
                        )}
                        {!isFieldsDisabled && realTimeErrors.pincode === null && formData.address.pincode.length === 6 && isValidIndianPinCode(formData.address.pincode) && (
                          <p className="mt-1 text-sm text-green-600">✓ Valid Indian PIN code</p>
                        )}
                        {!isFieldsDisabled && realTimeErrors.pincode === null && formData.address.pincode.length === 6 && isValidIndianPinCode(formData.address.pincode) && !formData.address.state && (
                          <p className="mt-1 text-sm text-blue-600">📍 Please select State and District manually</p>
                        )}
                        <p className={`mt-1 text-xs ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-600'}`}>
                          Enter a valid PIN code to automatically fill State and District (optional field)
                        </p>
                      </div>
                      {isFieldsDisabled && (
                        <p className="mt-2 text-sm text-red-600">Please select a user category first to enable these fields.</p>
                      )}
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
                              Company Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              id="companyName"
                              name="companyName"
                              required
                              value={formData.companyName}
                              onChange={handleChange}
                              disabled={isFieldsDisabled}
                              className={`mt-1 block w-full py-2 px-3 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                                ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                                : validationErrors.companyName
                                  ? 'border-red-500 bg-red-50'
                                  : 'border-blue-300'
                                }`}
                            />
                            {validationErrors.companyName && (
                              <p className="mt-1 text-sm text-red-600">{validationErrors.companyName}</p>
                            )}
                          </div>

                          {/* Job Work fields - Different for vendors and admins */}
                          {formData.category === 'vendor' && (
                            <>
                              {/* Enhanced Vendor Job Work Dropdown - Editable */}
                              <div className="relative vendor-job-work-dropdown">
                                <label htmlFor="vendorJobWork" className="block text-sm font-medium text-blue-700 mb-2">
                                  Vendor Job Work <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  {/* Custom dropdown input with arrow */}
                                  <div
                                    onClick={() => !isFieldsDisabled && setShowVendorJobWorkDropdown(!showVendorJobWorkDropdown)}
                                    className={`mt-1 block w-full py-2 px-3 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                                      ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                                      : validationErrors.vendorJobWork
                                        ? 'border-red-500 bg-red-50'
                                        : 'bg-white cursor-pointer border-blue-300'
                                      }`}
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
                                  {showVendorJobWorkDropdown && !isFieldsDisabled && (
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
                                            <span
                                              onClick={() => {
                                                setFormData(prev => ({ ...prev, vendorJobWork: jobWork }));
                                                setShowVendorJobWorkDropdown(false);
                                              }}
                                              className="flex-1 cursor-pointer flex items-center"
                                            >
                                              {jobWork}
                                              {/* {isDefault && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                  Default
                                                </span>
                                              )} */}
                                            </span>
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
                                {validationErrors.vendorJobWork && (
                                  <p className="mt-1 text-sm text-red-600">{validationErrors.vendorJobWork}</p>
                                )}
                                <p className="mt-1 text-xs text-blue-600">
                                  Select the primary job work type for this vendor
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                  Default job works (marked with "Default" badge) cannot be edited or deleted
                                </p>
                              </div>
                            </>
                          )}

                          {formData.category === 'admin' && (
                            <>
                              {/* Admin Job Work - Auto-set to 'admin' */}
                              <div>
                                <label htmlFor="vendorJobWork" className="block text-sm font-medium text-blue-700 mb-2">
                                  Admin Job Work
                                </label>
                                <input
                                  type="text"
                                  id="vendorJobWork"
                                  name="vendorJobWork"
                                  value="admin"
                                  readOnly
                                  disabled={true}
                                  className="mt-1 block w-full py-2 px-3 border rounded-md shadow-sm bg-blue-50 border-blue-300 text-blue-700 cursor-not-allowed"
                                />
                                <p className="mt-1 text-xs text-blue-600">
                                  Job work is automatically set to "admin" for admin users
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
                                onClick={() => !isFieldsDisabled && setShowDesignationDropdown(!showDesignationDropdown)}
                                className={`mt-1 block w-full py-2 px-3 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                                  ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-white cursor-pointer border-blue-300'
                                  }`}
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
                              {showDesignationDropdown && !isFieldsDisabled && (
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

                    {/* Password (Optional) */}
                    <div className={`p-2 rounded-lg border ${isFieldsDisabled ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
                      <h3 className={`text-lg font-medium mb-4 flex items-center ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-800'}`}>
                        <Key className={`h-5 w-5 mr-2 ${isFieldsDisabled ? 'text-gray-400' : 'text-blue-600'}`} />
                        Password (Optional)
                      </h3>
                      <div>
                        <label htmlFor="password" className={`block text-sm font-medium ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-700'}`}>
                          Password (if left empty, phone number will be used)
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            disabled={isFieldsDisabled}
                            className={`mt-1 block w-full py-2 px-3 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${isFieldsDisabled
                              ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                              : 'border-blue-300'
                              }`}
                            placeholder="Leave blank to use phone number"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isFieldsDisabled}
                            className={`absolute inset-y-0 right-0 pr-3 flex items-center ${isFieldsDisabled
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-blue-500 hover:text-blue-700'
                              }`}
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                        <p className={`mt-1 text-xs ${isFieldsDisabled ? 'text-gray-500' : 'text-blue-600'}`}>
                          {formData.password ? 'Custom password set' : 'Phone number will be used as default password'}
                        </p>
                        {isFieldsDisabled && (
                          <p className="mt-2 text-sm text-red-600">Please select a user category first to enable this field.</p>
                        )}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting || isDesignationOperationInProgress}
                        className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating User...
                          </>
                        ) : isDesignationOperationInProgress ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing Designation...
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Save New User
                          </>
                        )}
                      </button>
                    </div>

                    {/* Success Message - Below Create User Button */}
                    {isUserCreated && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
                        <p className="font-medium">User created successfully!</p>
                        <p className="text-sm mt-1">The user has been added to the system and can now log in.</p>
                      </div>
                    )}

                    {/* Error Messages - Below Create User Button */}
                    {error && (
                      <div ref={errorMessageRef} className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                        <p className="font-medium">Please correct the following errors:</p>
                        <p className="text-sm mt-1">{error}</p>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            </div>

            {/* Recent Users Table - Moved below the form instead of being on the right */}
            <div className="mt-8">
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-blue-700 to-blue-600 py-4 px-6">
                  <div className="flex items-center text-white">
                    <div className="bg-white/10 p-2 rounded-full">
                      <Users className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-bold ml-3">Recently Added Users</h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-blue-200">
                    <thead className="bg-blue-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">SN</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">CODE</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">CATEGORY</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">NAME</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">EMAIL</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">PHONE</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">ADDRESS</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">STATE</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">DISTRICT</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">CITY</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">COMPANY NAME</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">JOB WORK</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">DESIGNATION</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-200">
                      {recentUsers.length > 0 ? (
                        recentUsers.map((user, index) => (
                          <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.userCode || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.role || user.category || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center">
                                {(user.profilePhotoUrl || user.photo) ? (
                                  <div className="h-8 w-8 rounded-full overflow-hidden mr-2 flex-shrink-0">
                                    <Image
                                      src={user.profilePhotoUrl || user.photo || ''}
                                      alt={`${user.firstName} ${user.surname}`}
                                      width={32}
                                      height={32}
                                      className="object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                                    <User className="h-4 w-4 text-blue-500" />
                                  </div>
                                )}
                                <span>{`${user.firstName} ${user.surname}`}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.phone}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {user.address ? user.address.line1 : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {user.address ? user.address.state : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {user.address ? user.address.district : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {user.address ? user.address.city : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.companyName || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {user.role === 'vendor' && user.vendorJobWork
                                ? user.vendorJobWork
                                : user.jobWork || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.designation || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => router.push(`/admin-dashboard/edit-user/${user.id}`)}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRecentUser(user.id)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete"
                                >
                                  <Trash className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handlePrintRecentUser(user)}
                                  className="text-gray-600 hover:text-gray-900"
                                  title="Print"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center" colSpan={14}>
                            No recently added users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
              <h3 className="text-lg font-medium text-gray-900">Add New Job Work</h3>
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
              <h3 className="text-lg font-medium text-gray-900">Edit Job Work</h3>
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
