import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Voucher } from '../types/voucher';

export interface VoucherNumberOptions {
  strategy: 'sequential' | 'financial_year' | 'date_based';
}

/**
 * Generate voucher number using financial year strategy (April 1st reset)
 * Format: MFV20250723_0001 (MFVYYYYMMDD_NNNN)
 */
async function generateFinancialYearVoucherNumber(): Promise<string> {
  try {
    const vouchersCollection = collection(db, 'vouchers');
    const today = new Date();

    // Create date string in YYYYMMDD format
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;

    // Determine financial year based on April 1st
    const currentMonth = today.getMonth() + 1; // 1-12
    const financialYear = currentMonth >= 4 ? year : year - 1;

    // Create financial year start date (April 1st)
    const fyStartDate = new Date(financialYear, 3, 1); // Month 3 = April (0-indexed)
    const fyEndDate = new Date(financialYear + 1, 2, 31); // March 31st next year

    // Query vouchers from current financial year
    const voucherQuery = query(
      vouchersCollection,
      orderBy('voucher_no', 'desc'),
      limit(100) // Get recent vouchers to find max sequence
    );

    const snapshot = await getDocs(voucherQuery);
    let maxSequence = 0;

    // Parse existing vouchers to find max sequence in current financial year
    snapshot.docs.forEach(doc => {
      const voucher = doc.data() as Voucher;
      const voucherNo = voucher.voucher_no;

      if (voucherNo && voucherNo.startsWith('MFV')) {
        // Extract date and sequence from voucher number: MFV20250723_0001
        const match = voucherNo.match(/^MFV(\d{8})_(\d{4})$/);
        if (match) {
          const voucherDateStr = match[1]; // 20250723
          const sequence = parseInt(match[2], 10); // 0001

          // Parse voucher date
          const voucherYear = parseInt(voucherDateStr.substring(0, 4), 10);
          const voucherMonth = parseInt(voucherDateStr.substring(4, 6), 10);
          const voucherDay = parseInt(voucherDateStr.substring(6, 8), 10);
          const voucherDate = new Date(voucherYear, voucherMonth - 1, voucherDay);

          // Check if voucher is in current financial year
          if (voucherDate >= fyStartDate && voucherDate <= fyEndDate) {
            if (sequence > maxSequence) {
              maxSequence = sequence;
            }
          }
        }
      }
    });

    // Generate next sequence number (starting from 1)
    const nextSequence = maxSequence + 1;
    const newVoucherNo = `MFV${dateString}_${String(nextSequence).padStart(4, '0')}`;

    // Validate uniqueness
    const existsQuery = query(vouchersCollection, where('voucher_no', '==', newVoucherNo), limit(1));
    const existsSnapshot = await getDocs(existsQuery);

    if (existsSnapshot.empty) {
      return newVoucherNo;
    }

    // If exists, increment and retry
    const fallbackSequence = nextSequence + Math.floor(Math.random() * 10);
    return `MFV${dateString}_${String(fallbackSequence).padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generating financial year voucher number:', error);
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = Date.now().toString().slice(-4);
    return `MFV${dateString}_${timestamp.padStart(4, '0')}`;
  }
}

/**
 * Generate voucher number using date-based strategy
 * Format: MFV20250723_0001
 */
async function generateDateBasedVoucherNumber(): Promise<string> {
  try {
    const vouchersCollection = collection(db, 'vouchers');
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');

    const voucherQuery = query(
      vouchersCollection,
      orderBy('voucher_no', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(voucherQuery);
    let maxSequence = 0;

    snapshot.docs.forEach(doc => {
      const voucher = doc.data() as Voucher;
      const voucherNo = voucher.voucher_no;

      if (voucherNo) {
        const match = voucherNo.match(/^MFV(\d{8})_(\d{4})$/);
        if (match && match[1] === dateString) {
          const sequence = parseInt(match[2], 10);
          if (sequence > maxSequence) {
            maxSequence = sequence;
          }
        }
      }
    });

    const nextSequence = maxSequence + 1;
    return `MFV${dateString}_${String(nextSequence).padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generating date-based voucher number:', error);
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = Date.now().toString().slice(-4);
    return `MFV${dateString}_${timestamp.padStart(4, '0')}`;
  }
}

/**
 * Generate voucher number using sequential strategy
 * Format: MFV20250723_0001
 */
async function generateSequentialVoucherNumber(): Promise<string> {
  try {
    const vouchersCollection = collection(db, 'vouchers');
    const voucherQuery = query(
      vouchersCollection,
      orderBy('voucher_no', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(voucherQuery);
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');

    if (snapshot.empty) {
      return `MFV${dateString}_0001`;
    }

    const latestVoucher = snapshot.docs[0].data() as Voucher;
    const voucherNo = latestVoucher.voucher_no;

    if (voucherNo && voucherNo.startsWith('MFV')) {
      const match = voucherNo.match(/^MFV(\d{8})_(\d{4})$/);
      if (match) {
        const sequence = parseInt(match[2], 10);
        const nextSequence = sequence + 1;
        const newVoucherNo = `MFV${dateString}_${String(nextSequence).padStart(4, '0')}`;

        // Validate uniqueness
        const existsQuery = query(vouchersCollection, where('voucher_no', '==', newVoucherNo), limit(1));
        const existsSnapshot = await getDocs(existsQuery);

        if (existsSnapshot.empty) {
          return newVoucherNo;
        }
      }
    }

    // Fallback
    const timestamp = Date.now().toString().slice(-4);
    return `MFV${dateString}_${timestamp.padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generating sequential voucher number:', error);
    const today = new Date();
    const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = Date.now().toString().slice(-4);
    return `MFV${dateString}_${timestamp.padStart(4, '0')}`;
  }
}

/**
 * Validate that a voucher number is unique
 */
export async function validateVoucherNumber(voucherNo: string): Promise<boolean> {
  try {
    const vouchersCollection = collection(db, 'vouchers');

    const voucherQuery = query(
      vouchersCollection,
      where('voucher_no', '==', voucherNo),
      limit(1)
    );

    const snapshot = await getDocs(voucherQuery);
    return snapshot.empty;
  } catch (error) {
    console.error('Error validating voucher number:', error);
    return false;
  }
}

/**
 * Generate a unique voucher number
 */
export async function generateVoucherNumber(options: VoucherNumberOptions = { strategy: 'financial_year' }): Promise<string> {
  let voucherNo: string;

  switch (options.strategy) {
    case 'sequential':
      voucherNo = await generateSequentialVoucherNumber();
      break;
    case 'date_based':
      voucherNo = await generateDateBasedVoucherNumber();
      break;
    case 'financial_year':
    default:
      voucherNo = await generateFinancialYearVoucherNumber();
      break;
  }

  return voucherNo;
}

/**
 * Get next available voucher number with retry logic
 */
export async function getNextAvailableVoucherNumber(options: VoucherNumberOptions = { strategy: 'financial_year' }): Promise<string> {
  const maxAttempts = 5;

  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const voucherNo = await generateVoucherNumber(options);
    const isAvailable = await validateVoucherNumber(voucherNo);

    if (isAvailable) {
      return voucherNo;
    }

    if (attempts < maxAttempts) {
      console.warn(`Voucher number ${voucherNo} already exists, retrying... (attempt ${attempts})`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Final fallback with timestamp
  const today = new Date();
  const dateString = today.toISOString().slice(0, 10).replace(/-/g, '');
  const timestamp = Date.now().toString().slice(-4);
  return `MFV${dateString}_${timestamp.padStart(4, '0')}`;
}

/**
 * Get the next event serial number for a voucher
 */
export async function getNextEventSerialNumber(voucherNo: string): Promise<number> {
  try {
    const vouchersCollection = collection(db, 'vouchers');

    const voucherQuery = query(
      vouchersCollection,
      where('voucher_no', '==', voucherNo),
      limit(1)
    );

    const snapshot = await getDocs(voucherQuery);
    let maxSerial = 0;

    snapshot.docs.forEach(doc => {
      const voucher = doc.data() as Voucher;
      if (voucher.events && voucher.events.length > 0) {
        voucher.events.forEach(event => {
          const match = event.event_id.match(/evnt_.*_(\d+)$/);
          if (match) {
            const serial = parseInt(match[1], 10);
            if (serial > maxSerial) {
              maxSerial = serial;
            }
          }
        });
      }
    });

    return maxSerial + 1;
  } catch (error) {
    console.error('Error getting next event serial number:', error);
    return 1;
  }
}
