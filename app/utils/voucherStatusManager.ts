import { Voucher, VoucherEvent, VoucherStatus, StatusTransition } from '../types/voucher';

/**
 * Status transition rules
 */
export const STATUS_TRANSITIONS: StatusTransition[] = [
  // Dispatch event - sets initial status
  {
    from: 'Dispatched',
    to: 'Dispatched',
    event: 'dispatch'
  },

  // Receive event - when vendor receives voucher (any status except Completed)
  {
    from: 'Dispatched',
    to: 'Received',
    event: 'receive'
  },

  {
    from: 'Forwarded',
    to: 'Received',
    event: 'receive'
  },

  // Forward event - when vendor forwards voucher
  {
    from: 'Received',
    to: 'Forwarded',
    event: 'forward'
  },

  // Admin receive event - completion check
  {
    from: 'Received',
    to: 'Completed',
    event: 'receive',
    conditions: { adminReceivedEnough: true }
  },

  {
    from: 'Forwarded',
    to: 'Completed',
    event: 'receive',
    conditions: { adminReceivedEnough: true }
  }
];

/**
 * Calculate totals from voucher events
 */
export function calculateVoucherTotals(voucher: Voucher): {
  total_dispatched: number;
  total_received: number;
  total_forwarded: number;
  total_missing_on_arrival: number;
  total_damaged_on_arrival: number;
  total_damaged_after_work: number;
  admin_received_quantity: number;
} {
  const events = voucher.events || [];

  const total_dispatched = events
    .filter(e => e.event_type === 'dispatch')
    .reduce((sum, e) => sum + (e.details.quantity_dispatched || 0), 0);

  const total_received = events
    .filter(e => e.event_type === 'receive')
    .reduce((sum, e) => sum + (e.details.quantity_received || 0), 0);

  const total_forwarded = events
    .filter(e => e.event_type === 'forward')
    .reduce((sum, e) => sum + (e.details.quantity_forwarded || 0), 0);

  const total_missing_on_arrival = events
    .filter(e => e.event_type === 'receive')
    .reduce((sum, e) => sum + (e.details.discrepancies?.missing || 0), 0);

  const total_damaged_on_arrival = events
    .filter(e => e.event_type === 'receive')
    .reduce((sum, e) => sum + (e.details.discrepancies?.damaged_on_arrival || 0), 0);

  const total_damaged_after_work = events
    .filter(e => e.event_type === 'forward')
    .reduce((sum, e) => sum + (e.details.discrepancies?.damaged_after_job || 0), 0);

  // Calculate admin received quantity (receive events tagged as admin or parent forward sent to 'admin')
  const admin_received_quantity = events
    .filter(e => {
      if (e.event_type !== 'receive') return false;

      // New path: explicit flag for admin receipts
      if (e.details.is_admin_receive === true) {
        return true;
      }

      // Check if this receive event's parent forward was sent to generic 'admin'
      if (e.parent_event_id) {
        const parentForward = events.find(fwd => fwd.event_id === e.parent_event_id);
        return parentForward && parentForward.details.receiver_id === 'admin';
      }

      // Also check if receiver_id is 'admin' directly (backwards compatibility)
      return e.details.receiver_id === 'admin' || e.details.receiver_id === voucher.created_by_user_id;
    })
    .reduce((sum, e) => sum + (e.details.quantity_received || 0), 0);

  return {
    total_dispatched,
    total_received,
    total_forwarded,
    total_missing_on_arrival,
    total_damaged_on_arrival,
    total_damaged_after_work,
    admin_received_quantity
  };
}

/**
 * Check if all vendors have received forwarded vouchers
 */
export function checkAllVendorsReceived(voucher: Voucher): boolean {
  const events = voucher.events || [];

  // Get all forward events
  const forwardEvents = events.filter(e => e.event_type === 'forward');

  // Check if each forward event has a corresponding receive event
  for (const forwardEvent of forwardEvents) {
    const receiverId = forwardEvent.details.receiver_id;
    if (!receiverId) continue;

    const hasReceived = events.some(e =>
      e.event_type === 'receive' &&
      e.details.receiver_id === receiverId &&
      new Date(e.timestamp) > new Date(forwardEvent.timestamp)
    );

    if (!hasReceived) {
      return false;
    }
  }

  return true;
}

