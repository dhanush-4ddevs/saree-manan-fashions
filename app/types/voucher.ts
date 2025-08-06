// NEW EVENT-BASED VOUCHER SYSTEM
// Clean implementation with no legacy fallbacks

// Event interface matching the user's JSON structure
export interface VoucherEvent {
  event_id: string; // Format: evnt_{voucherNo}_{serialNumber}
  parent_event_id?: string;
  event_type: 'dispatch' | 'receive' | 'forward';
  timestamp: string;
  user_id?: string;
  comment: string;
  details: {
    jobWork?: JobWorkType;
    sender_id?: string;
    receiver_id?: string;
    quantity_dispatched?: number;
    quantity_expected?: number;
    quantity_received?: number;
    quantity_before_job?: number;
    quantity_forwarded?: number;
    price_per_piece?: number; // Price per piece for forward events
    discrepancies?: {
      missing?: number;
      damaged_on_arrival?: number;
      damaged_after_job?: number;
      damage_reason?: string | null;
    };
    transport?: {
      lr_no: string;
      lr_date: string;
      transporter_name: string;
    };
  };
}

export interface ItemDetails {
  item_name: string;
  images: string[];
  initial_quantity: number;
  supplier_name: string;
  supplier_price_per_piece: number;
}

// Job work types - Updated to be dynamic from database
export type JobWorkType = string;

// Remove hardcoded JOB_WORK_OPTIONS as it will be fetched from database
// export const JOB_WORK_OPTIONS: JobWorkType[] = [
//   'Dying Chaap',
//   'Dying 2D',
//   'Finishing / Polishing',
//   'Stone Work',
//   'Blouse Work',
//   'Embroidery Work'
// ];

// Voucher status types
export type VoucherStatus =
  | 'Dispatched'
  | 'Received'
  | 'Forwarded'
  | 'Completed';

// Status transition rules
export interface StatusTransition {
  from: VoucherStatus;
  to: VoucherStatus;
  event: 'dispatch' | 'receive' | 'forward' | 'admin_receive';
  conditions?: {
    quantityCheck?: boolean;
    allVendorsReceived?: boolean;
    adminReceivedEnough?: boolean;
  };
}

// Main voucher interface
export interface Voucher {
  id?: string; // Firestore document ID
  voucher_no: string; // Format: MFV20250722_0003
  voucher_status: VoucherStatus;
  created_at: string;
  created_by_user_id: string;
  item_details: ItemDetails;
  events: VoucherEvent[];
  // Status tracking fields
  total_dispatched: number;
  total_received: number;
  total_forwarded: number;
  total_missing_on_arrival: number;
  total_damaged_on_arrival: number;
  total_damaged_after_work: number;
  admin_received_quantity: number;
  // Firebase fields
  createdAt?: any; // Firestore timestamp
  updatedAt?: any; // Firestore timestamp
  updatedBy?: string; // UID of user who last updated the voucher
}

// Form data interface for VoucherForm
export interface VoucherFormData {
  voucherDate: string;
  senderName: string;
  senderDesignation: string;
  item: string;
  quantity: number;
  supplierName: string;
  supplierPrice: number;
  jobWork: JobWorkType;
  vendorUserId: string;
  vendorFirstName: string;
  vendorLastName: string;
  vendorCompanyName: string;
  vendorAddress: string;
  vendorPhone: string;
  vendorEmail: string;
  vendorCode: string;
  lrDate: string;
  lrNumber: string;
  transportName: string;
  comment: string;
}

// Utility functions for the new voucher system
export const generateEventId = (voucherNo: string, serialNumber: number): string => {
  return `evnt_${voucherNo}_${serialNumber.toString().padStart(3, '0')}`;
};

export const calculateTotalQuantityReceived = (events: VoucherEvent[]): number => {
  return events
    .filter(event => event.event_type === 'receive')
    .reduce((total, event) => total + (event.details.quantity_received || 0), 0);
};

export const calculateTotalQuantityForwarded = (events: VoucherEvent[]): number => {
  return events
    .filter(event => event.event_type === 'forward')
    .reduce((total, event) => total + (event.details.quantity_forwarded || 0), 0);
};

export const calculateTotalDamage = (events: VoucherEvent[]): { damagedOnArrival: number; damagedDuringJob: number; missing: number; total: number } => {
  let damagedOnArrival = 0;
  let damagedDuringJob = 0;
  let missing = 0;

  events.forEach(event => {
    const d = event.details.discrepancies;
    if (d) {
      damagedOnArrival += d.damaged_on_arrival || 0;
      damagedDuringJob += d.damaged_after_job || 0;
      missing += d.missing || 0;
    }
  });

  return {
    damagedOnArrival,
    damagedDuringJob,
    missing,
    total: damagedOnArrival + damagedDuringJob + missing
  };
};

export const getCurrentAvailableQuantity = (voucher: Voucher): number => {
  const totalReceived = calculateTotalQuantityReceived(voucher.events);
  const totalForwarded = calculateTotalQuantityForwarded(voucher.events);
  const totalDamage = calculateTotalDamage(voucher.events).total;

  // If nothing has been received yet, return initial quantity minus damage
  if (totalReceived === 0) {
    return voucher.item_details.initial_quantity - totalDamage;
  }

  // Otherwise, return received minus forwarded minus damage
  return totalReceived - totalForwarded - totalDamage;
};

export const getSortedVoucherEvents = (voucher: Voucher): VoucherEvent[] => {
  return [...voucher.events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};
