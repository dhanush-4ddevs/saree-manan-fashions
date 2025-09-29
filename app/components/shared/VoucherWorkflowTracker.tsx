'use client';
import { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle,
  Users,
  AlertTriangle,
  CalendarDays,
  Truck,
  Package,
  ArrowRight,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  CheckCircle2,
  Grid3X3,
  History
} from 'lucide-react';
import { Voucher, VoucherEvent, calculateTotalQuantityReceived, calculateTotalQuantityForwarded, calculateTotalDamage, getCurrentAvailableQuantity, getSortedVoucherEvents } from '../../types/voucher';
import { db } from '../../config/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import React from 'react';
import { PrintPreviewModal } from './PrintPreviewModal';
import { Printer } from 'lucide-react';

interface VoucherWorkflowTrackerProps {
  voucherId?: string;
}

type ViewMode = 'chronological' | 'vendor';

const formatDate = (dateInput: any): string => {
  if (!dateInput) return 'Not available';

  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Not available';

    // Use toLocaleString with specific options to ensure consistent formatting
    return d.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata' // Use Indian Standard Time (IST)
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Not available';
  }
};

export default function VoucherWorkflowTracker({ voucherId }: VoucherWorkflowTrackerProps) {
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('chronological');
  const [userNames, setUserNames] = useState<{ [uid: string]: string }>({});
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Helper to fetch user display name from Firestore
  const fetchUserName = async (uid: string) => {
    if (!uid) return uid;
    if (uid === 'admin') return 'Admin'; // Handle generic admin case
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        let name = (data.firstName || '') + (data.surname ? ' ' + data.surname : '');
        name = name.trim();
        if (data.companyName) {
          return name ? `${name} (${data.companyName})` : data.companyName;
        } else {
          return name || '-';
        }
      }
    } catch { }
    return uid;
  };

  // On voucher load, fetch all unique user IDs in events
  useEffect(() => {
    if (!voucher) return;
    const events = getSortedVoucherEvents(voucher);
    const userIds = new Set<string>();
    events.forEach((event: VoucherEvent) => {
      if (event.details.sender_id) userIds.add(event.details.sender_id);
      if (event.details.receiver_id) userIds.add(event.details.receiver_id);
      if (event.user_id) userIds.add(event.user_id);
    });
    const missing = Array.from(userIds).filter(uid => !userNames[uid]);
    if (missing.length === 0) return;
    // Handle generic 'admin' case directly
    const updates: { [uid: string]: string } = {};
    const toFetch = missing.filter(uid => {
      if (uid === 'admin') {
        updates[uid] = 'Admin';
        return false;
      }
      return true;
    });

    if (toFetch.length > 0) {
      Promise.all(toFetch.map(uid => fetchUserName(uid))).then(names => {
        toFetch.forEach((uid, i) => { updates[uid] = names[i]; });
        setUserNames(prev => ({ ...prev, ...updates }));
      });
    } else {
      setUserNames(prev => ({ ...prev, ...updates }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucher]);

  const toggleVendorExpansion = (vendorKey: string) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorKey)) {
      newExpanded.delete(vendorKey);
    } else {
      newExpanded.add(vendorKey);
    }
    setExpandedVendors(newExpanded);
  };

  useEffect(() => {
    if (!voucherId) {
      setLoading(false);
      return;
    }
    const voucherRef = doc(db, 'vouchers', voucherId);
    const unsubscribe = onSnapshot(voucherRef, (voucherSnapshot) => {
      if (voucherSnapshot.exists()) {
        const voucherData = voucherSnapshot.data() as Voucher;
        setVoucher({ ...voucherData, id: voucherId });
        setLastUpdated(new Date());
      } else {
        setVoucher(null);
      }
      setLoading(false);
    }, (error) => {
      setVoucher(null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [voucherId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="ml-3 text-blue-600">Loading voucher details...</p>
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">No voucher selected</h2>
        <p className="text-gray-500 mt-2">Please select a voucher to view its workflow.</p>
      </div>
    );
  }

  // Timeline: chronological events
  const events = getSortedVoucherEvents(voucher);

  // Add completion step if voucher is completed
  const allEvents = [...events];
  if (voucher.voucher_status?.toLowerCase() === 'completed') {
    // Create a completion event
    const completionEvent: any = {
      event_id: 'completion-step',
      event_type: 'completed',
      timestamp: voucher.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      user_id: voucher.created_by_user_id,
      comment: 'Voucher completed and returned to admin',
      details: {
        quantity_received: voucher.admin_received_quantity || 0,
        jobWork: undefined
      }
    };
    allEvents.push(completionEvent);
  }

  // Vendor grouping: group by user_id, sender_id, receiver_id
  const vendorMap = new Map<string, { actions: VoucherEvent[] }>();
  allEvents.forEach((event: VoucherEvent) => {
    let vendorKey: string | undefined;
    if (event.event_type === 'dispatch' || event.event_type === 'forward') {
      vendorKey = event.details.sender_id;
    } else if (event.event_type === 'receive') {
      vendorKey = event.details.receiver_id;
    } else if ((event as any).event_type === 'completed') {
      vendorKey = event.user_id; // For completed events, use the user_id (admin)
    }
    if (!vendorKey) vendorKey = event.user_id;
    if (!vendorKey) return;
    if (!vendorMap.has(vendorKey)) vendorMap.set(vendorKey, { actions: [] });
    vendorMap.get(vendorKey)!.actions.push(event);
  });

  // Status and quantities
  const totalReceived = calculateTotalQuantityReceived(allEvents);
  const totalForwarded = calculateTotalQuantityForwarded(allEvents);
  const totalDamage = calculateTotalDamage(allEvents);
  const availableQty = getCurrentAvailableQuantity(voucher);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-blue-800 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Voucher Status: #{voucher.voucher_no}
        </h2>
        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <div className="text-xs text-gray-500 mr-2">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" title="Real-time tracking active"></div>
                <span className="text-green-600 font-medium">Live</span>
              </div>
              <div>Last sync: {lastUpdated.toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              })}</div>
            </div>
          )}
          <button
            onClick={() => setShowPrintPreview(true)}
            disabled={!voucher}
            className="flex items-center px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4 mr-1" />
            Print Preview
          </button>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Workflow View</h3>
        <div className="flex space-x-1 bg-white rounded-lg p-1 border border-gray-300">
          <button
            onClick={() => setViewMode('chronological')}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'chronological'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            <History className="h-4 w-4 mr-2" />
            Chronological
          </button>
          <button
            onClick={() => setViewMode('vendor')}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'vendor'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            <Users className="h-4 w-4 mr-2" />
            By Vendor
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {viewMode === 'chronological' && "View all workflow events in chronological order"}
          {viewMode === 'vendor' && "View workflow organized by vendor activities"}
        </p>
      </div>

      {/* Chronological Workflow Timeline - Conditional Rendering */}
      {viewMode === 'chronological' && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
            <CalendarDays className="h-5 w-5 mr-2" />
            Chronological Workflow
          </h3>
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-200"></div>
            <div className="space-y-4">
              {allEvents.map((event: VoucherEvent, index: number) => (
                <div key={event.event_id} className="relative flex items-start space-x-3">
                  <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-3 border-white shadow-md ${event.event_type === 'dispatch' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                    event.event_type === 'receive' ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                      event.event_type === 'forward' ? 'bg-gradient-to-br from-orange-500 to-orange-600' :
                        (event as any).event_type === 'completed' ? 'bg-gradient-to-br from-green-500 to-green-600' :
                          'bg-gradient-to-br from-green-500 to-green-600'
                    }`}>
                    {event.event_type === 'dispatch' ? <FileText className="h-4 w-4 text-white" /> :
                      event.event_type === 'receive' ? <CheckCircle className="h-4 w-4 text-white" /> :
                        event.event_type === 'forward' ? <ArrowRight className="h-4 w-4 text-white" /> :
                          (event as any).event_type === 'completed' ? <CheckCircle2 className="h-4 w-4 text-white" /> :
                            <Package className="h-4 w-4 text-white" />
                    }
                  </div>
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-md hover:shadow-lg transition-shadow duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900 flex items-center">
                          {event.event_type === 'dispatch' && <FileText className="h-3 w-3 mr-2 text-blue-600" />}
                          {event.event_type === 'receive' && <CheckCircle className="h-3 w-3 mr-2 text-purple-600" />}
                          {event.event_type === 'forward' && <ArrowRight className="h-3 w-3 mr-2 text-orange-600" />}
                          {(event as any).event_type === 'completed' && <CheckCircle2 className="h-3 w-3 mr-2 text-green-600" />}
                          {event.event_type !== 'dispatch' && event.event_type !== 'receive' && event.event_type !== 'forward' && (event as any).event_type !== 'completed' && <Package className="h-3 w-3 mr-2 text-green-600" />}
                          {(event as any).event_type === 'completed' ? 'COMPLETED' : event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1)}
                        </h4>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full font-medium">
                          {formatDate(event.timestamp)}
                        </span>
                      </div>

                      {/* Participants Section */}
                      {(event.details.sender_id || event.details.receiver_id) && (
                        <div className="mb-3 p-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                          <div className="text-blue-800 text-xs">
                            {event.event_type === 'receive' ? (
                              <>
                                {event.details.receiver_id && (
                                  <div className="flex items-center mb-1">
                                    <User className="h-3 w-3 mr-1 text-purple-600" />
                                    <span className="font-medium">Received by: {userNames[event.details.receiver_id] || event.details.receiver_id}</span>
                                  </div>
                                )}
                                {event.details.sender_id && (
                                  <div className="flex items-center">
                                    <User className="h-3 w-3 mr-1 text-blue-600" />
                                    <span className="font-medium">From: {userNames[event.details.sender_id] || event.details.sender_id}</span>
                                  </div>
                                )}
                                {/* Handle case where sender_id is missing for admin receive events */}
                                {!event.details.sender_id && event.details.receiver_id && (
                                  (() => {
                                    // First try to find the parent forward event using parent_event_id
                                    if (event.parent_event_id) {
                                      const parentEvent = allEvents.find(e => e.event_id === event.parent_event_id);
                                      if (parentEvent && parentEvent.event_type === 'forward' && parentEvent.details.sender_id) {
                                        return (
                                          <div className="flex items-center">
                                            <User className="h-3 w-3 mr-1 text-blue-600" />
                                            <span className="font-medium">From: {userNames[parentEvent.details.sender_id] || parentEvent.details.sender_id}</span>
                                          </div>
                                        );
                                      }
                                    }

                                    // Fallback: Find the previous forward event to determine who sent it
                                    const currentIndex = allEvents.findIndex(e => e.event_id === event.event_id);
                                    if (currentIndex > 0) {
                                      const previousEvent = allEvents[currentIndex - 1];
                                      if (previousEvent.event_type === 'forward' && previousEvent.details.receiver_id === event.details.receiver_id && previousEvent.details.sender_id) {
                                        return (
                                          <div className="flex items-center">
                                            <User className="h-3 w-3 mr-1 text-blue-600" />
                                            <span className="font-medium">From: {userNames[previousEvent.details.sender_id] || previousEvent.details.sender_id}</span>
                                          </div>
                                        );
                                      }
                                    }
                                    return null;
                                  })()
                                )}
                              </>
                            ) : (
                              <>
                                {event.details.sender_id && (
                                  <div className="flex items-center mb-1">
                                    <User className="h-3 w-3 mr-1 text-blue-600" />
                                    <span className="font-medium">From: {userNames[event.details.sender_id] || event.details.sender_id}</span>
                                  </div>
                                )}
                                {event.details.receiver_id && (
                                  <div className="flex items-center">
                                    <User className="h-3 w-3 mr-1 text-purple-600" />
                                    <span className="font-medium">To: {userNames[event.details.receiver_id] || event.details.receiver_id}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Quantities Section */}
                      {(event.details.quantity_dispatched || event.details.quantity_received || event.details.quantity_forwarded) && (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-2">
                            {event.details.quantity_dispatched && (
                              <div className="flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-lg">
                                <Package className="h-3 w-3 mr-1" />
                                <span className="font-medium text-xs">Dispatched: {event.details.quantity_dispatched}</span>
                              </div>
                            )}
                            {event.details.quantity_received && (
                              <div className="flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-lg">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                <span className="font-medium text-xs">Received: {event.details.discrepancies?.damaged_on_arrival != null
                                  ? (event.details.quantity_received ?? 0) - event.details.discrepancies.damaged_on_arrival
                                  : event.details.quantity_received}</span>
                              </div>
                            )}
                            {event.details.quantity_forwarded && (
                              <div className="flex items-center px-2 py-1 bg-orange-100 text-orange-800 rounded-lg">
                                <ArrowRight className="h-3 w-3 mr-1" />
                                <span className="font-medium text-xs">Forwarded: {(event.details.quantity_forwarded)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Damage Information */}
                      {event.details.discrepancies && (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-2">
                            {event.event_type === 'receive' && (
                              <div className="flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 rounded-lg">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                <span className="font-medium text-xs">Missing on arrival: {event.details.discrepancies.missing}</span>
                              </div>
                            )}
                            {event.event_type === 'receive' && (
                              <div className="flex items-center px-2 py-1 bg-red-100 text-red-800 rounded-lg">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                <span className="font-medium text-xs">Damaged on arrival: {event.details.discrepancies.damaged_on_arrival}</span>
                                {event.details.discrepancies.damage_reason && (
                                  event.details.discrepancies.damage_reason === 'NA' ? (
                                    <span className="ml-1 text-xs">(no damage)</span>
                                  ) : (
                                    <span className="ml-1 text-xs">({event.details.discrepancies.damage_reason})</span>
                                  )
                                )}
                              </div>
                            )}
                            {event.event_type === 'forward' && (
                              <div className="flex items-center px-2 py-1 bg-orange-100 text-orange-800 rounded-lg">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                <span className="font-medium text-xs">Damage after job: {event.details.discrepancies.damaged_after_job}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Job Work */}
                      {event.details.jobWork && (
                        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center text-blue-800">
                            <Grid3X3 className="h-3 w-3 mr-1" />
                            <span className="font-medium text-xs">Job Work:</span>
                            <span className="ml-1 text-xs">{event.details.jobWork}</span>
                          </div>
                        </div>
                      )}

                      {/* Transport */}
                      {event.details.transport && (
                        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center text-green-800">
                            <Truck className="h-3 w-3 mr-1" />
                            <span className="font-medium text-xs">Transport:</span>
                            <span className="ml-1 text-xs">{event.details.transport.transporter_name}</span>
                            {event.details.transport.lr_no && (
                              <span className="ml-1 text-xs bg-green-100 px-1 py-0.5 rounded">LR: {event.details.transport.lr_no}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Comment */}
                      {event.comment && (
                        <div className="p-2 bg-gray-50 border-l-3 border-blue-400 rounded-r-lg">
                          <div className="flex items-start text-gray-700">
                            <MessageSquare className="h-3 w-3 mr-1 mt-0.5 text-gray-500 flex-shrink-0" />
                            <span className="italic text-xs">"{event.comment}"</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Workflow by Vendor - Conditional Rendering */}
      {viewMode === 'vendor' && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Workflow by Vendor
          </h3>
          <div className="space-y-4">
            {Array.from(vendorMap.entries()).map(([vendorKey, vendorData]) => {
              const isExpanded = expandedVendors.has(vendorKey);
              const hasActions = vendorData.actions.length > 0;
              return (
                <div key={vendorKey} className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div
                    className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors"
                    onClick={() => toggleVendorExpansion(vendorKey)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-full bg-gray-100">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-900 text-sm">
                          {userNames[vendorKey] || vendorKey}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {hasActions ? `${vendorData.actions.length} actions` : 'No Actions Yet'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isExpanded ?
                        <ChevronUp className="h-4 w-4 text-gray-400" /> :
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      }
                    </div>
                  </div>
                  {isExpanded && hasActions && (
                    <div className="px-4 pb-4 border-t border-gray-200">
                      <div className="space-y-3 mt-3">
                        {vendorData.actions.map((action, actionIndex) => (
                          <div key={action.event_id + actionIndex} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className={`p-2 rounded-full flex-shrink-0 ${action.event_type === 'dispatch' ? 'bg-blue-100' :
                              action.event_type === 'receive' ? 'bg-purple-100' :
                                action.event_type === 'forward' ? 'bg-orange-100' :
                                  (action as any).event_type === 'completed' ? 'bg-green-100' :
                                    'bg-gray-100'
                              }`}>
                              {action.event_type === 'dispatch' ? <FileText className="h-3 w-3 text-blue-600" /> :
                                action.event_type === 'receive' ? <CheckCircle className="h-3 w-3 text-purple-600" /> :
                                  action.event_type === 'forward' ? <ArrowRight className="h-3 w-3 text-orange-600" /> :
                                    (action as any).event_type === 'completed' ? <CheckCircle2 className="h-3 w-3 text-green-600" /> :
                                      <Package className="h-3 w-3 text-gray-600" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-sm font-semibold text-gray-900 capitalize">
                                  {(action as any).event_type === 'completed' ? 'COMPLETED' : action.event_type.charAt(0).toUpperCase() + action.event_type.slice(1)}
                                </h5>
                                <span className="text-xs text-gray-500 flex-shrink-0">
                                  {formatDate(action.timestamp)}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {action.details.quantity_dispatched && (
                                  <div className="flex items-center text-xs text-gray-700">
                                    <Package className="h-3 w-3 mr-2 text-gray-500" />
                                    <span className="font-medium">Dispatched: {action.details.quantity_dispatched}</span>
                                  </div>
                                )}
                                {action.details.jobWork && (
                                  <div className="text-xs text-gray-700">
                                    <span>Job Work: {action.details.jobWork}</span>
                                  </div>
                                )}
                                {action.details.transport && (
                                  <div className="flex items-center text-xs text-gray-700">
                                    <Truck className="h-3 w-3 mr-2 text-green-500" />
                                    <span className="font-medium">Transport: {action.details.transport.transporter_name}</span>
                                  </div>
                                )}
                                {action.details.transport?.lr_no && (
                                  <div className="text-xs text-gray-700 ml-5">
                                    <span>LR: {action.details.transport.lr_no}</span>
                                  </div>
                                )}
                                {action.comment && (
                                  <div className="flex items-center text-xs text-gray-700">
                                    <MessageSquare className="h-3 w-3 mr-2 text-gray-500" />
                                    <span className="italic">"{action.comment}"</span>
                                  </div>
                                )}
                                {action.details.quantity_received && (
                                  <div className="flex items-center text-xs text-gray-700">
                                    <CheckCircle className="h-3 w-3 mr-2 text-purple-500" />
                                    <span className="font-medium">Received: {action.details.discrepancies?.damaged_on_arrival != null
                                      ? (action.details.quantity_received ?? 0) - action.details.discrepancies.damaged_on_arrival
                                      : action.details.quantity_received}</span>
                                  </div>
                                )}
                                {action.details.quantity_forwarded && (
                                  <div className="flex items-center text-xs text-gray-700">
                                    <ArrowRight className="h-3 w-3 mr-2 text-orange-500" />
                                    <span className="font-medium">Forwarded: {(action.details.quantity_forwarded)}</span>
                                  </div>
                                )}
                                {action.details.discrepancies?.damaged_on_arrival && action.details.discrepancies.damaged_on_arrival > 0 && (
                                  <div className="flex items-center text-xs text-red-600">
                                    <AlertTriangle className="h-3 w-3 mr-2" />
                                    <span className="font-medium">Damaged on arrival: {action.details.discrepancies.damaged_on_arrival}</span>
                                  </div>
                                )}
                                {action.details.discrepancies?.missing && action.details.discrepancies.missing > 0 && (
                                  <div className="flex items-center text-xs text-yellow-600">
                                    <AlertTriangle className="h-3 w-3 mr-2" />
                                    <span className="font-medium">Missing on arrival: {action.details.discrepancies.missing}</span>
                                  </div>
                                )}
                                {action.details.discrepancies?.damaged_after_job && action.details.discrepancies.damaged_after_job > 0 && (
                                  <div className="flex items-center text-xs text-orange-600">
                                    <AlertTriangle className="h-3 w-3 mr-2" />
                                    <span className="font-medium">Damage after job: {action.details.discrepancies.damaged_after_job}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Print Preview Modal */}
      <PrintPreviewModal
        voucher={voucher}
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
      />
    </div>
  );
}
