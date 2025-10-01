'use client';

import React, { useState, useEffect } from 'react';
import { Voucher, VoucherEvent } from '@/types/voucher';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Package,
  Truck,
  CreditCard,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
  Building,
  Phone,
  Mail,
  Calendar,
  Hash,
  DollarSign,
  Briefcase,
  Settings,
  ArrowRight,
  AlertCircle,
  X,
  MessageSquare
} from 'lucide-react';
import { ImageContainer } from './ImageContainer';
import { db } from '@/config/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { generateVoucherPDF } from '@/utils/pdfGenerator';

interface VoucherDetailsProps {
  voucher: Voucher;
  onClose?: () => void;
  refreshKey?: number;
}

export default function VoucherDetails({ voucher, onClose, refreshKey }: VoucherDetailsProps) {
  // Get all images
  const allImages = [
    ...(voucher.item_details.images || [])
  ];

  // --- User name mapping state and logic ---
  const [userNames, setUserNames] = useState<Record<string, { name: string; userCode: string; vendorJobWork?: string }>>({});
  const [paymentInfo, setPaymentInfo] = useState<{ needed: any[]; completed: any[] }>({ needed: [], completed: [] });

  // Helper to fetch user display name and userCode from Firestore
  const fetchUserName = async (uid: string) => {
    if (!uid) return { name: uid, userCode: '', vendorJobWork: '' };
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        let name = (data.firstName || '') + (data.surname ? ' ' + data.surname : '');
        name = name.trim();
        if (data.companyName) {
          name = name ? `${name} (${data.companyName})` : data.companyName;
        }
        return { name: name || '-', userCode: data.userCode || '', vendorJobWork: data.vendorJobWork || '' };
      }
    } catch { }
    return { name: uid, userCode: '', vendorJobWork: '' };
  };

  // Collect all unique user IDs (admin, sender, receiver) and fetch names
  useEffect(() => {
    const userIds = new Set<string>();
    if (voucher.created_by_user_id) userIds.add(voucher.created_by_user_id);
    voucher.events.forEach(event => {
      if (event.details.sender_id) userIds.add(event.details.sender_id);
      if (event.details.receiver_id) userIds.add(event.details.receiver_id);
      if (event.user_id) userIds.add(event.user_id);
    });
    const missing = Array.from(userIds).filter(uid => !userNames[uid]);
    if (missing.length === 0) return;
    Promise.all(missing.map(uid => fetchUserName(uid))).then(results => {
      const updates: Record<string, { name: string; userCode: string; vendorJobWork?: string }> = {};
      missing.forEach((uid, i) => { updates[uid] = results[i]; });
      setUserNames(prev => ({ ...prev, ...updates }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucher]);

  // Fetch payment information
  useEffect(() => {
    const fetchPaymentInfo = async () => {
      try {
        // Get all forward events that have price_per_piece (indicating work done)
        const forwardEvents = voucher.events.filter(event =>
          event.event_type === 'forward' &&
          event.details.price_per_piece &&
          event.details.price_per_piece > 0
        );

        if (forwardEvents.length === 0) {
          setPaymentInfo({ needed: [], completed: [] });
          return;
        }

        // Fetch all payments for this voucher
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('voucherId', '==', voucher.id)
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);

        // Index payments per forward event when available; fallback to vendor+jobWork
        const paymentsByEvent: Record<string, number> = {};
        const paymentsByVendorAndJob: Record<string, number> = {};
        const paymentsByVendorOnly: Record<string, number> = {};
        paymentsSnapshot.forEach(docSnap => {
          const paymentData = docSnap.data() as any;
          const forwardEventId = paymentData.forwardEventId as string | undefined;
          const vendorIdInPayment = paymentData.vendorId;
          const jobWorkInPayment = (paymentData.jobWorkDone || 'N/A') as string;
          const keyedByBoth = `${vendorIdInPayment}_${jobWorkInPayment}`;
          const amount = Number(paymentData.amountPaid || 0);
          if (forwardEventId) {
            paymentsByEvent[forwardEventId] = (paymentsByEvent[forwardEventId] || 0) + amount;
          }
          paymentsByVendorAndJob[keyedByBoth] = (paymentsByVendorAndJob[keyedByBoth] || 0) + amount;
          if (vendorIdInPayment) {
            paymentsByVendorOnly[vendorIdInPayment] = (paymentsByVendorOnly[vendorIdInPayment] || 0) + amount;
          }
        });

        const needed: any[] = [];
        const completed: any[] = [];

        forwardEvents.forEach(event => {
          const vendorId = event.details.sender_id;  // Changed from receiver_id to sender_id
          if (!vendorId) return; // Skip if no vendor ID

          // Prefer event jobWork, else fall back to vendor profile job work
          const vendorProfileJobWork = userNames[vendorId]?.vendorJobWork || '';
          const jobWork = (event.details.jobWork || vendorProfileJobWork || 'N/A');
          const pricePerPiece = event.details.price_per_piece || 0;
          const quantity = event.details.quantity_forwarded || 0;
          const totalAmount = pricePerPiece * quantity;

          // Prefer exact per-event payments, fallback to vendor+jobWork or vendor-only legacy aggregation
          const amountPaid = (paymentsByEvent[event.event_id] ?? paymentsByVendorAndJob[`${vendorId}_${jobWork}`] ?? paymentsByVendorOnly[vendorId] ?? 0);
          const pendingAmount = totalAmount - amountPaid;

          const vendorName = userNames[vendorId]?.name || vendorId;
          const vendorCode = userNames[vendorId]?.userCode || 'N/A';

          const paymentRecord = {
            id: `${voucher.id}_${event.event_id}`,
            vendor: vendorName,
            vendorCode: vendorCode,
            jobWork: jobWork,
            amount: totalAmount,
            paidAmount: amountPaid,
            pendingAmount: pendingAmount,
            paymentStatus: amountPaid === 0 ? 'Unpaid' : (pendingAmount > 0 ? 'Partially Paid' : 'Fully Paid'),
            eventId: event.event_id,
            timestamp: event.timestamp
          };

          if (pendingAmount > 0) {
            needed.push(paymentRecord);
          } else {
            completed.push(paymentRecord);
          }
        });

        setPaymentInfo({ needed, completed });
      } catch (error) {
        console.error('Error fetching payment info:', error);
        setPaymentInfo({ needed: [], completed: [] });
      }
    };

    if (voucher.id) {
      fetchPaymentInfo();
    }
  }, [voucher, userNames, refreshKey]);

  // Get the initial dispatch event for transport and admin details
  const initialDispatchEvent = voucher.events.find(e => e.event_type === 'dispatch');

  // Get admin details (creator)
  const adminName = userNames[voucher.created_by_user_id]?.name || 'Unknown Admin';
  const adminCode = userNames[voucher.created_by_user_id]?.userCode || 'N/A';

  // Get supplier details
  const supplierDetails = {
    name: voucher.item_details.supplier_name || 'N/A',
    costPerPiece: voucher.item_details.supplier_price_per_piece || 0,
    totalCost: (voucher.item_details.supplier_price_per_piece || 0) * voucher.item_details.initial_quantity,
    quantity: voucher.item_details.initial_quantity
  };

  // Get transport details
  const transportDetails = {
    name: initialDispatchEvent?.details.transport?.transporter_name || 'N/A',
    lrNumber: initialDispatchEvent?.details.transport?.lr_no || 'N/A',
    lrDate: initialDispatchEvent?.details.transport?.lr_date || 'N/A'
  };

  // Get journey progression
  interface JourneyStep {
    id: string;
    vendor: string;
    vendorCode: string;
    action: 'dispatch' | 'receive' | 'forward' | 'completed';
    timestamp: string;
    qtyReceived?: number;
    qtyForwarded?: number;
    damagedOnArrival?: number;
    comment: string;
    jobWork?: string | null;
  }

  const journeySteps: JourneyStep[] = voucher.events.map(event => {
    const userId = event.details.receiver_id || event.details.sender_id || '';
    return {
      id: event.event_id,
      vendor: userNames[userId]?.name || userId || 'N/A',
      vendorCode: userNames[userId]?.userCode || '',
      action: event.event_type,
      timestamp: event.timestamp,
      qtyReceived: event.details.quantity_received,
      qtyForwarded: event.details.quantity_forwarded,
      damagedOnArrival: event.details.discrepancies?.damaged_on_arrival || 0,
      comment: event.comment,
      jobWork: event.details.jobWork || null
    };
  });

  // Add completion step if voucher is completed
  if (voucher.voucher_status?.toLowerCase() === 'completed' || voucher.voucher_status === 'Completed') {
    journeySteps.push({
      id: 'completion-step',
      vendor: adminName,
      vendorCode: adminCode,
      action: 'completed',
      timestamp: voucher.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      qtyReceived: voucher.admin_received_quantity || 0,
      qtyForwarded: 0,
      damagedOnArrival: 0,
      comment: 'Voucher completed and returned to admin',
      jobWork: null
    });
  }

  // Handle print functionality
  const handlePrint = async () => {
    try {
      const doc = await generateVoucherPDF(voucher);
      doc.save(`voucher-${voucher.voucher_no}.pdf`);
    } catch (error) {
      console.error('Error printing voucher:', error);
      alert('Failed to print voucher. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Fixed Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-t-lg flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Voucher #{voucher.voucher_no}
              </h2>
              <div className="flex items-center mt-1 space-x-3">
                <span className="flex items-center text-blue-100 text-sm">
                  <Calendar className="h-3 w-3 mr-1" />
                  {(() => {
                    const date = new Date(voucher.created_at);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = date.toLocaleString('en-US', { month: 'short' });
                    const year = date.getFullYear();
                    return `${day}-${month}-${year}`;
                  })()}
                </span>
                <span className={`px-2 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${voucher.voucher_status?.toLowerCase() === 'completed' ? 'bg-green-100 text-green-800' :
                  voucher.voucher_status?.toLowerCase() === 'dispatched' ? 'bg-yellow-100 text-yellow-800' :
                    voucher.voucher_status?.toLowerCase() === 'received' ? 'bg-blue-100 text-blue-800' :
                      voucher.voucher_status?.toLowerCase() === 'forwarded' ? 'bg-orange-100 text-orange-800' :
                        voucher.voucher_status?.toLowerCase() === 'partially_received' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                  }`}>
                  {voucher.voucher_status?.toLowerCase() === 'completed' && (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  {voucher.voucher_status}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePrint}
                className="flex items-center px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-400 transition-colors text-sm"
              >
                <FileText className="h-4 w-4 mr-1" />
                Print
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-blue-100 hover:text-white text-xl font-bold"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Images Section */}
          {allImages.length > 0 && (
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h3 className="text-base font-semibold text-blue-800 border-b border-blue-200 pb-2 mb-3 flex items-center">
                <Package className="h-4 w-4 mr-2 text-blue-600" />
                Voucher Images
              </h3>
              <div className="flex justify-center">
                <ImageContainer
                  images={allImages}
                  size="lg"
                  className="shadow-lg"
                />
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <h3 className="text-base font-semibold text-blue-800 border-b border-blue-200 pb-2 mb-3 flex items-center">
              <Package className="h-4 w-4 mr-2 text-blue-600" />
              Item Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <span className="text-xs text-gray-500">Item:</span>
                <p className="font-medium text-gray-900 text-sm">{voucher.item_details.item_name}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Quantity:</span>
                <p className="font-medium text-gray-900 text-sm">{voucher.item_details.initial_quantity} pieces</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Job Work:</span>
                <p className="font-medium text-gray-900 text-sm">{journeySteps.find(s => s.jobWork)?.jobWork || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Admin and Supplier Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Admin Details */}
            <div className="bg-white border border-blue-200 rounded-lg p-4 hover:shadow-blue-md transition-shadow">
              <h3 className="text-base font-semibold text-blue-800 border-b border-blue-200 pb-2 mb-3 flex items-center">
                <User className="h-4 w-4 mr-2 text-blue-600" />
                Admin Details
              </h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 w-20">Name:</span>
                  <span className="font-medium text-gray-900 text-sm">{adminName}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 w-20">Code:</span>
                  <span className="font-medium text-blue-700 text-sm">{adminCode}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 w-20">Designation:</span>
                  <span className="font-medium text-gray-900 text-sm">{'Admin'}</span>
                </div>
              </div>
            </div>

            {/* Supplier Details */}
            <div className="bg-white border border-blue-200 rounded-lg p-4 hover:shadow-blue-md transition-shadow">
              <h3 className="text-base font-semibold text-blue-800 border-b border-blue-200 pb-2 mb-3 flex items-center">
                <Building className="h-4 w-4 mr-2 text-blue-600" />
                Supplier Details
              </h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 w-24">Name:</span>
                  <span className="font-medium text-gray-900 text-sm">{supplierDetails.name}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 w-24">Cost per Piece:</span>
                  <span className="font-medium text-green-700 text-sm">₹{supplierDetails.costPerPiece.toLocaleString()}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 w-24">Quantity:</span>
                  <span className="font-medium text-gray-900 text-sm">{supplierDetails.quantity}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 w-24">Total Cost:</span>
                  <span className="font-medium text-green-700 text-sm">₹{supplierDetails.totalCost.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Job Progression */}
          {journeySteps.length > 0 && (
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h3 className="text-base font-semibold text-blue-800 border-b border-blue-200 pb-2 mb-3 flex items-center">
                <Settings className="h-4 w-4 mr-2 text-blue-600" />
                Job Progression
              </h3>
              <div className="space-y-3">
                {journeySteps.map((step, index) => (
                  <div key={step.id} className={`flex items-center space-x-3 p-2 rounded-md ${step.action === 'completed' ? 'bg-green-50 border border-green-200' : 'bg-blue-50'
                    }`}>
                    <div className="flex-shrink-0">
                      <div className={`w-6 h-6 text-white rounded-full flex items-center justify-center text-xs font-bold ${step.action === 'completed' ? 'bg-green-600' : 'bg-blue-600'
                        }`}>
                        {step.action === 'completed' ? '✓' : index + 1}
                      </div>
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 text-sm">{step.vendor}</span>
                        <span className={`text-xs ${step.action === 'completed' ? 'text-green-600' : 'text-blue-600'}`}>({step.vendorCode})</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className={`text-xs font-medium ${step.action === 'completed' ? 'text-green-700' : 'text-blue-700'
                          }`}>
                          {step.action === 'completed' ? 'COMPLETED' : step.action}
                        </span>
                      </div>
                      {step.comment && (
                        <div className={`mt-1 p-1 border-l-2 rounded-r ${step.action === 'completed'
                          ? 'bg-green-50 border-green-300'
                          : 'bg-blue-50 border-blue-300'
                          }`}>
                          <p className={`text-xs ${step.action === 'completed' ? 'text-green-800' : 'text-blue-800'
                            }`}>
                            <MessageSquare className="h-3 w-3 inline mr-1" />
                            <span className="font-medium">Comment:</span> "{step.comment}"
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(step.timestamp).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transport Details */}
          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <h3 className="text-base font-semibold text-blue-800 border-b border-blue-200 pb-2 mb-3 flex items-center">
              <Truck className="h-4 w-4 mr-2 text-blue-600" />
              Transport Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <span className="text-xs text-gray-500">Transport Name:</span>
                <p className="font-medium text-gray-900 text-sm">{transportDetails.name}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">LR Number:</span>
                <p className="font-medium text-gray-900 text-sm">{transportDetails.lrNumber}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">LR Date:</span>
                <p className="font-medium text-gray-900 text-sm">
                  {transportDetails.lrDate && transportDetails.lrDate !== 'N/A'
                    ? new Date(transportDetails.lrDate).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })
                    : 'N/A'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Payments Needed */}
            <div className="bg-white border border-red-200 rounded-lg p-4">
              <h3 className="text-base font-semibold text-red-800 border-b border-red-200 pb-2 mb-3 flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
                Payments Due ({paymentInfo.needed.length})
              </h3>
              {paymentInfo.needed.length > 0 ? (
                <div className="space-y-2">
                  {paymentInfo.needed.map((payment: any, index) => (
                    <div key={`${payment.id}-${index}`} className="bg-red-50 p-2 rounded-md">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{payment.vendor} ({payment.vendorCode})</p>
                          <p className="text-xs text-gray-600">{payment.jobWork}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Status: <span className={`font-medium ${payment.paymentStatus === 'Unpaid' ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                              {payment.paymentStatus}
                            </span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-red-700 text-sm">₹{payment.amount.toLocaleString()}</p>
                          {payment.paidAmount > 0 && (
                            <p className="text-xs text-green-600">Paid: ₹{payment.paidAmount.toLocaleString()}</p>
                          )}
                          <p className="text-xs text-red-600 font-medium">
                            Pending: ₹{payment.pendingAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 p-2 bg-red-100 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-red-800 text-sm">Total Pending:</span>
                      <span className="font-bold text-red-900 text-base">
                        ₹{paymentInfo.needed.reduce((sum, payment: any) => sum + payment.pendingAmount, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 text-gray-500">
                  <CreditCard className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                  <p className="text-sm">No pending payments</p>
                </div>
              )}
            </div>

            {/* Payments Completed */}
            <div className="bg-white border border-green-200 rounded-lg p-4">
              <h3 className="text-base font-semibold text-green-800 border-b border-green-200 pb-2 mb-3 flex items-center">
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                Payments Completed ({paymentInfo.completed.length})
              </h3>
              {paymentInfo.completed.length > 0 ? (
                <div className="space-y-2">
                  {paymentInfo.completed.map((payment: any, index) => (
                    <div key={`${payment.id}-${index}`} className="bg-green-50 p-2 rounded-md">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{payment.vendor} ({payment.vendorCode})</p>
                          <p className="text-xs text-gray-600">{payment.jobWork}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-700 text-sm">₹{payment.amount.toLocaleString()}</p>
                          <span className="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded-full">
                            Fully Paid
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 p-2 bg-green-100 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-green-800 text-sm">Total Paid:</span>
                      <span className="font-bold text-green-900 text-base">
                        ₹{paymentInfo.completed.reduce((sum, payment: any) => sum + payment.amount, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 text-gray-500">
                  <DollarSign className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                  <p className="text-sm">No completed payments</p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Info */}
          {/* {voucher.comment && (
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h3 className="text-base font-semibold text-blue-800 border-b border-blue-200 pb-2 mb-3 flex items-center">
                <FileText className="h-4 w-4 mr-2 text-blue-600" />
                Comments
              </h3>
              <p className="text-gray-700 text-sm">{voucher.comment}</p>
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
}
