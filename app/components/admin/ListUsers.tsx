'use client';

import { useState, useEffect } from 'react';
import { Edit, Trash, Printer, Download, Search, ArrowUpDown, RefreshCw, FileText, Filter, Lock, Bell, X, Eye, EyeOff, Users, UserCheck, Shield, Key, Menu } from 'lucide-react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, Timestamp, updateDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db, getPasswordChangeRequests, resolvePasswordChangeRequest, getCurrentUser } from '@/config/firebase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Toast } from '../shared/Toast';

interface UserData {
  id: string;
  userCode: string;
  firstName: string;
  vendorJobWork?: string;
  surname: string;
  role: string;
  category: string;
  jobWork?: string;
  designation?: string;
  phone: string;
  address?: {
    line1: string;
    city: string;
    district: string;
    state: string;
    country: string;
    pincode: string;
  };
  email: string;
  companyName: string;
  photo?: string | null;
  status?: string;
  createdAt?: any;
  profilePhotoUrl?: string;
}

interface PasswordChangeRequest {
  id: string;
  userId: string;
  userPhone: string;
  userName: string;
  userEmail: string;
  requestType: string;
  status: 'pending' | 'resolved';
  createdAt: string;
  updatedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

type TabType = 'all' | 'vendors' | 'admins' | 'requests' | 'settings';

export default function ListUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof UserData>('userCode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password change requests state
  const [passwordRequests, setPasswordRequests] = useState<PasswordChangeRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [clearingRequests, setClearingRequests] = useState(false);
  const [showDeleteAllConfirmation, setShowDeleteAllConfirmation] = useState(false);
  const [deletingAllUsers, setDeletingAllUsers] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });

  // Toast helper functions
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  useEffect(() => {
    fetchUsers();
    getCurrentAdmin();

    // Set up real-time listener for password change requests
    const passwordRequestsQuery = query(
      collection(db, 'passwordChangeRequests'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(passwordRequestsQuery, (snapshot) => {
      const requests = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ?
            data.createdAt.toDate().toISOString() :
            data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ?
            data.updatedAt.toDate().toISOString() :
            data.updatedAt,
          resolvedAt: data.resolvedAt instanceof Timestamp ?
            data.resolvedAt.toDate().toISOString() :
            data.resolvedAt
        } as PasswordChangeRequest;
      });
      setPasswordRequests(requests);
      setRequestsLoading(false);
      setIsRealtimeActive(true);
    }, (error) => {
      console.error('Error listening to password requests:', error);
      setRequestsLoading(false);
      setIsRealtimeActive(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const getCurrentAdmin = async () => {
    try {
      const admin = await getCurrentUser();
      setCurrentAdmin(admin);
    } catch (error) {
      console.error('Error getting current admin:', error);
    }
  };

  const fetchPasswordRequests = async () => {
    try {
      setRequestsLoading(true);
      const requests = await getPasswordChangeRequests();
      setPasswordRequests(requests);
    } catch (error) {
      console.error('Error fetching password requests:', error);
    } finally {
      setRequestsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersCollection = collection(db, 'users');
      const usersQuery = query(usersCollection, orderBy('createdAt', 'desc'));
      const usersSnapshot = await getDocs(usersQuery);

      const usersList = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt instanceof Timestamp ?
            data.createdAt.toDate().toISOString() :
            data.createdAt
        } as UserData;
      });

      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof UserData) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        fetchUsers(); // Refresh the list
        showToast('User deleted successfully!', 'success');
      } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user. Please try again.', 'error');
      }
    }
  };

  const handleEdit = (userId: string) => {
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

  const handlePrintAllUsers = () => {
    const doc = new jsPDF('landscape');

    // Add header
    doc.setFontSize(18);
    doc.text('All Users Report', 148, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 148, 22, { align: 'center' });

    // Create table with all users - landscape layout for better readability
    autoTable(doc, {
      startY: 30,
      head: [['SN', 'Code', 'Category', 'Name', 'Email', 'Phone', 'State', 'District', 'City', 'Address', 'Company', 'Job Work', 'Designation']],
      body: users.map((user, index) => [
        (index + 1).toString(),
        user.userCode || 'N/A',
        user.category || user.role || 'N/A',
        `${user.firstName} ${user.surname}`,
        user.email,
        user.phone || 'N/A',
        user.address ? user.address.state : 'N/A',
        user.address ? user.address.district : 'N/A',
        user.address ? user.address.city : 'N/A',
        user.address ? user.address.line1 : 'N/A',
        user.companyName || 'N/A',
        user.vendorJobWork || user.jobWork || 'N/A',
        user.designation || 'N/A'
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontSize: 8,
        cellPadding: 2
      },
      alternateRowStyles: { fillColor: [240, 245, 255] },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 12 },  // SN
        1: { cellWidth: 26 },  // Code
        2: { cellWidth: 16 },  // Category
        3: { cellWidth: 22 },  // Name
        4: { cellWidth: 28 },  // Email
        5: { cellWidth: 20 },  // Phone
        6: { cellWidth: 20 },  // State
        7: { cellWidth: 20 },  // District
        8: { cellWidth: 20 },  // City
        9: { cellWidth: 30 },  // Address
        10: { cellWidth: 20 }, // Company
        11: { cellWidth: 22 }, // Job Work
        12: { cellWidth: 20 }  // Designation
      },
      didDrawPage: function (data) {
        // Add page number
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
      },
      margin: { top: 30, right: 10, bottom: 20, left: 10 },
      pageBreak: 'auto',
      showFoot: 'lastPage'
    });

    // Add footer with summary on the last page
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);

    doc.save('all-users-report.pdf');
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;

    // Validate passwords
    if (!newPassword.trim()) {
      setPasswordError('Password is required');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      setPasswordLoading(true);
      setPasswordError('');

      // Update user password in Firestore
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        password: newPassword,
        isFirstLogin: false,
        requiresPasswordChange: false
      });

      // Close modal and reset state
      setShowPasswordModal(false);
      setSelectedUser(null);
      setNewPassword('');
      setConfirmPassword('');

      // Show success message
      showToast(`Password updated successfully for ${selectedUser.firstName} ${selectedUser.surname}`, 'success');

      // Refresh user list
      fetchUsers();
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordError('Failed to update password. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const openPasswordModal = (user: UserData) => {
    setSelectedUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setSelectedUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleResolveRequest = async (requestId: string) => {
    if (!currentAdmin) {
      showToast('Admin session not found. Please login again.', 'error');
      return;
    }

    try {
      await resolvePasswordChangeRequest(requestId, currentAdmin.uid);
      // No need to manually refresh as the real-time listener will handle it
      showToast('Password change request resolved successfully!', 'success');
    } catch (error: any) {
      console.error('Error resolving request:', error);
      showToast(error.message || 'Failed to resolve request. Please try again.', 'error');
    }
  };

  const handleClearResolvedRequests = async () => {
    if (!currentAdmin) {
      showToast('Admin session not found. Please login again.', 'error');
      return;
    }

    try {
      setClearingRequests(true);

      // Get all resolved requests
      const resolvedRequests = passwordRequests.filter(req => req.status === 'resolved');

      if (resolvedRequests.length === 0) {
        showToast('No resolved requests to clear.', 'error');
        return;
      }

      // Use batch write to delete all resolved requests
      const batch = writeBatch(db);

      resolvedRequests.forEach(request => {
        const requestRef = doc(db, 'passwordChangeRequests', request.id);
        batch.delete(requestRef);
      });

      await batch.commit();

      showToast(`Successfully cleared ${resolvedRequests.length} resolved request(s).`, 'success');
      setShowClearConfirmation(false);
    } catch (error: any) {
      console.error('Error clearing resolved requests:', error);
      showToast('Failed to clear resolved requests. Please try again.', 'error');
    } finally {
      setClearingRequests(false);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!currentAdmin) {
      showToast('Admin session not found. Please login again.', 'error');
      return;
    }

    try {
      const requestRef = doc(db, 'passwordChangeRequests', requestId);
      await deleteDoc(requestRef);
      showToast('Password change request deleted successfully!', 'success');
      fetchPasswordRequests(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting request:', error);
      showToast(error.message || 'Failed to delete request. Please try again.', 'error');
    }
  };

  const handleDeleteAllUsers = async () => {
    if (!currentAdmin) {
      showToast('Admin session not found. Please login again.', 'error');
      return;
    }

    try {
      setDeletingAllUsers(true);

      // Filter out the protected user (phone number 9876543210)
      const usersToDelete = users.filter(user => user.phone !== '9876543210');

      if (usersToDelete.length === 0) {
        showToast('No users to delete.', 'error');
        return;
      }

      // Use batch write to delete all users except the protected one
      const batch = writeBatch(db);

      usersToDelete.forEach(user => {
        const userRef = doc(db, 'users', user.id);
        batch.delete(userRef);
      });

      await batch.commit();

      showToast(`Successfully deleted ${usersToDelete.length} user(s). The user with phone number 9876543210 was protected and not deleted.`, 'success');
      setShowDeleteAllConfirmation(false);

      // Refresh the user list
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting all users:', error);
      showToast('Failed to delete users. Please try again.', 'error');
    } finally {
      setDeletingAllUsers(false);
    }
  };

  // Filter users based on active tab and search term
  const getFilteredUsers = () => {
    let filtered = users;

    // Apply tab filter
    switch (activeTab) {
      case 'vendors':
        filtered = users.filter(user =>
          (user.role?.toLowerCase() === 'vendor' || user.category?.toLowerCase() === 'vendor')
        );
        break;
      case 'admins':
        filtered = users.filter(user =>
          (user.role?.toLowerCase() === 'admin' || user.category?.toLowerCase() === 'admin')
        );
        break;
      case 'all':
      default:
        filtered = users;
        break;
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(user => {
        // Enhanced search across all user fields
        return (
          // Basic user info
          (user.firstName?.toLowerCase().includes(searchLower) || false) ||
          (user.surname?.toLowerCase().includes(searchLower) || false) ||
          (user.userCode?.toLowerCase().includes(searchLower) || false) ||
          (user.email?.toLowerCase().includes(searchLower) || false) ||
          (user.phone?.toLowerCase().includes(searchLower) || false) ||
          (user.role?.toLowerCase().includes(searchLower) || false) ||
          (user.category?.toLowerCase().includes(searchLower) || false) ||
          (user.designation?.toLowerCase().includes(searchLower) || false) ||
          (user.status?.toLowerCase().includes(searchLower) || false) ||

          // Company and job details
          (user.companyName?.toLowerCase().includes(searchLower) || false) ||
          (user.vendorJobWork?.toLowerCase().includes(searchLower) || false) ||
          (user.jobWork?.toLowerCase().includes(searchLower) || false) ||

          // Address details
          (user.address?.line1?.toLowerCase().includes(searchLower) || false) ||
          (user.address?.city?.toLowerCase().includes(searchLower) || false) ||
          (user.address?.district?.toLowerCase().includes(searchLower) || false) ||
          (user.address?.state?.toLowerCase().includes(searchLower) || false) ||
          (user.address?.country?.toLowerCase().includes(searchLower) || false) ||
          (user.address?.pincode?.toLowerCase().includes(searchLower) || false) ||

          // Search in any other string fields
          Object.values(user).some(val =>
            typeof val === 'string' && val.toLowerCase().includes(searchLower)
          )
        );
      });
    }

    return filtered;
  };

  // Sort users
  const sortedUsers = [...getFilteredUsers()].sort((a, b) => {
    const aValue = a[sortField]?.toString() || '';
    const bValue = b[sortField]?.toString() || '';

    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  // Get counts for each tab
  const getTabCounts = () => {
    const allUsers = users.length;
    const vendors = users.filter(user =>
      (user.role?.toLowerCase() === 'vendor' || user.category?.toLowerCase() === 'vendor')
    ).length;
    const admins = users.filter(user =>
      (user.role?.toLowerCase() === 'admin' || user.category?.toLowerCase() === 'admin')
    ).length;
    const pendingRequests = passwordRequests.filter(req => req.status === 'pending').length;

    return { allUsers, vendors, admins, pendingRequests };
  };

  const tabCounts = getTabCounts();

  const renderTabContent = () => {
    if (activeTab === 'settings') {
      return (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Danger Zone</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-red-800">Delete All Users</h4>
                  <p className="text-sm text-red-600 mt-1">
                    This will permanently delete all users except the Master Admin.
                    This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteAllConfirmation(true)}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={deletingAllUsers}
                >
                  {deletingAllUsers ? 'Deleting...' : 'Delete All Users'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'requests') {
      return (
        <div className="space-y-4">
          {/* Real-time indicator and clear button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            {/* {isRealtimeActive && (
              <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-700 font-medium">Live Updates Active</span>
              </div>
            )} */}

            {/* Clear resolved requests button */}
            {passwordRequests.filter(req => req.status === 'resolved').length > 0 && (
              <button
                onClick={() => setShowClearConfirmation(true)}
                className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                disabled={clearingRequests}
              >
                <Trash className="h-4 w-4" />
                <span>Clear Resolved ({passwordRequests.filter(req => req.status === 'resolved').length})</span>
              </button>
            )}
          </div>

          {requestsLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : passwordRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No password change requests found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {passwordRequests.map((request) => (
                <div
                  key={request.id}
                  className={`p-4 rounded-lg border ${request.status === 'pending'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-green-50 border-green-200'
                    }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900">
                          {request.userName}
                        </h4>
                        <span
                          className={`px-2 py-1 text-xs rounded-full w-fit ${request.status === 'pending'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-green-100 text-green-800'
                            }`}
                        >
                          {request.status === 'pending' ? 'Pending' : 'Resolved'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p><strong>Phone:</strong> {request.userPhone}</p>
                        <p><strong>Email:</strong> {request.userEmail}</p>
                        <p><strong>Requested:</strong> {new Date(request.createdAt).toLocaleString()}</p>
                        {request.resolvedAt && (
                          <p><strong>Resolved:</strong> {new Date(request.resolvedAt).toLocaleString()}</p>
                        )}
                      </div>
                      {request.status === 'pending' && (
                        <div className="flex flex-col sm:flex-row gap-2 mt-3">
                          <button
                            onClick={() => handleResolveRequest(request.id)}
                            className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                          >
                            Resolved
                          </button>
                          <button
                            onClick={() => {
                              const user = users.find(u => u.phone === request.userPhone);
                              if (user) {
                                setSelectedUser(user);
                                setShowPasswordModal(true);
                              } else {
                                showToast('User not found in current list. Please refresh and try again.', 'error');
                              }
                            }}
                            className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                          >
                            Change Password
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteRequest(request.id)}
                      className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                      title="Delete Request"
                    >
                      <Trash className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // User table for all other tabs
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (sortedUsers.length === 0) {
      return (
        <div className="bg-blue-50 rounded-lg p-8 sm:p-12 text-center">
          <div className="flex flex-col items-center justify-center">
            <h3 className="text-lg sm:text-xl font-medium text-blue-800 mb-2">No users found</h3>
            {searchTerm ? (
              <p className="text-blue-600 mb-6">Try adjusting your search criteria</p>
            ) : (
              <p className="text-blue-600 mb-6">Add your first user to get started</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Mobile Card View */}
        <div className="block md:hidden space-y-4">
          {sortedUsers.map((user, index) => (
            <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {(user.profilePhotoUrl || user.photo) ? (
                    <div className="h-12 w-12 rounded-full overflow-hidden relative">
                      <Image
                        src={user.profilePhotoUrl || user.photo || ''}
                        alt={user.firstName}
                        width={48}
                        height={48}
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-blue-200 flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-sm">
                        {user.firstName.charAt(0)}{user.surname.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-gray-900">{`${user.firstName} ${user.surname}`}</h3>
                    <p className="text-sm text-gray-500">{user.userCode || 'N/A'}</p>
                    <p className="text-xs text-gray-400">{user.category || user.role || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(user.id)}
                    className="p-1 text-blue-600 hover:text-blue-900"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openPasswordModal(user)}
                    className="p-1 text-purple-600 hover:text-purple-900"
                    title="Change Password"
                  >
                    <Lock className="h-4 w-4" />
                  </button>
                  {user.phone !== '9876543210' && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-1 text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Email:</span>
                  <p className="text-gray-900 truncate">{user.email}</p>
                </div>
                <div>
                  <span className="text-gray-500">Phone:</span>
                  <p className="text-gray-900">{user.phone || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Company:</span>
                  <p className="text-gray-900 truncate">{user.companyName || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Job Work:</span>
                  <p className="text-gray-900 truncate">{user.vendorJobWork || user.jobWork || 'N/A'}</p>
                </div>
                {user.address && (
                  <>
                    <div className="col-span-2">
                      <span className="text-gray-500">Address:</span>
                      <p className="text-gray-900 text-xs">{user.address.line1}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">City:</span>
                      <p className="text-gray-900 text-xs">{user.address.city}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">State:</span>
                      <p className="text-gray-900 text-xs">{user.address.state}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-blue-200">
            <thead className="bg-blue-50">
              <tr>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  SN
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  <button onClick={() => handleSort('userCode')} className="flex items-center">
                    CODE <ArrowUpDown className="h-3 w-3 ml-1" />
                  </button>
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  <button onClick={() => handleSort('category')} className="flex items-center">
                    CATEGORY <ArrowUpDown className="h-3 w-3 ml-1" />
                  </button>
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  <button onClick={() => handleSort('firstName')} className="flex items-center">
                    NAME <ArrowUpDown className="h-3 w-3 ml-1" />
                  </button>
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  <button onClick={() => handleSort('email')} className="flex items-center">
                    EMAIL <ArrowUpDown className="h-3 w-3 ml-1" />
                  </button>
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  <button onClick={() => handleSort('phone')} className="flex items-center">
                    PHONE <ArrowUpDown className="h-3 w-3 ml-1" />
                  </button>
                </th>
                <th scope="col" className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  ADDRESS
                </th>
                <th scope="col" className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  STATE
                </th>
                <th scope="col" className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  DISTRICT
                </th>
                <th scope="col" className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  CITY
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  <button onClick={() => handleSort('companyName')} className="flex items-center">
                    COMPANY <ArrowUpDown className="h-3 w-3 ml-1" />
                  </button>
                </th>
                <th scope="col" className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  JOB WORK
                </th>
                <th scope="col" className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  <button onClick={() => handleSort('designation')} className="flex items-center">
                    DESIGNATION <ArrowUpDown className="h-3 w-3 ml-1" />
                  </button>
                </th>
                <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-blue-200">
              {sortedUsers.map((user, index) => (
                <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.userCode || 'N/A'}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.category || user.role || 'N/A'}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      {(user.profilePhotoUrl || user.photo) ? (
                        <div className="h-8 w-8 mr-3 rounded-full overflow-hidden relative">
                          <Image
                            src={user.profilePhotoUrl || user.photo || ''}
                            alt={user.firstName}
                            width={32}
                            height={32}
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-8 w-8 mr-3 rounded-full bg-blue-200 flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-xs">
                            {user.firstName.charAt(0)}{user.surname.charAt(0)}
                          </span>
                        </div>
                      )}
                      <span className="truncate max-w-24 sm:max-w-none">{`${user.firstName} ${user.surname}`}</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="truncate max-w-20 sm:max-w-none block">{user.email}</span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.phone || 'N/A'}</td>
                  <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.address ? user.address.line1 : 'N/A'}
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.address ? user.address.state : 'N/A'}
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.address ? user.address.district : 'N/A'}
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.address ? user.address.city : 'N/A'}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="truncate max-w-20 sm:max-w-none block">{user.companyName || 'N/A'}</span>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="truncate max-w-20 block">{user.vendorJobWork || user.jobWork || 'N/A'}</span>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.designation || 'N/A'}</td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-1 sm:space-x-2">
                      <button
                        onClick={() => handleEdit(user.id)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openPasswordModal(user)}
                        className="text-purple-600 hover:text-purple-900 p-1"
                        title="Change Password"
                      >
                        <Lock className="h-4 w-4" />
                      </button>
                      {user.phone !== '9876543210' && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handlePrintUser(user)}
                        className="text-gray-600 hover:text-gray-900 p-1"
                        title="Print"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-blue-800 mb-2">User Management</h1>
            <p className="text-sm sm:text-base text-gray-600">Monitor and manage all system users and password requests.</p>
          </div>

          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <button
              onClick={handlePrintAllUsers}
              className="flex-1 sm:flex-none bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center text-sm"
            >
              <Printer className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Print All</span>
              <span className="sm:hidden">Print</span>
            </button>
            <button
              onClick={() => router.push('/admin-dashboard/vendor-kyc')}
              className="flex-1 sm:flex-none bg-green-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center text-sm"
            >
              <FileText className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">KYC List</span>
              <span className="sm:hidden">KYC</span>
            </button>
            <button
              onClick={() => {
                fetchUsers();
                // Password requests are now real-time, so no need to manually refresh
              }}
              className="flex-1 sm:flex-none bg-blue-100 text-blue-700 px-3 sm:px-4 py-2 rounded-md hover:bg-blue-200 transition-colors flex items-center justify-center text-sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Refresh Users</span>
              <span className="sm:hidden">Refresh</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Selector */}
        <div className="lg:hidden mb-4">
          <div className="relative">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as TabType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="all">👥 All Users ({tabCounts.allUsers})</option>
              <option value="vendors">👤 Vendors ({tabCounts.vendors})</option>
              <option value="admins">🛡️ Admins ({tabCounts.admins})</option>
              <option value="requests">🔑 Password Requests ({tabCounts.pendingRequests})</option>
              <option value="settings">⚙️ Settings</option>
            </select>
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden lg:block border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Users className="h-4 w-4 mr-2" />
              All Users
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs font-medium">
                {tabCounts.allUsers}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('vendors')}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'vendors'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Vendors
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs font-medium">
                {tabCounts.vendors}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'admins'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Shield className="h-4 w-4 mr-2" />
              Admins
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs font-medium">
                {tabCounts.admins}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'requests'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Key className="h-4 w-4 mr-2" />
              Password Requests
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs font-medium">
                {tabCounts.pendingRequests}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'settings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Menu className="h-4 w-4 mr-2" />
              Settings
            </button>
          </nav>
        </div>

        {/* Search and Filter Bar */}
        {activeTab !== 'requests' && activeTab !== 'settings' && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, phone, or company..."
                className="pl-10 block w-full rounded-md border border-gray-300 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center sm:justify-start">
              Showing {sortedUsers.length} of {getFilteredUsers().length} users
            </div>
          </div>
        )}

        {/* Tab Content */}
        {renderTabContent()}

        {/* Password Change Modal */}
        {showPasswordModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Change Password for {selectedUser.firstName} {selectedUser.surname}
                </h3>
                <button
                  onClick={closePasswordModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Enter new password"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Confirm new password"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                    {passwordError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                  <button
                    onClick={closePasswordModal}
                    className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors text-sm"
                    disabled={passwordLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePassword}
                    disabled={passwordLoading}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                  >
                    {passwordLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete All Users Confirmation Modal */}
        {showDeleteAllConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete All Users
                </h3>
                <button
                  onClick={() => setShowDeleteAllConfirmation(false)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={deletingAllUsers}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash className="h-4 w-4 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      Are you sure you want to delete all users?
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      This action will permanently delete all users from the system except the Master Admin.
                      Once deleted, these users cannot be recovered.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Warning:</strong> This action is irreversible.
                        {users.filter(user => user.phone !== '9876543210').length} user(s) will be permanently deleted.
                      </p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 mt-3">
                      <p className="text-sm text-green-800">
                        <strong>Protected:</strong> The user with phone number 9876543210 will not be deleted.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => setShowDeleteAllConfirmation(false)}
                  className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors text-sm"
                  disabled={deletingAllUsers}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAllUsers}
                  disabled={deletingAllUsers}
                  className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                >
                  {deletingAllUsers ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete All Users'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Resolved Requests Confirmation Modal */}
        {showClearConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Clear Resolved Requests
                </h3>
                <button
                  onClick={() => setShowClearConfirmation(false)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={clearingRequests}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash className="h-4 w-4 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      Are you sure you want to clear all resolved requests?
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      This action will permanently delete all resolved password change requests from the system.
                      Once cleared, these requests cannot be recovered or viewed again.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Warning:</strong> This action is irreversible.
                        {passwordRequests.filter(req => req.status === 'resolved').length} resolved request(s) will be permanently deleted.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => setShowClearConfirmation(false)}
                  className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors text-sm"
                  disabled={clearingRequests}
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearResolvedRequests}
                  disabled={clearingRequests}
                  className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                >
                  {clearingRequests ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Clearing...
                    </>
                  ) : (
                    'Clear All Resolved'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={5000}
      />
    </div>
  );
}