/**
 * Check if admin has received enough quantity for completion
 */
export function checkAdminReceivedEnough(voucher: Voucher): boolean {
  const totals = calculateVoucherTotals(voucher);

  const expectedAdminReceive = totals.total_dispatched -
    totals.total_missing_on_arrival -
    totals.total_damaged_on_arrival -
    totals.total_damaged_after_work;

  return totals.admin_received_quantity >= expectedAdminReceive;
}

/**
 * Check if forward quantity matches available quantity (for Forwarded status)
 */
export function checkForwardQuantityComplete(voucher: Voucher, forwardEvent: VoucherEvent): boolean {
  const events = voucher.events || [];
  const senderId = forwardEvent.details.sender_id;
  if (!senderId) return false;

  // Calculate total received by this vendor
  const totalReceived = events
    .filter(e => e.event_type === 'receive' && e.details.receiver_id === senderId)
    .reduce((sum, e) => sum + (e.details.quantity_received || 0), 0);

  // Calculate total already forwarded by this vendor
  const totalAlreadyForwarded = events
    .filter(e => e.event_type === 'forward' && e.details.sender_id === senderId)
    .reduce((sum, e) => sum + (e.details.quantity_forwarded || 0), 0);

  // Calculate total damaged for this vendor
  const totalDamaged = events
    .filter(e => (e.event_type === 'receive' || e.event_type === 'forward') &&
                 (e.details.receiver_id === senderId || e.details.sender_id === senderId))
    .reduce((sum, e) => {
      const discrepancies = e.details.discrepancies || {};
      return sum + (discrepancies.missing || 0) +
             (discrepancies.damaged_on_arrival || 0) +
             (discrepancies.damaged_after_job || 0);
    }, 0);

  const availableQuantity = totalReceived - totalAlreadyForwarded - totalDamaged;
  const forwardQuantity = forwardEvent.details.quantity_forwarded || 0;

  return forwardQuantity >= availableQuantity;
}

/**
 * Determine the new status based on event and current state
 */
export function determineNewStatus(
  voucher: Voucher,
  eventType: 'dispatch' | 'receive' | 'forward' | 'admin_receive',
  event?: VoucherEvent
): VoucherStatus {
  const currentStatus = voucher.voucher_status;
  const totals = calculateVoucherTotals(voucher);

  // Find applicable transition
  const applicableTransitions = STATUS_TRANSITIONS.filter(t =>
    t.from === currentStatus && t.event === eventType
  );

  if (applicableTransitions.length === 0) {
    return currentStatus; // No transition possible
  }

  // Check conditions for each transition
  for (const transition of applicableTransitions) {
    let conditionsMet = true;

    if (transition.conditions) {
      if (transition.conditions.allVendorsReceived) {
        conditionsMet = conditionsMet && checkAllVendorsReceived(voucher);
      }

      if (transition.conditions.adminReceivedEnough) {
        conditionsMet = conditionsMet && checkAdminReceivedEnough(voucher);
      }

      if (transition.conditions.quantityCheck && event && eventType === 'forward') {
        conditionsMet = conditionsMet && checkForwardQuantityComplete(voucher, event);
      }
    }

    if (conditionsMet) {
      return transition.to;
    }
  }

  // If no conditions met, return current status
  return currentStatus;
}

/**
 * Update voucher with new status and totals
 */
export function updateVoucherStatus(voucher: Voucher, newStatus: VoucherStatus): Partial<Voucher> {
  const totals = calculateVoucherTotals(voucher);

  return {
    voucher_status: newStatus,
    ...totals,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Get status color for UI display
 */
export function getStatusColor(status: VoucherStatus): string {
  switch (status) {
    case 'Dispatched':
      return 'text-yellow-600';
    case 'Received':
      return 'text-blue-600';
    case 'Forwarded':
      return 'text-indigo-600';
    case 'Completed':
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Get status background color for UI display
 */
export function getStatusBackgroundColor(status: VoucherStatus): string {
  switch (status) {
    case 'Dispatched':
      return 'bg-yellow-100 text-yellow-800';
    case 'Received':
      return 'bg-blue-100 text-blue-800';
    case 'Forwarded':
      return 'bg-indigo-100 text-indigo-800';
    case 'Completed':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
