import React, { useState, useEffect, useRef } from 'react';
import { Bell, CreditCard, FileText, CheckCircle, X, Trash2, Check } from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, Timestamp, writeBatch, limit, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Toast } from '../shared/Toast';
import { notificationService } from '../../utils/notificationService';

// Define Notification type inline (copy from NotificationBell.tsx):
type Notification = {
  id: string;
  userId?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  voucherId?: string;
  paymentId?: string;
  type?: 'payment' | 'completion_request' | 'system' | 'voucher_received' | 'voucher_assignment' | 'voucher_completion';
  amountPaid?: number;
  voucherNo?: string;
};

interface VendorNotificationBellProps {
  vendorUserId: string;
  iconColor?: string;
}

export function VendorNotificationBell({ vendorUserId, iconColor = 'text-white' }: VendorNotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [deletingNotifications, setDeletingNotifications] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; isVisible: boolean }>({
    message: '',
    type: 'success',
    isVisible: false
  });
  const router = useRouter();
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!vendorUserId) return;

    // Create a query against the vendor notifications collection
    const vendorNotificationsRef = collection(db, 'vendorNotifications');
    const q = query(
      vendorNotificationsRef,
      where('vendorUserId', '==', vendorUserId),
      orderBy('createdAt', 'desc'),
      limit(20) // Limit to 20 most recent notifications
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsList: Notification[] = [];
      snapshot.forEach((doc) => {
        notificationsList.push({ id: doc.id, ...doc.data() } as Notification);
      });
      console.log('Vendor notifications updated:', notificationsList);
      setNotifications(notificationsList);
    }, (error) => {
      console.error("Error fetching vendor notifications:", error);
    });

    // Clean up listener
    return () => unsubscribe();
  }, [vendorUserId]);

  // Auto-close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const toggleNotifications = () => {
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = async (notification: Notification, event: React.MouseEvent) => {
    // Prevent click if clicking on delete button
    if ((event.target as HTMLElement).closest('.delete-button')) {
      return;
    }

    try {
      // Mark as read
      const notificationRef = doc(db, 'vendorNotifications', notification.id);
      await updateDoc(notificationRef, {
        read: true
      });

      // Navigate based on notification type
      if (notification.type === 'payment') {
        // Redirect to Accounts section in vendor profile
        router.push('/vendor/my-profile');
        // Set the active tab to 'account'
        window.localStorage.setItem('activeProfileTab', 'account');
      } else if (notification.type === 'voucher_assignment' || notification.type === 'voucher_completion') {
        // Redirect to Receive Report - simple navigation without parameters
        router.push('/vendor/receive-report');
      }

      setIsOpen(false);
    } catch (error) {
      console.error("Error updating vendor notification:", error);
    }
  };

  const deleteNotification = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    try {
      setDeletingNotifications(prev => new Set(prev).add(notificationId));

      // Add fade-out animation delay
      setTimeout(async () => {
        const success = await notificationService.deleteVendorNotification(notificationId);

        setDeletingNotifications(prev => {
          const newSet = new Set(prev);
          newSet.delete(notificationId);
          return newSet;
        });

        if (success) {
          showToast('Notification deleted successfully', 'success');
        } else {
          showToast('Failed to delete notification', 'error');
        }
      }, 300);
    } catch (error) {
      console.error("Error deleting vendor notification:", error);
      setDeletingNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
      showToast('Failed to delete notification', 'error');
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, 'vendorNotifications', notification.id);
        batch.update(notificationRef, { read: true });
      });

      await batch.commit();
      showToast(`${unreadNotifications.length} notifications marked as read`, 'success');
      console.log('All vendor notifications marked as read');
    } catch (error) {
      console.error("Error marking all vendor notifications as read:", error);
      showToast('Failed to mark notifications as read', 'error');
    }
  };

  const deleteAllNotifications = async () => {
    if (notifications.length === 0) return;

    try {
      const success = await notificationService.deleteAllVendorNotifications(vendorUserId);

      if (success) {
        showToast(`${notifications.length} notifications deleted successfully`, 'success');
        setIsOpen(false);
      } else {
        showToast('Failed to delete notifications', 'error');
      }
    } catch (error) {
      console.error("Error deleting all vendor notifications:", error);
      showToast('Failed to delete notifications', 'error');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatDate = (timestamp: any) => {
    try {
      let date: Date;

      if (timestamp?.toDate) {
        date = timestamp.toDate();
      } else if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else {
        return 'Just now';
      }

      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

      if (diffInMinutes < 1) {
        return 'Just now';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
      } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours}h ago`;
      } else {
        return date.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (e) {
      console.error("Error formatting date:", e, "Timestamp:", timestamp);
      return 'Just now';
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (notification: Notification) => {
    if (notification.type === 'payment') {
      return <CreditCard className="h-5 w-5 text-green-600" />;
    } else if (notification.type === 'voucher_assignment') {
      return <FileText className="h-5 w-5 text-blue-600" />;
    } else if (notification.type === 'voucher_completion') {
      return <CheckCircle className="h-5 w-5 text-purple-600" />;
    } else {
      return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  // Sort notifications: unread first, then by createdAt date
  const sortedNotifications = [...notifications].sort((a, b) => {
    // First sort by read status (unread first)
    if (a.read !== b.read) {
      return a.read ? 1 : -1;
    }

    // Then sort by timestamp (newest first)
    try {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt?.seconds * 1000) || new Date(a.createdAt);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt?.seconds * 1000) || new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    } catch (e) {
      console.error("Error comparing dates:", e);
      return 0;
    }
  });

  // Split notifications into payment and non-payment
  const paymentNotifications = notifications.filter(n => n.type === 'payment');
  const nonPaymentNotifications = notifications.filter(n => n.type !== 'payment');

  // Group only non-payment notifications by voucherNo
  const groupedNonPaymentNotifications = nonPaymentNotifications.reduce((acc, notification) => {
    const key = notification.voucherNo || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(notification);
    return acc;
  }, {} as Record<string, Notification[]>);

  // Convert payment notifications to individual groups (each payment is its own group)
  const paymentGroups = paymentNotifications.map(notification => {
    return [`payment-${notification.id}`, [notification]] as [string, Notification[]];
  });

  // Combine payment groups and non-payment groups
  const allGroups = [
    ...paymentGroups,
    ...Object.entries(groupedNonPaymentNotifications)
  ];

  // Sort all groups by most recent notification in each group
  const sortedGroups = allGroups.sort((a, b) => {
    const aLatest = a[1][0]?.createdAt?.toDate?.() || new Date(a[1][0]?.createdAt?.seconds * 1000) || new Date(a[1][0]?.createdAt);
    const bLatest = b[1][0]?.createdAt?.toDate?.() || new Date(b[1][0]?.createdAt?.seconds * 1000) || new Date(b[1][0]?.createdAt);
    return bLatest.getTime() - aLatest.getTime();
  });

  return (
    <>
      <div className="relative" ref={notificationRef}>
        <button
          onClick={toggleNotifications}
          className={`relative p-2 ${iconColor} hover:opacity-80 transition-colors`}
          aria-label={`Vendor Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-5 w-5 flex items-center justify-center bg-red-500 text-white text-xs rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="fixed left-2 right-2 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-auto sm:mt-2 w-auto sm:w-80 bg-white rounded-md shadow-lg z-[9999] border border-blue-100">
            <div className="p-3 bg-blue-600 text-white font-medium rounded-t-md flex justify-between items-center">
              <span>Notifications</span>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs flex items-center bg-blue-500 hover:bg-blue-400 px-2 py-1 rounded transition-colors"
                    title="Mark all as read"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={deleteAllNotifications}
                    className="text-xs flex items-center bg-red-500 hover:bg-red-400 px-2 py-1 rounded transition-colors"
                    title="Mark all as read"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear all
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto">
              {sortedGroups.length > 0 ? (
                <div className="divide-y divide-blue-100">
                  {sortedGroups.map(([voucherNo, group]) => {
                    const latest = (group as Notification[])[0];
                    return (
                      <div
                        key={voucherNo}
                        onClick={e => handleNotificationClick(latest, e)}
                        className={`p-4 cursor-pointer hover:bg-blue-50 transition-all duration-300 ${latest.read ? 'bg-white' : 'bg-blue-50'
                          }`}
                      >
                        <div className="flex items-start">
                          <div className="mr-3 mt-1">
                            {getNotificationIcon(latest)}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-blue-800">{latest.title}</h3>
                            <p className="text-sm text-gray-600">{latest.message}</p>
                            {latest.voucherNo && (
                              <div className="mt-1 text-xs text-blue-600">
                                Voucher: {latest.voucherNo} {(group as Notification[]).length > 1 && latest.type !== 'payment' && <span className="ml-2 text-xs text-gray-500">({(group as Notification[]).length} updates)</span>}
                              </div>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(latest.createdAt)}
                            </p>
                          </div>
                          <button
                            onClick={e => deleteNotification(latest.id, e)}
                            className="delete-button ml-2 p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            title={latest.type === 'payment' ? "Delete payment notification" : "Delete notification group"}
                            disabled={deletingNotifications.has(latest.id)}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">No notifications</div>
              )}
            </div>
          </div>
        )}
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </>
  );
}
