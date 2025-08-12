'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Eye, FileText, Printer, Calendar, Package, CheckCircle } from 'lucide-react';
import { Voucher } from '@/types/voucher';
import { printSingleVoucher } from '@/utils/printsinglevoucher';

interface PrintPreviewModalProps {
    voucher: Voucher | null;
    isOpen: boolean;
    onClose: () => void;
}

export function PrintPreviewModal({ voucher, isOpen, onClose }: PrintPreviewModalProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && voucher) {
            generatePreview();
        } else {
            // Clean up PDF URL when modal closes
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
                setPdfUrl(null);
            }
        }
    }, [isOpen, voucher]);

    const generatePreview = async () => {
        if (!voucher) return;

        setLoading(true);
        setError(null);

        try {
            const doc = await printSingleVoucher(voucher);
            const pdfBlob = doc.output('blob');
            const url = URL.createObjectURL(pdfBlob);
            setPdfUrl(url);
        } catch (err) {
            console.error('Error generating PDF preview:', err);
            setError('Failed to generate PDF preview. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!voucher || !pdfUrl) return;

        try {
            const doc = await printSingleVoucher(voucher);
            doc.save(`voucher-${voucher.voucher_no}.pdf`);
        } catch (err) {
            console.error('Error downloading PDF:', err);
            alert('Failed to download PDF. Please try again.');
        }
    };

    const handleDownloadFirstPage = async () => {
        if (!voucher || !pdfUrl) return;

        try {
            const doc = await printSingleVoucher(voucher);
            const totalPages = (doc as any).getNumberOfPages ? doc.getNumberOfPages() : (doc as any).internal?.getNumberOfPages?.();
            if (typeof totalPages === 'number' && totalPages > 1) {
                for (let i = totalPages; i >= 2; i--) {
                    // Keep only the first page
                    doc.deletePage(i);
                }
            }
            doc.save(`voucher-${voucher.voucher_no}-p1.pdf`);
        } catch (err) {
            console.error('Error downloading first page PDF:', err);
            alert('Failed to download first page. Please try again.');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'dispatched':
                return 'text-orange-600 bg-orange-100';
            case 'received':
                return 'text-green-600 bg-green-100';
            case 'pending':
                return 'text-yellow-600 bg-yellow-100';
            case 'completed':
                return 'text-blue-600 bg-blue-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-1 sm:p-2">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[99vh] flex flex-col border border-gray-200 mx-1 sm:mx-2">
                {/* Enhanced Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 lg:p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl gap-2 sm:gap-3">
                    <div className="flex items-center">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 sm:p-3 rounded-lg mr-2 sm:mr-3 lg:mr-4 shadow-lg">
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 flex items-center">
                                <Printer className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 mr-1 sm:mr-2 text-blue-600" />
                                Print Preview
                            </h2>
                            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1 truncate">
                                Voucher: <span className="font-semibold text-blue-600">{voucher?.voucher_no}</span> - {voucher?.item_details.item_name}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
                        <button
                            onClick={handleDownload}
                            disabled={!pdfUrl || loading}
                            className="flex items-center px-2 sm:px-3 lg:px-4 xl:px-6 py-1.5 sm:py-2 lg:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-xs sm:text-sm lg:text-base font-medium"
                        >
                            <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 lg:mr-2" />
                            <span className="hidden sm:inline">Download PDF</span>
                            <span className="sm:hidden">Download</span>
                        </button>
                        <button
                            onClick={handleDownloadFirstPage}
                            disabled={!pdfUrl || loading}
                            className="flex items-center px-2 sm:px-3 lg:px-4 xl:px-6 py-1.5 sm:py-2 lg:py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 text-xs sm:text-sm lg:text-base font-medium"
                        >
                            <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 lg:mr-2" />
                            <span className="hidden sm:inline">Print 1 page</span>
                            <span className="sm:hidden">1 page</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 sm:p-2 lg:p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-110"
                        >
                            <X className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                    </div>
                </div>

                {/* Enhanced Content */}
                <div className="flex-1 overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
                    {loading ? (
                        <div className="flex items-center justify-center h-full p-3 sm:p-4">
                            <div className="text-center">
                                <div className="relative">
                                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-3 sm:mb-4 lg:mb-6"></div>
                                    <div className="absolute inset-0 rounded-full h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 border-4 border-transparent border-t-blue-400 animate-ping"></div>
                                </div>
                                <p className="text-gray-600 text-sm sm:text-base lg:text-lg font-medium">Generating PDF preview...</p>
                                <p className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-2">Please wait while we prepare your document</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full p-3 sm:p-4">
                            <div className="text-center max-w-sm sm:max-w-md">
                                <div className="bg-red-100 rounded-full p-2 sm:p-3 lg:p-4 mx-auto mb-3 sm:mb-4 lg:mb-6 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 flex items-center justify-center shadow-lg">
                                    <FileText className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-red-600" />
                                </div>
                                <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-red-800 mb-1 sm:mb-2">Preview Generation Failed</h3>
                                <p className="text-red-600 mb-3 sm:mb-4 lg:mb-6 text-xs sm:text-sm">{error}</p>
                                <button
                                    onClick={generatePreview}
                                    className="px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 lg:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg text-xs sm:text-sm lg:text-base font-medium"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    ) : pdfUrl ? (
                        <div className="h-full p-0.5 sm:p-1 lg:p-2">
                            <div className="bg-white rounded-lg shadow-2xl h-full overflow-hidden border border-gray-200 relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-indigo-50/30 pointer-events-none rounded-lg"></div>
                                <iframe
                                    src={pdfUrl}
                                    className="w-full h-full border-0 relative z-10"
                                    title="PDF Preview"
                                    style={{
                                        minHeight: 'calc(100vh - 200px)',
                                        height: '100%',
                                        background: 'white'
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full p-3 sm:p-4">
                            <div className="text-center">
                                <div className="bg-gray-100 rounded-full p-2 sm:p-3 lg:p-4 mx-auto mb-3 sm:mb-4 lg:mb-6 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 flex items-center justify-center shadow-lg">
                                    <Eye className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-gray-400" />
                                </div>
                                <p className="text-gray-600 text-sm sm:text-base lg:text-lg font-medium">No preview available</p>
                                <p className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-2">Unable to generate preview for this voucher</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Enhanced Footer */}
                {/* <div className="p-2 sm:p-3 border-t border-gray-200 bg-white rounded-b-xl">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                        <div className="flex items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 mr-2 sm:mr-3 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-500 font-medium">Status</p>
                                <p className={`text-xs sm:text-sm font-semibold px-2 py-1 rounded-full inline-block truncate ${getStatusColor(voucher?.voucher_status || '')}`}>
                                    {voucher?.voucher_status || 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 mr-2 sm:mr-3 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-500 font-medium">Created</p>
                                <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                                    {voucher?.created_at ? new Date(voucher.created_at).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    }) : 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 mr-2 sm:mr-3 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-500 font-medium">Quantity</p>
                                <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                                    {voucher?.item_details.initial_quantity} pieces
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 mr-2 sm:mr-3 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-500 font-medium">Voucher No</p>
                                <p className="text-xs sm:text-sm font-semibold text-gray-900 font-mono truncate">
                                    {voucher?.voucher_no || 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div> */}
            </div>
        </div>
    );
} 