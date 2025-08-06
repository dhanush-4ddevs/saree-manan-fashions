import { Voucher } from '../types/voucher';

/**
 * Generate LR Number based on voucher number and receiver phone
 */
export function generateLRNumber(voucherNo: string, receiverPhone: string): string {
  if (!voucherNo || !receiverPhone) {
    throw new Error('Voucher number and receiver phone are required for LR generation');
  }

  // Extract digits from voucher number and phone
  const voucherDigits = voucherNo.replace(/\D/g, ''); // Remove non-digits
  const phoneDigits = receiverPhone.replace(/\D/g, '').slice(-4); // Last 4 digits of phone

  // Create LR number: LR + first 6 digits of voucher + last 4 digits of phone
  return `LR${voucherDigits.slice(0, 6)}${phoneDigits}`;
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^[+]?[\d\s\-()]{10,15}$/;
  return phoneRegex.test(phone);
}

/**
 * Calculate forwardable quantity for a voucher
 */
export function calculateForwardableQuantity(voucher: Voucher): number {
  const totalReceived = voucher.events
    .filter(event => event.event_type === 'receive')
    .reduce((total, event) => total + (event.details.quantity_received || 0), 0);

  const totalForwarded = voucher.events
    .filter(event => event.event_type === 'forward')
    .reduce((total, event) => total + (event.details.quantity_forwarded || 0), 0);

  const totalDamage = voucher.events.reduce((total, event) => {
    const discrepancies = event.details.discrepancies;
    if (!discrepancies) return total;
    return total +
      (discrepancies.missing || 0) +
      (discrepancies.damaged_on_arrival || 0) +
      (discrepancies.damaged_after_job || 0);
  }, 0);

  // If nothing received yet, use initial quantity
  if (totalReceived === 0) {
    return Math.max(0, voucher.item_details.initial_quantity - totalForwarded - totalDamage);
  }

  // Otherwise use received quantity
  return Math.max(0, totalReceived - totalForwarded - totalDamage);
}

/**
 * Calculate quantity left to forward
 */
export function calculateQtyLeftToForward(forwardableQty: number, totalForwarded: number): number {
  return Math.max(0, forwardableQty - totalForwarded);
}

/**
 * Determine forward type based on quantities
 */
export function determineForwardType(forwardableQty: number, forwardedQty: number): 'partial' | 'full' {
  if (forwardedQty >= forwardableQty) {
    return 'full';
  } else {
    return 'partial';
  }
}

/**
 * Validate forward quantity
 */
export function validateForwardQuantity(voucher: Voucher, quantityToForward: number): { isValid: boolean; error?: string } {
  if (quantityToForward <= 0) {
    return { isValid: false, error: 'Forward quantity must be greater than 0' };
  }

  const forwardableQty = calculateForwardableQuantity(voucher);

  if (quantityToForward > forwardableQty) {
    return {
      isValid: false,
      error: `Cannot forward ${quantityToForward} pieces. Only ${forwardableQty} pieces available for forwarding.`
    };
  }

  return { isValid: true };
}

/**
 * Updates voucher with partial forwarding data including new tracking fields
 */
export function updateVoucherForPartialForwarding(
  voucher: Voucher,
  forwardedQty: number
): Partial<Voucher> {
  const currentTotalForwarded = voucher.events
    .filter(event => event.event_type === 'forward')
    .reduce((total, event) => total + (event.details.quantity_forwarded || 0), 0);

  const newTotalForwarded = currentTotalForwarded + forwardedQty;
  const newForwardableQty = calculateForwardableQuantity({
    ...voucher,
    events: [...voucher.events, {
      event_id: 'temp',
      event_type: 'forward',
      timestamp: new Date().toISOString(),
      user_id: 'temp',
      comment: 'temp',
      details: { quantity_forwarded: forwardedQty }
    }]
  });

  const forwardableQtyAtTimeOfForward = calculateForwardableQuantity(voucher);
  const forwardType = determineForwardType(forwardableQtyAtTimeOfForward, forwardedQty);
  const qtyLeftToForward = calculateQtyLeftToForward(calculateForwardableQuantity(voucher), newTotalForwarded);

  // Always set to 'forwarded' status since we're removing 'partially_forwarded'
  const newStatus: Voucher['voucher_status'] = 'Forwarded';

  return {
    voucher_status: newStatus
  };
}

/**
 * Get current available quantity for a voucher
 */
export function getCurrentAvailableQuantity(voucher: Voucher): number {
  return calculateForwardableQuantity(voucher);
}

/**
 * Check if voucher can be forwarded
 */
export function canVoucherBeForwarded(voucher: Voucher): boolean {
  const forwardableQty = calculateForwardableQuantity(voucher);
  return forwardableQty > 0 && ['received', 'forwarded'].includes(voucher.voucher_status);
}

/**
 * Get voucher summary statistics
 */
export function getVoucherSummary(voucher: Voucher): {
  initialQuantity: number;
  totalReceived: number;
  totalForwarded: number;
  totalDamage: number;
  availableQuantity: number;
  status: string;
} {
  const initialQuantity = voucher.item_details.initial_quantity;

  const totalReceived = voucher.events
    .filter(event => event.event_type === 'receive')
    .reduce((total, event) => total + (event.details.quantity_received || 0), 0);

  const totalForwarded = voucher.events
    .filter(event => event.event_type === 'forward')
    .reduce((total, event) => total + (event.details.quantity_forwarded || 0), 0);

  const totalDamage = voucher.events.reduce((total, event) => {
    const discrepancies = event.details.discrepancies;
    if (!discrepancies) return total;
    return total +
      (discrepancies.missing || 0) +
      (discrepancies.damaged_on_arrival || 0) +
      (discrepancies.damaged_after_job || 0);
  }, 0);

  const availableQuantity = calculateForwardableQuantity(voucher);

  return {
    initialQuantity,
    totalReceived,
    totalForwarded,
    totalDamage,
    availableQuantity,
    status: voucher.voucher_status
  };
}
