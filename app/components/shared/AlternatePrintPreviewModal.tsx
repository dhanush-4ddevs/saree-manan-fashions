'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Voucher } from '@/types/voucher';
import { generateVoucherPDFAlt } from '@/utils/pdfGenerator';
import { X, Download, Printer, FileText, Calendar, Package, BadgeCheck } from 'lucide-react';
import { showCountdownToast } from '@/utils/toastUtils';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface AlternatePrintPreviewModalProps {
    voucher: Voucher | null;
    isOpen: boolean;
    onClose: () => void;
}

export function AlternatePrintPreviewModal({ voucher, isOpen, onClose }: AlternatePrintPreviewModalProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [vendor, setVendor] = useState<{ name: string; userCode?: string; companyName?: string; jobWork?: string } | null>(null);

    useEffect(() => {
        if (isOpen && voucher) {
            generatePreview();
        } else {
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
                setPdfUrl(null);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, voucher]);

    const generatePreview = async () => {
        if (!voucher) return;
        setLoading(true);
        setError(null);
        try {
            const doc = await generateVoucherPDFAlt(voucher);
            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
        } catch (e) {
            setError('Failed to generate PDF preview.');
        } finally {
            setLoading(false);
        }
    };

    // Fetch vendor details from the dispatch event's receiver_id
    useEffect(() => {
        const loadVendor = async () => {
            try {
                if (!voucher) {
                    setVendor(null);
                    return;
                }
                const dispatchEvent = voucher.events?.find(e => e.event_type === 'dispatch');
                const receiverId = dispatchEvent?.details?.receiver_id;
                if (!receiverId) {
                    setVendor(null);
                    return;
                }
                const docRef = doc(db, 'users', receiverId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data: any = snap.data();
                    const nameParts = [data.firstName, data.surname].filter(Boolean).join(' ').trim();
                    setVendor({
                        name: nameParts || data.companyName || 'N/A',
                        userCode: data.userCode || 'N/A',
                        companyName: data.companyName || 'N/A',
                        jobWork: data.vendorJobWork || dispatchEvent?.details?.jobWork || 'N/A',
                    });
                } else {
                    setVendor(null);
                }
            } catch {
                setVendor(null);
            }
        };
        loadVendor();
    }, [voucher]);

    const handleDownload = async () => {
        if (!voucher) return;
        try {
            showCountdownToast('Download started', 'info', 10000);
            const doc = await generateVoucherPDFAlt(voucher);
            doc.save(`voucher-${voucher.voucher_no}.pdf`);
        } catch (e) {
            // no-op
        }
    };

    const handlePrint = () => {
        const iframeWindow = iframeRef.current?.contentWindow;
        if (!iframeWindow) return;
        try {
            showCountdownToast('Print started', 'info', 10000);
            iframeWindow.focus();
            iframeWindow.print();
        } catch {
            // Fallback: open in new tab for printing
            if (pdfUrl) window.open(pdfUrl, '_blank');
        }
    };

    if (!isOpen) return null;

    const createdDate = voucher?.created_at
        ? new Date(voucher.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'N/A';

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2">
            <div className="bg-white w-full max-w-7xl max-h-[98vh] rounded-xl shadow-2xl overflow-hidden border border-gray-200">
                {/* Header - distinct styling */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-900 text-white">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="bg-blue-600 rounded-lg p-2">
                            <FileText className="h-4 w-4" />
                        </div>
                        <div className="truncate">
                            <div className="font-semibold truncate">Voucher Print Preview (Admin)</div>
                            <div className="text-xs text-gray-200 truncate">#{voucher?.voucher_no} • {voucher?.item_details.item_name}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownload}
                            disabled={loading}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md disabled:opacity-50"
                        >
                            <Download className="h-3 w-3" />
                            Download
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={!pdfUrl || loading}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md disabled:opacity-50"
                        >
                            <Printer className="h-3 w-3" />
                            Print
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-md hover:bg-white/10"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Content with side details panel */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 h-[calc(98vh-44px)]">
                    <div className="lg:col-span-1 border-r border-gray-200 bg-gray-50 p-3 overflow-auto">
                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-gray-700">Voucher Details</div>
                            <div className="rounded-lg bg-white border p-2">
                                <div className="flex items-center text-xs text-gray-700">
                                    <BadgeCheck className="h-3 w-3 text-blue-600 mr-1" />
                                    <span className="font-medium">Status:</span>
                                    <span className="ml-1">{voucher?.voucher_status || 'N/A'}</span>
                                </div>
                                <div className="flex items-center text-xs text-gray-700 mt-2">
                                    <Calendar className="h-3 w-3 text-emerald-600 mr-1" />
                                    <span className="font-medium">Created:</span>
                                    <span className="ml-1">{createdDate}</span>
                                </div>
                                <div className="flex items-center text-xs text-gray-700 mt-2">
                                    <Package className="h-3 w-3 text-orange-600 mr-1" />
                                    <span className="font-medium">Quantity:</span>
                                    <span className="ml-1">{voucher?.item_details.initial_quantity}</span>
                                </div>
                            </div>
                            <div className="text-xs font-semibold text-gray-700">Item</div>
                            <div className="rounded-lg bg-white border p-2 text-xs text-gray-700">
                                <div className="font-medium">{voucher?.item_details.item_name}</div>
                                {voucher?.item_details?.images?.length ? (
                                    <div className="mt-2 grid grid-cols-3 gap-1">
                                        {voucher.item_details.images.slice(0, 3).map((src, idx) => (
                                            <div key={idx} className="w-full aspect-[4/3] bg-gray-100 rounded overflow-hidden">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={src} alt="preview" className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-2 text-gray-400">No images</div>
                                )}
                            </div>
                            <div className="text-xs font-semibold text-gray-700">Vendor</div>
                            <div className="rounded-lg bg-white border p-2 text-xs text-gray-700">
                                {vendor ? (
                                    <div className="space-y-1">
                                        <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium ml-2 text-right">{vendor.name}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">Company</span><span className="font-medium ml-2 text-right">{vendor.companyName}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">Vendor Code</span><span className="font-medium ml-2 text-right">{vendor.userCode}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">Job Work</span><span className="font-medium ml-2 text-right">{vendor.jobWork}</span></div>
                                    </div>
                                ) : (
                                    <div className="text-gray-400">No vendor details</div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-3 h-full bg-white">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
                            </div>
                        ) : error ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-sm text-red-600">{error}</div>
                            </div>
                        ) : pdfUrl ? (
                            <iframe ref={iframeRef} src={pdfUrl} className="w-full h-full border-0" title="PDF Preview" />
                        ) : (
                            <div className="h-full flex items-center justify-center text-sm text-gray-500">No preview available</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
