import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CreditCard, ClipboardCheck, X, Trash2 } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, Timestamp, writeBatch, limit, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Toast } from './Toast';
import { getCurrentUser } from '@/config/firebase';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Timestamp | any;
  voucherId?: string;
  paymentId?: string;
  type?: 'payment' | 'completion_request' | 'system' | 'voucher_received';
  amountPaid?: number;
  voucherNo?: string; // Added for grouping
}

interface NotificationBellProps {
  userId: string;
  iconColor?: string;
}

export function NotificationBell({ userId, iconColor = 'text-white' }: NotificationBellProps) {
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
    if (!userId) return;

    // Create a query against the notifications collection
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(30) // Limit to 30 most recent notifications
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsList: Notification[] = [];
      snapshot.forEach((doc) => {
        notificationsList.push({ id: doc.id, ...doc.data() } as Notification);
      });
      console.log('Notifications updated:', notificationsList);
      setNotifications(notificationsList);
    }, (error) => {
      console.error("Error fetching notifications:", error);
    });

    // Clean up listener
    return () => unsubscribe();
  }, [userId]);

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
      const notificationRef = doc(db, 'notifications', notification.id);
      await updateDoc(notificationRef, {
        read: true
      });

      // Get current user to determine routing
      const currentUser = await getCurrentUser();
      const isVendor = currentUser?.role === 'vendor';

      // Navigate based on notification type and user role
      if (notification.type === 'completion_request' && notification.voucherId) {
        router.push(`/admin-dashboard?tab=Completion Requests`);
      } else if (notification.type === 'payment' && notification.voucherId) {
        // For vendors seeing payment notifications
        router.push(`/vendor/my-profile`);
        // Set the active tab to 'account' - you would need to store this in localStorage or URL params
        window.localStorage.setItem('activeProfileTab', 'account');
      } else if (notification.voucherId) {
        if (isVendor) {
          // For vendors: route to their receive report page with the specific voucher
          router.push(`/vendor/receive-report?voucherId=${notification.voucherId}`);
        } else {
          // For admins: route to All Vouchers with voucher details view
          router.push(`/admin-dashboard?tab=All%20Vouchers&viewMode=details&voucherId=${notification.voucherId}`);
        }
      }

      setIsOpen(false);
    } catch (error) {
      console.error("Error updating notification:", error);
    }
  };

  const deleteNotification = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    try {
      setDeletingNotifications(prev => new Set(prev).add(notificationId));

      // Add fade-out animation delay
      setTimeout(async () => {
        await deleteDoc(doc(db, 'notifications', notificationId));
        setDeletingNotifications(prev => {
          const newSet = new Set(prev);
          newSet.delete(notificationId);
          return newSet;
        });
        showToast('Notification deleted successfully', 'success');
      }, 300);
    } catch (error) {
      console.error("Error deleting notification:", error);
      setDeletingNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
      showToast('Failed to delete notification', 'error');
    }
  };

  const deleteAllNotifications = async () => {
    if (notifications.length === 0) return;

    try {
      const batch = writeBatch(db);

      notifications.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.delete(notificationRef);
      });

      await batch.commit();
      showToast(`${notifications.length} notifications deleted successfully`, 'success');
      setIsOpen(false);
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      showToast('Failed to delete notifications', 'error');
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      const unreadNotifications = notifications.filter(n => !n.read);

      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.update(notificationRef, { read: true });
      });

      await batch.commit();
      showToast(`${unreadNotifications.length} notifications marked as read`, 'success');
      console.log('All notifications marked as read');
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      showToast('Failed to mark notifications as read', 'error');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Format date for display
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';

    try {
      let date: Date | null = null;

      // Handle Firebase Timestamp objects
      if (timestamp && typeof timestamp === 'object' && timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      }
      // Handle serialized Firebase timestamps with seconds and nanoseconds
      else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
      }
      // Handle ISO strings
      else if (typeof timestamp === 'string') {
        const parsedDate = new Date(timestamp);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate;
        }
      }
      // Handle numeric timestamps (milliseconds)
      else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      }
      // Handle Date objects
      else if (timestamp instanceof Date) {
        date = timestamp;
      }

      // If we successfully parsed a date, format it
      if (date && !isNaN(date.getTime())) {
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

        // Show relative time for very recent notifications (less than 1 minute)
        if (diffInMinutes < 1) {
          return 'Just now';
        }
        // Show relative time for recent notifications (less than 60 minutes)
        else if (diffInMinutes < 60) {
          return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
        }
        // Show exact time for older notifications
        else {
          const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          };
          return date.toLocaleString('en-US', options);
        }
      }

      // Fallback to 'Just now' only if we couldn't parse the timestamp
      console.warn("Could not parse timestamp:", timestamp);
      return 'Just now';
    } catch (e) {
      console.error("Error formatting date:", e, "Timestamp:", timestamp);
      return 'Just now';
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (notification: Notification) => {
    if (notification.type === 'payment') {
      return <CreditCard className="h-5 w-5 text-green-600" />;
    } else if (notification.type === 'completion_request') {
      return <ClipboardCheck className="h-5 w-5 text-orange-500" />;
    } else if (notification.type === 'voucher_received') {
      return <Check className="h-5 w-5 text-blue-600" />;
    } else {
      return <Bell className="h-5 w-5 text-blue-600" />;
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

  // Group notifications by voucherNo
  const groupedNotifications = notifications.reduce((acc, notification) => {
    const key = notification.voucherNo || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(notification);
    return acc;
  }, {} as Record<string, Notification[]>);

  // Sort groups by most recent notification in each group
  const sortedGroups = Object.entries(groupedNotifications).sort((a, b) => {
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
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
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
                    title="Delete all notifications"
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
                    const latest = group[0];
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
                            <div className="mt-1 text-xs text-blue-600">
                              Voucher: {voucherNo} {group.length > 1 && <span className="ml-2 text-xs text-gray-500">({group.length} updates)</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(latest.createdAt)}
                            </p>
                          </div>
                          <button
                            onClick={e => deleteNotification(latest.id, e)}
                            className="delete-button ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete notification group"
                            disabled={deletingNotifications.has(latest.id)}
                          >
                            <X className="h-4 w-4" />
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
