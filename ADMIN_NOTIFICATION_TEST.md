# Admin Notification for Vendor-to-Vendor Forwarding - Testing Guide

## Overview
This document describes how to test the new admin notification feature that was implemented to notify admin users when vendors forward vouchers to other vendors.

## What Was Implemented

### 1. New Functions Added to `notificationService.ts`:
- `getAllAdminUsers()`: Retrieves all users with `role: 'admin'`
- `sendAdminVoucherForwardNotification()`: Sends notifications to all admin users when a voucher is forwarded between vendors

### 2. Modified `ForwardReport.tsx`:
- Added admin notification call when `reason === 'Forwarded'` and a vendor is selected as receiver
- Admins now receive notifications alongside the vendor receiver

## How to Test

### Prerequisites:
1. Have at least one admin user in the system
2. Have at least two vendor users in the system
3. Have a voucher that can be forwarded

### Test Steps:

1. **Login as Vendor A**
   - Navigate to `/vendor/forward-report`
   - Select a voucher that can be forwarded
   - Choose "Forward to Another Vendor" option
   - Select Vendor B as the receiver
   - Fill in required details (quantity, next job work, etc.)
   - Submit the forward request

2. **Expected Results:**
   - **Vendor B** should receive a notification: "Voucher [VoucherNo] ([ItemName], Qty: [Quantity]) has been forwarded to you by [Vendor A Name]"
   - **All Admin Users** should receive a notification: "Voucher Forwarded Between Vendors - Voucher [VoucherNo] ([ItemName], Qty: [Quantity]) has been forwarded from [Vendor A Name] to [Vendor B Name]"

3. **Verify Admin Notifications:**
   - Login as an admin user
   - Check the notification bell in the admin dashboard
   - The notification should appear with:
     - Title: "Voucher Forwarded Between Vendors"
     - Message: Details about the forwarding transaction
     - Event Type: "vendor_forward"

### Test Data Structure:
```javascript
// Admin notification data structure
{
  userId: "[admin_user_id]",
  title: "Voucher Forwarded Between Vendors",
  message: "Voucher [voucher_no] ([item_name], Qty: [quantity]) has been forwarded from [sender_name] to [receiver_name].",
  voucherNo: "[voucher_no]",
  eventType: "vendor_forward",
  eventId: "[voucher_id]",
  extra: {
    senderName: "[sender_name]",
    receiverName: "[receiver_name]",
    quantity: [quantity_number],
    itemName: "[item_name]"
  }
}
```

## Files Modified:
1. `app/utils/notificationService.ts` - Added new notification functions
2. `app/components/vendor/ForwardReport.tsx` - Added admin notification call
3. `NOTIFICATION_SYSTEM_ANALYSIS.md` - Updated documentation

## Notes:
- This feature only triggers when vendors forward to other vendors, not when completing to admin
- All admin users in the system receive the notification
- The notification is stored in the `notifications` collection (admin notifications)
- The feature gracefully handles cases where no admin users exist

## Troubleshooting:
- If notifications don't appear, check browser console for errors
- Verify that admin users exist with `role: 'admin'` in Firestore
- Check that the `notifications` collection has the proper permissions
- Ensure the forwarding vendor has proper name/email data for the notification message
