'use client';

import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit, doc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';

/**
 * Improved notification service to handle notifications with proper indexing
 */
export const notificationService = {
  /**
   * Create a notification (unified for admin and vendor)
   * @param userId - The user ID to send notification to
   * @param title - Notification title
   * @param message - Notification message
   * @param voucherNo - Voucher number for grouping
   * @param eventType - Event type (dispatch, receive, forward, payment, etc.)
   * @param eventId - Event ID (if applicable)
   * @param groupKey - Grouping key (defaults to voucherNo)
   * @param extra - Any extra fields (e.g., amountPaid)
   * @returns The created notification ID
   */
  async createNotification({
    userId,
    title,
    message,
    voucherNo,
    eventType,
    eventId,
    groupKey,
    extra = {}
  }: {
    userId: string;
    title: string;
    message: string;
    voucherNo?: string;
    eventType?: string;
    eventId?: string;
    groupKey?: string;
    extra?: Record<string, any>;
  }): Promise<string> {
    try {
      const notificationData: any = {
        userId,
        title,
        message,
        read: false,
        voucherNo,
        eventType,
        eventId,
        groupKey: groupKey || voucherNo,
        createdAt: serverTimestamp(),
        ...extra
      };
      const notificationRef = await addDoc(collection(db, 'notifications'), notificationData);
      console.log('Notification created with ID:', notificationRef.id);
      return notificationRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },

  /**
   * Send admin notification to ALL admins when a vendor receives a voucher
   */
  async sendAdminVendorReceiveNotification({
    voucherNo,
    voucherId,
    itemName,
    quantity,
    receiverName
  }: {
    voucherNo: string;
    voucherId: string;
    itemName?: string;
    quantity?: number;
    receiverName?: string;
  }) {
    try {
      const adminUsers = await this.getAllAdminUsers();

      if (adminUsers.length === 0) {
        console.log('No admin users found to notify about vendor receive');
        return;
      }

      const title = 'Voucher Received by Vendor';
      const message = `Voucher ${voucherNo}${itemName ? ` (${itemName})` : ''}${typeof quantity === 'number' ? `, Qty: ${quantity}` : ''} has been received${receiverName ? ` by ${receiverName}` : ''}.`;

      const notifications = adminUsers.map(admin =>
        this.createNotification({
          userId: admin.id,
          title,
          message,
          voucherNo,
          eventType: 'receive',
          eventId: voucherId,
          extra: { itemName, quantity, receiverName }
        })
      );

      await Promise.all(notifications);
      console.log(`Sent vendor receive notifications to ${adminUsers.length} admin(s)`);
    } catch (error) {
      console.error('Error sending admin vendor receive notification:', error);
    }
  },

  /**
   * Delete a single notification
   * @param notificationId - The notification ID to delete
   * @returns True if deleted successfully, false otherwise
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      console.log('Notification deleted with ID:', notificationId);
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  },

  /**
   * Delete all notifications for a user
   * @param userId - The user ID whose notifications to delete
   * @returns True if deleted successfully, false otherwise
   */
  async deleteAllNotifications(userId: string): Promise<boolean> {
    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(notificationsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('No notifications found for user:', userId);
        return true;
      }

      const batch = writeBatch(db);
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Deleted ${snapshot.size} notifications for user:`, userId);
      return true;
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      return false;
    }
  },

  /**
   * Delete a single vendor notification
   * @param notificationId - The vendor notification ID to delete
   * @returns True if deleted successfully, false otherwise
   */
  async deleteVendorNotification(notificationId: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'vendorNotifications', notificationId));
      console.log('Vendor notification deleted with ID:', notificationId);
      return true;
    } catch (error) {
      console.error('Error deleting vendor notification:', error);
      return false;
    }
  },

  /**
   * Delete all vendor notifications for a user
   * @param vendorUserId - The vendor user ID whose notifications to delete
   * @returns True if deleted successfully, false otherwise
   */
  async deleteAllVendorNotifications(vendorUserId: string): Promise<boolean> {
    try {
      const vendorNotificationsRef = collection(db, 'vendorNotifications');
      const q = query(vendorNotificationsRef, where('vendorUserId', '==', vendorUserId));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('No vendor notifications found for user:', vendorUserId);
        return true;
      }

      const batch = writeBatch(db);
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Deleted ${snapshot.size} vendor notifications for user:`, vendorUserId);
      return true;
    } catch (error) {
      console.error('Error deleting all vendor notifications:', error);
      return false;
    }
  },

  /**
   * Get user by email or code
   * @param email - User email
   * @param userCode - User code
   * @returns The user document or null if not found
   */
  async getUserByEmailOrCode(email?: string, userCode?: string): Promise<{ id: string, data: any } | null> {
    try {
      if (!email && !userCode) {
        console.log('No email or userCode provided to getUserByEmailOrCode');
        return null;
      }

      console.log(`Searching for user with email: "${email}" or userCode: "${userCode}"`);

      const usersRef = collection(db, 'users');
      let userQuery;

      if (email) {
        userQuery = query(usersRef, where('email', '==', email), limit(1));
      } else {
        userQuery = query(usersRef, where('userCode', '==', userCode), limit(1));
      }

      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        console.log('No user found with the provided email or userCode');
        return null;
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      console.log('Found user:', { id: userDoc.id, data: userData });
      return { id: userDoc.id, data: userData };
    } catch (error) {
      console.error('Error getting user by email or code:', error);
      return null;
    }
  },

  /**
   * Get all admin users
   * @returns Array of admin users
   */
  async getAllAdminUsers(): Promise<{ id: string, data: any }[]> {
    try {
      const usersRef = collection(db, 'users');
      const adminQuery = query(usersRef, where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);

      const adminList: { id: string, data: any }[] = [];
      adminSnapshot.forEach((doc) => {
        adminList.push({ id: doc.id, data: doc.data() });
      });

      console.log(`Found ${adminList.length} admin users`);
      return adminList;
    } catch (error) {
      console.error('Error getting admin users:', error);
      return [];
    }
  },

  /**
   * Send event-based notifications (to receiver and admin)
   */
  async sendEventNotifications({
    voucherNo,
    eventType,
    eventId,
    receiverId,
    adminId,
    itemName,
    quantity
  }: {
    voucherNo: string;
    eventType: string;
    eventId: string;
    receiverId?: string;
    adminId: string;
    itemName?: string;
    quantity?: number;
  }) {
    const notifications = [];
    const eventLabel = eventType.charAt(0).toUpperCase() + eventType.slice(1);

    // Notify receiver (vendor or user)
    if (receiverId) {
      // Check if receiver is a vendor by looking up their user data
      try {
        const receiverDoc = await getDoc(doc(db, 'users', receiverId));
        if (receiverDoc.exists()) {
          const receiverData = receiverDoc.data();
          const isVendor = receiverData.role === 'vendor';

          if (isVendor) {
            // Use vendor notification for vendors
            notifications.push(
              this.createVendorNotification({
                vendorUserId: receiverId,
                title: `${eventLabel} Event for Voucher ${voucherNo}`,
                message: `You are the receiver for voucher ${voucherNo}${itemName ? ` (${itemName})` : ''}${quantity ? `, Qty: ${quantity}` : ''}.`,
                voucherNo,
                voucherId: eventId,
                type: 'voucher_assignment'
              })
            );
          } else {
            // Use regular notification for admins
            notifications.push(
              this.createNotification({
                userId: receiverId,
                title: `${eventLabel} Event for Voucher ${voucherNo}`,
                message: `You are the receiver for voucher ${voucherNo}${itemName ? ` (${itemName})` : ''}${quantity ? `, Qty: ${quantity}` : ''}.`,
                voucherNo,
                eventType,
                eventId
              })
            );
          }
        } else {
          // Fallback to regular notification if user not found
          notifications.push(
            this.createNotification({
              userId: receiverId,
              title: `${eventLabel} Event for Voucher ${voucherNo}`,
              message: `You are the receiver for voucher ${voucherNo}${itemName ? ` (${itemName})` : ''}${quantity ? `, Qty: ${quantity}` : ''}.`,
              voucherNo,
              eventType,
              eventId
            })
          );
        }
      } catch (error) {
        console.error('Error checking user role for notification:', error);
        // Fallback to regular notification
        notifications.push(
          this.createNotification({
            userId: receiverId,
            title: `${eventLabel} Event for Voucher ${voucherNo}`,
            message: `You are the receiver for voucher ${voucherNo}${itemName ? ` (${itemName})` : ''}${quantity ? `, Qty: ${quantity}` : ''}.`,
            voucherNo,
            eventType,
            eventId
          })
        );
      }
    }

    // Notify admin (voucher creator) - but NOT for dispatch events
    if (adminId && eventType !== 'dispatch') {
      notifications.push(
        this.createNotification({
          userId: adminId,
          title: `${eventLabel} Event for Voucher ${voucherNo}`,
          message: `A ${eventType} event occurred for voucher ${voucherNo}${itemName ? ` (${itemName})` : ''}${quantity ? `, Qty: ${quantity}` : ''}.`,
          voucherNo,
          eventType,
          eventId
        })
      );
    }
    await Promise.all(notifications);
  },

  /**
   * Send payment notification to vendor
   * Each payment notification is unique and should NOT be grouped/overwritten
   */
  async sendPaymentNotification({
    vendorUserId,
    paymentAmount,
    voucherNo,
    voucherId,
    workDescription
  }: {
    vendorUserId: string;
    paymentAmount: number;
    voucherNo: string;
    voucherId: string;
    workDescription?: string;
  }) {
    // Add unique timestamp to ensure each payment notification is distinct
    const paymentTimestamp = Date.now();
    await this.createVendorNotification({
      vendorUserId,
      title: 'Payment Processed',
      message: `Payment of ₹${paymentAmount.toLocaleString('en-IN')} has been processed for voucher ${voucherNo}.${workDescription ? ` Work: ${workDescription}` : ''}`,
      voucherNo,
      voucherId,
      type: 'payment',
      extra: { 
        amountPaid: paymentAmount,
        paymentTimestamp // Unique identifier for each payment
      }
    });
  },

  /**
   * Send vendor assignment notification
   */
  async sendVoucherAssignmentNotification({
    vendorUserId,
    voucherNo,
    voucherId,
    itemName,
    quantity,
    isForwarded = false,
    senderName
  }: {
    vendorUserId: string;
    voucherNo: string;
    voucherId: string;
    itemName: string;
    quantity: number;
    isForwarded?: boolean;
    senderName: string;
  }) {
    const title = isForwarded ? 'Voucher Forwarded to You' : 'Voucher Assigned to You';
    const message = isForwarded
      ? `Voucher ${voucherNo} (${itemName}, Qty: ${quantity}) has been forwarded to you by ${senderName}.`
      : `Voucher ${voucherNo} (${itemName}, Qty: ${quantity}) has been assigned to you.`;

    await this.createVendorNotification({
      vendorUserId,
      title,
      message,
      voucherNo,
      voucherId,
      type: 'voucher_assignment',
      extra: { itemName, quantity, senderName }
    });
  },

  /**
   * Send voucher completion notification
   */
  async sendVoucherCompletionNotification({
    vendorUserId,
    voucherNo,
    voucherId,
    itemName,
    quantity,
    isCompleted = false
  }: {
    vendorUserId: string;
    voucherNo: string;
    voucherId: string;
    itemName: string;
    quantity: number;
    isCompleted?: boolean;
  }) {
    const title = isCompleted ? 'Voucher Completed' : 'Voucher Completion Request';
    const message = isCompleted
      ? `Voucher ${voucherNo} (${itemName}, Qty: ${quantity}) has been completed and confirmed.`
      : `Voucher ${voucherNo} (${itemName}, Qty: ${quantity}) completion request has been submitted.`;

    await this.createVendorNotification({
      vendorUserId,
      title,
      message,
      voucherNo,
      voucherId,
      type: 'voucher_completion',
      extra: { itemName, quantity, isCompleted }
    });
  },

  /**
   * Send admin notification when voucher is forwarded between vendors
   */
  async sendAdminVoucherForwardNotification({
    voucherNo,
    voucherId,
    itemName,
    quantity,
    senderName,
    receiverName
  }: {
    voucherNo: string;
    voucherId: string;
    itemName: string;
    quantity: number;
    senderName: string;
    receiverName: string;
  }) {
    try {
      const adminUsers = await this.getAllAdminUsers();

      if (adminUsers.length === 0) {
        console.log('No admin users found to notify about voucher forwarding');
        return;
      }

      const notifications = adminUsers.map(admin =>
        this.createNotification({
          userId: admin.id,
          title: 'Voucher Forwarded Between Vendors',
          message: `Voucher ${voucherNo} (${itemName}, Qty: ${quantity}) has been forwarded from ${senderName} to ${receiverName}.`,
          voucherNo,
          eventType: 'vendor_forward',
          eventId: voucherId,
          extra: { senderName, receiverName, quantity, itemName }
        })
      );

      await Promise.all(notifications);
      console.log(`Sent voucher forward notifications to ${adminUsers.length} admin(s)`);
    } catch (error) {
      console.error('Error sending admin voucher forward notification:', error);
    }
  },

  /**
   * Send admin notification when voucher completion request is submitted
   */
  async sendAdminCompletionNotification({
    voucherNo,
    voucherId,
    itemName,
    quantity,
    senderName
  }: {
    voucherNo: string;
    voucherId: string;
    itemName: string;
    quantity: number;
    senderName: string;
  }) {
    try {
      const adminUsers = await this.getAllAdminUsers();

      if (adminUsers.length === 0) {
        console.log('No admin users found to notify about voucher completion');
        return;
      }

      const notifications = adminUsers.map(admin =>
        this.createNotification({
          userId: admin.id,
          title: 'Voucher Completion Request',
          message: `Voucher ${voucherNo} (${itemName}, Qty: ${quantity}) has been sent to Admin by ${senderName} for completion.`,
          voucherNo,
          eventType: 'completion_request',
          eventId: voucherId,
          extra: { senderName, quantity, itemName }
        })
      );

      await Promise.all(notifications);
      console.log(`Sent voucher completion notifications to ${adminUsers.length} admin(s)`);
    } catch (error) {
      console.error('Error sending admin completion notification:', error);
    }
  },

  /**
   * Create a vendor notification (separate from admin notifications)
   */
  async createVendorNotification({
    vendorUserId,
    title,
    message,
    voucherNo,
    voucherId,
    type,
    extra = {}
  }: {
    vendorUserId: string;
    title: string;
    message: string;
    voucherNo?: string;
    voucherId?: string;
    type?: string;
    extra?: Record<string, any>;
  }): Promise<string> {
    try {
      const notificationData: any = {
        vendorUserId,
        title,
        message,
        read: false,
        voucherNo,
        voucherId,
        type,
        createdAt: serverTimestamp(),
        ...extra
      };
      const notificationRef = await addDoc(collection(db, 'vendorNotifications'), notificationData);
      console.log('Vendor notification created with ID:', notificationRef.id);
      return notificationRef.id;
    } catch (error) {
      console.error('Error creating vendor notification:', error);
      throw error;
    }
  },

  /**
   * Get notifications for a user
   * @param userId - User ID
   * @param limit - Number of notifications to get
   * @returns List of notifications
   */
  async getUserNotifications(userId: string, notificationLimit: number = 10): Promise<any[]> {
    try {
      const notificationsRef = collection(db, 'notifications');

      // First get all notifications for this user
      const userNotificationsQuery = query(
        notificationsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(notificationLimit)
      );

      const notificationsSnapshot = await getDocs(userNotificationsQuery);

      const notificationsList: any[] = [];
      notificationsSnapshot.forEach((doc) => {
        const data = doc.data();
        notificationsList.push({
          id: doc.id,
          userId: data.userId,
          title: data.title,
          message: data.message,
          read: data.read,
          voucherId: data.voucherId,
          createdAt: data.createdAt
        });
      });

      return notificationsList;
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      return [];
    }
  }
};
