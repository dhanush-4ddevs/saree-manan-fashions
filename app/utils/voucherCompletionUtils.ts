import { Voucher, VoucherEvent } from '../types/voucher';
import { calculateTotalQuantityReceived, calculateTotalQuantityForwarded, calculateTotalDamage } from '../types/voucher';

/**
 * For a given vendor, calculate their forwardable quantity:
 * received - damaged_on_arrival - (forwarded + damaged_after_job)
 */
function getVendorForwardableQty(vendorId: string, events: VoucherEvent[]): number {
  // Find all receive events for this vendor
  const receiveEvents = events.filter(e => e.event_type === 'receive' && (e.details?.receiver_id === vendorId || e.user_id === vendorId));
  const totalReceived = receiveEvents.reduce((sum, e) => sum + (e.details?.quantity_received || 0), 0);
  const totalDamagedOnArrival = receiveEvents.reduce((sum, e) => sum + (e.details?.discrepancies?.damaged_on_arrival || 0), 0);

  // Find all forward events sent by this vendor
  const forwardEvents = events.filter(e => e.event_type === 'forward' && (e.details?.sender_id === vendorId || e.user_id === vendorId));
  const totalForwarded = forwardEvents.reduce((sum, e) => sum + (e.details?.quantity_forwarded || 0), 0);
  const totalDamagedAfterJob = forwardEvents.reduce((sum, e) => sum + (e.details?.discrepancies?.damaged_after_job || 0), 0);

  return totalReceived - totalDamagedOnArrival - totalForwarded - totalDamagedAfterJob;
}

/**
 * Get all vendor IDs from events (excluding admin)
 */
function getAllVendorIds(events: VoucherEvent[], adminId: string): string[] {
  const vendorIds = new Set<string>();
  events.forEach(e => {
    if (e.event_type === 'receive' && e.details?.receiver_id && e.details.receiver_id !== adminId) {
      vendorIds.add(e.details.receiver_id);
    }
    if (e.event_type === 'forward' && e.details?.sender_id && e.details.sender_id !== adminId) {
      vendorIds.add(e.details.sender_id);
    }
  });
  return Array.from(vendorIds);
}

/**
 * Get admin received quantity (sum of all receive events where receiver_id is admin)
 */
function getAdminReceivedQty(events: VoucherEvent[], adminId: string): number {
  return events.filter(e => e.event_type === 'receive' && e.details?.receiver_id === adminId)
    .reduce((sum, e) => sum + (e.details?.quantity_received || 0), 0);
}

/**
 * Get total damaged/missing quantity across all events
 */
function getTotalDamagedOrMissing(events: VoucherEvent[]): number {
  return events.reduce((sum, e) => {
    const d = e.details?.discrepancies;
    return sum + (d?.damaged_on_arrival || 0) + (d?.damaged_after_job || 0) + (d?.missing || 0);
  }, 0);
}

/**
 * Determines if a voucher is truly completed (no forwardable qty left for any vendor, admin received all)
 */
export function analyzeVoucherCompletion(voucher: Voucher, adminId: string): {
  isReallyCompleted: boolean;
  incompleteVendors: string[];
  adminReceivedEnough: boolean;
  reasonNotCompleted?: string;
} {
  const events = voucher.events || [];
  const vendorIds = getAllVendorIds(events, adminId);
  const incompleteVendors: string[] = [];
  for (const vendorId of vendorIds) {
    const forwardable = getVendorForwardableQty(vendorId, events);
    if (forwardable > 0) {
      incompleteVendors.push(vendorId);
    }
  }
  const totalToBeReceivedByAdmin = voucher.item_details.initial_quantity - getTotalDamagedOrMissing(events);
  const adminReceived = getAdminReceivedQty(events, adminId);
  const adminReceivedEnough = adminReceived >= totalToBeReceivedByAdmin;

  const isReallyCompleted = incompleteVendors.length === 0 && adminReceivedEnough;
  let reasonNotCompleted = undefined;
  if (!isReallyCompleted) {
    if (incompleteVendors.length > 0) {
      reasonNotCompleted = `Vendors with pending forwardable quantity: ${incompleteVendors.join(', ')}`;
    } else if (!adminReceivedEnough) {
      reasonNotCompleted = `Admin has not received all expected quantity (received: ${adminReceived}, expected: ${totalToBeReceivedByAdmin})`;
    }
  }
  return {
    isReallyCompleted,
    incompleteVendors,
    adminReceivedEnough,
    reasonNotCompleted
  };
}

/**
 * Determines the appropriate status for a voucher based on completion analysis
 */
export function determineVoucherStatus(voucher: Voucher, adminId: string): 'Completed' | 'InProgress' | 'Partially Completed' {
  const analysis = analyzeVoucherCompletion(voucher, adminId);
  if (analysis.isReallyCompleted) {
    return 'Completed';
  } else if (analysis.incompleteVendors.length > 0) {
    return 'Partially Completed';
  } else {
    return 'InProgress';
  }
}

/**
 * Manually mark a voucher as completed, handling quantity discrepancies
 * This is useful when the workflow is logically complete but there are minor quantity mismatches
 */
export function manuallyMarkVoucherComplete(
  voucher: Voucher,
  adminId: string,
  forceComplete: boolean = false,
  discrepancyReason?: string
): {
  canBeCompleted: boolean;
  finalStatus: string;
  statusComment: string;
  discrepancyDetails?: {
    expectedAdminReceive: number;
    actualAdminReceive: number;
    missingQuantity: number;
    incompleteVendors: string[];
  };
} {
  const events = voucher.events || [];
  const vendorIds = getAllVendorIds(events, adminId);
  const incompleteVendors: string[] = [];

  for (const vendorId of vendorIds) {
    const forwardable = getVendorForwardableQty(vendorId, events);
    if (forwardable > 0) {
      incompleteVendors.push(vendorId);
    }
  }

  const totalToBeReceivedByAdmin = voucher.item_details.initial_quantity - getTotalDamagedOrMissing(events);
  const adminReceived = getAdminReceivedQty(events, adminId);
  const adminReceivedEnough = adminReceived >= totalToBeReceivedByAdmin;
  const missingQuantity = totalToBeReceivedByAdmin - adminReceived;

  const isReallyCompleted = incompleteVendors.length === 0 && adminReceivedEnough;

  let finalStatus: string;
  let statusComment: string;
  let canBeCompleted = false;

  if (isReallyCompleted) {
    finalStatus = 'Completed';
    statusComment = 'All work completed - no partial quantities remaining';
    canBeCompleted = true;
  } else if (forceComplete) {
    finalStatus = 'Completed';
    statusComment = `Manually marked as complete. ${discrepancyReason || 'Workflow logically complete with minor quantity discrepancies.'}`;
    canBeCompleted = true;
  } else {
    finalStatus = 'Received';
    if (incompleteVendors.length > 0) {
      statusComment = `Vendors with pending forwardable quantity: ${incompleteVendors.join(', ')}`;
    } else if (!adminReceivedEnough) {
      statusComment = `Admin has not received all expected quantity (received: ${adminReceived}, expected: ${totalToBeReceivedByAdmin})`;
    } else {
      statusComment = 'Partial quantities still pending with vendors';
    }
    canBeCompleted = false;
  }

  return {
    canBeCompleted,
    finalStatus,
    statusComment,
    discrepancyDetails: {
      expectedAdminReceive: totalToBeReceivedByAdmin,
      actualAdminReceive: adminReceived,
      missingQuantity,
      incompleteVendors
    }
  };
}
