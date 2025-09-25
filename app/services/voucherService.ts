import { collection, doc, addDoc, getDocs, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Voucher, VoucherEvent, VoucherStatus, generateEventId } from '../types/voucher';
import { notificationService } from '../utils/notificationService';
import { determineNewStatus, updateVoucherStatus } from '../utils/voucherStatusManager';
import { generateVoucherNumber } from '../utils/voucherNumberGenerator';

export class VoucherService {
  /**
   * Create a new voucher
   */
  static async createVoucher(voucherData: Omit<Voucher, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'vouchers'), {
      ...voucherData,
      voucher_status: 'Dispatched',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return docRef.id;
  }

  /**
   * Get voucher by voucher number
   */
  static async getVoucherByNumber(voucherNo: string): Promise<{ id: string; data: Voucher | null }> {
    const vouchersRef = collection(db, 'vouchers');
    const q = query(vouchersRef, where('voucher_no', '==', voucherNo));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { id: '', data: null };
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, data: doc.data() as Voucher };
  }

  /**
   * Get next event serial number for a voucher
   */
  static async getNextEventSerialNumber(voucherNo: string): Promise<number> {
    const voucherDoc = await this.getVoucherByNumber(voucherNo);
    if (!voucherDoc.data) {
      return 1;
    }

    return (voucherDoc.data.events?.length || 0) + 1;
  }

  /**
   * Add a receive event to an existing voucher
   */
  static async addReceiveEvent(params: {
    voucherNo: string;
    userId: string;
    quantityReceived: number;
    damagedOnArrival?: number;
    missing?: number;
    damageReason?: string;
    comment: string;
    parentEventId?: string;
  }): Promise<void> {
    const voucherDoc = await this.getVoucherByNumber(params.voucherNo);
    if (!voucherDoc.data) {
      throw new Error('Voucher not found');
    }

    const voucher = voucherDoc.data;
    const eventSerialNo = await this.getNextEventSerialNumber(params.voucherNo);
    const receiveEventId = generateEventId(params.voucherNo, eventSerialNo);

    const receiveEvent: VoucherEvent = {
      event_id: receiveEventId,
      parent_event_id: params.parentEventId,
      event_type: 'receive',
      timestamp: new Date().toISOString(),
      user_id: params.userId,
      comment: params.comment,
      details: {
        quantity_received: params.quantityReceived,
        discrepancies: {
          damaged_on_arrival: params.damagedOnArrival || 0,
          missing: params.missing || 0,
          damage_reason: params.damageReason || null
        }
      }
    };

    // Update voucher with new event and status
    const updatedEvents = [...voucher.events, receiveEvent];
    const newStatus = determineNewStatus(voucher, 'receive', receiveEvent);

    // Create updated voucher data with new events for proper totals calculation
    const updatedVoucherData = {
      ...voucher,
      events: updatedEvents
    };
    const statusUpdate = updateVoucherStatus(updatedVoucherData, newStatus);

    await updateDoc(doc(db, 'vouchers', voucherDoc.id), {
      events: updatedEvents,
      ...statusUpdate,
      updatedAt: serverTimestamp()
    });

    // Send notification for receive event
    await notificationService.sendEventNotifications({
      voucherNo: params.voucherNo,
      eventType: receiveEvent.event_type,
      eventId: receiveEvent.event_id,
      receiverId: params.userId,
      adminId: voucher.created_by_user_id,
      itemName: voucher.item_details.item_name,
      quantity: params.quantityReceived
    });
  }

  /**
   * Add a forward event to an existing voucher
   */
  static async addForwardEvent(params: {
    voucherNo: string;
    userId: string;
    receiverId: string;
    quantityForwarded: number;
    damagedDuringJob?: number;
    damageReason?: string;
    lrNo?: string;
    lrDate?: string;
    transporterName?: string;
    comment: string;
    parentEventId?: string;
  }): Promise<void> {
    const voucherDoc = await this.getVoucherByNumber(params.voucherNo);
    if (!voucherDoc.data) {
      throw new Error('Voucher not found');
    }

    const voucher = voucherDoc.data;
    const eventSerialNo = await this.getNextEventSerialNumber(params.voucherNo);
    const forwardEventId = generateEventId(params.voucherNo, eventSerialNo);

    const forwardEvent: VoucherEvent = {
      event_id: forwardEventId,
      parent_event_id: params.parentEventId,
      event_type: 'forward',
      timestamp: new Date().toISOString(),
      user_id: params.userId,
      comment: params.comment,
      details: {
        sender_id: params.userId,
        receiver_id: params.receiverId,
        quantity_forwarded: params.quantityForwarded,
        discrepancies: {
          damaged_after_job: params.damagedDuringJob || 0,
          damage_reason: params.damageReason || null
        },
        transport: {
          lr_no: params.lrNo || '',
          lr_date: params.lrDate || '',
          transporter_name: params.transporterName || ''
        }
      }
    };

    // Update voucher with new event and status
    const updatedEvents = [...voucher.events, forwardEvent];
    const newStatus = determineNewStatus(voucher, 'forward', forwardEvent);

    // Create updated voucher data with new events for proper totals calculation
    const updatedVoucherData = {
      ...voucher,
      events: updatedEvents
    };
    const statusUpdate = updateVoucherStatus(updatedVoucherData, newStatus);

    await updateDoc(doc(db, 'vouchers', voucherDoc.id), {
      events: updatedEvents,
      ...statusUpdate,
      updatedAt: serverTimestamp()
    });

    // Send notification for forward event
    await notificationService.sendEventNotifications({
      voucherNo: params.voucherNo,
      eventType: forwardEvent.event_type,
      eventId: forwardEvent.event_id,
      receiverId: params.receiverId,
      adminId: voucher.created_by_user_id,
      itemName: voucher.item_details.item_name,
      quantity: params.quantityForwarded
    });
  }

  /**
   * Add an admin receive event (for completion)
   */
  static async addAdminReceiveEvent(params: {
    voucherNo: string;
    adminId: string;
    quantityReceived: number;
    comment: string;
  }): Promise<void> {
    const voucherDoc = await this.getVoucherByNumber(params.voucherNo);
    if (!voucherDoc.data) {
      throw new Error('Voucher not found');
    }

    const voucher = voucherDoc.data;
    const eventSerialNo = await this.getNextEventSerialNumber(params.voucherNo);
    const receiveEventId = generateEventId(params.voucherNo, eventSerialNo);

    const receiveEvent: VoucherEvent = {
      event_id: receiveEventId,
      event_type: 'receive',
      timestamp: new Date().toISOString(),
      user_id: params.adminId,
      comment: params.comment,
      details: {
        receiver_id: params.adminId,
        quantity_received: params.quantityReceived
      }
    };

    // Update voucher with new event and status
    const updatedEvents = [...voucher.events, receiveEvent];
    const newStatus = determineNewStatus(voucher, 'receive', receiveEvent);

    // Create updated voucher data with new events for proper totals calculation
    const updatedVoucherData = {
      ...voucher,
      events: updatedEvents
    };
    const statusUpdate = updateVoucherStatus(updatedVoucherData, newStatus);

    await updateDoc(doc(db, 'vouchers', voucherDoc.id), {
      events: updatedEvents,
      ...statusUpdate,
      updatedAt: serverTimestamp()
    });
  }
}
