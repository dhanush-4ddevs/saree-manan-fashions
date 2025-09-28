'use client';

import React from 'react';
import { FileText, Save, AlertTriangle, X, Eye, Edit } from 'lucide-react';
import { ImageContainer } from '../shared/ImageContainer';

interface ReceiveItem {
  id: string;
  voucherId: string;
  eventId: string;
  voucherNo: string;
  voucherDate: string;
  imageUrl?: string | null;
  item: string;
  jobWork: string;
  vendorCode: string;
  lrDate: string;
  lrNumber: string;
  transportName: string;
  quantityExpected: number;
  quantityReceived: number;
  missing: number;
  damagedOnArrival: number;
  damageReason: string;
  receiverComment: string;
  status: string;
  senderId?: string;
  senderName: string;
  senderType: 'admin' | 'vendor';
  isForwarded?: boolean;
}

interface ReceiveReportCardProps {
  item: ReceiveItem;
  isEditing: boolean;
  currentData: any;
  onEdit: (id: string) => void;
  onSave: (id: string) => void;
  onCancel: (id: string) => void;
  onInputChange: (id: string, field: string, value: any) => void;
  saving: boolean;
  searchTerm?: string;
}

export function ReceiveReportCard({
  item,
  isEditing,
  currentData,
  onEdit,
  onSave,
  onCancel,
  onInputChange,
  saving,
  searchTerm = ''
}: ReceiveReportCardProps) {
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim() || !text) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\\]/g, '\\$&')})`, 'gi');
    return text.split(regex).map((part, index) =>
      regex.test(part) ? <mark key={index} className="bg-yellow-200 px-1 rounded">{part}</mark> : part
    );
  };

  const missingQty = isEditing ? (Number(currentData.missing) || 0) : item.missing;
  const receivedQty = item.quantityExpected - missingQty;
  const damagedQty = isEditing ? (Number(currentData.damagedOnArrival) || 0) : item.damagedOnArrival;
  const netQty = receivedQty - damagedQty;

  return (
    <div className={`bg-white rounded-lg border-2 shadow-sm hover:shadow-md transition-shadow duration-200 ${
      isEditing ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {item.imageUrl ? (
              <ImageContainer images={[item.imageUrl]} size="sm" />
            ) : (
              <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900">
                {highlightSearchTerm(item.voucherNo, searchTerm)}
              </h3>
              <p className="text-sm text-gray-600">
                {item.voucherDate ? new Date(item.voucherDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                }) : 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => onSave(item.id)}
                  disabled={saving}
                  className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 disabled:bg-gray-400 flex items-center space-x-1"
                >
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </button>
                <button
                  onClick={() => onCancel(item.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 flex items-center space-x-1"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => onEdit(item.id)}
                disabled={item.isForwarded}
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-1"
                title={item.isForwarded ? "Cannot edit: this voucher has been forwarded." : "Edit Received Voucher"}
              >
                <Edit className="h-4 w-4" />
                <span>{item.quantityReceived > 0 ? 'Edit' : 'Receive'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Item Details */}
        <div>
          <h4 className="font-medium text-gray-900 mb-1">Item</h4>
          <p className="text-sm text-gray-600">{highlightSearchTerm(item.item, searchTerm)}</p>
        </div>

        {/* Job Work */}
        <div>
          <h4 className="font-medium text-gray-900 mb-1">Job Work</h4>
          <p className="text-sm text-gray-600">{highlightSearchTerm(item.jobWork, searchTerm)}</p>
        </div>

        {/* Transport Details */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">LR Date</h4>
            <p className="text-sm text-gray-600">
              {item.lrDate ? new Date(item.lrDate).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              }) : 'N/A'}
            </p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-1">LR Number</h4>
            <p className="text-sm text-gray-600">{item.lrNumber || 'N/A'}</p>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-gray-900 mb-1">Transport</h4>
          <p className="text-sm text-gray-600">{item.transportName || 'N/A'}</p>
        </div>

        {/* Sender Info */}
        <div>
          <h4 className="font-medium text-gray-900 mb-1">Sender</h4>
          <p className="text-sm text-gray-600">{`${item.senderName} (${item.senderType})`}</p>
        </div>

        {/* Quantities */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="font-medium text-gray-900 mb-2">Quantities</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600">Expected:</span>
              <span className="ml-1 font-medium">{item.quantityExpected}</span>
            </div>
            <div>
              <span className="text-gray-600">Missing:</span>
              <span className={`ml-1 font-medium ${missingQty > 0 ? 'text-red-600' : ''}`}>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    max={item.quantityExpected}
                    value={currentData.missing ?? item.missing ?? 0}
                    onChange={e => onInputChange(item.id, 'missing', e.target.value)}
                    className="w-16 p-1 border rounded text-sm"
                  />
                ) : (
                  missingQty
                )}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Damaged:</span>
              <span className="ml-1 font-medium">
                {isEditing ? (
                  <input
                    type="number"
                    value={currentData.damagedOnArrival}
                    onChange={e => onInputChange(item.id, 'damagedOnArrival', e.target.value)}
                    className="w-16 p-1 border rounded text-sm"
                  />
                ) : (
                  damagedQty
                )}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Net Received:</span>
              <span className="ml-1 font-semibold text-green-600">{netQty}</span>
            </div>
          </div>
        </div>

        {/* Damage Reason */}
        <div>
          <h4 className="font-medium text-gray-900 mb-1">Damage Reason</h4>
          {isEditing ? (
            <textarea
              value={currentData.damageReason}
              onChange={e => onInputChange(item.id, 'damageReason', e.target.value)}
              className="w-full p-2 border rounded text-sm"
              rows={2}
              placeholder="Enter damage reason..."
            />
          ) : (
            <p className="text-sm text-gray-600">{item.damageReason || 'N/A'}</p>
          )}
        </div>

        {/* Comment */}
        <div>
          <h4 className="font-medium text-gray-900 mb-1">Comment</h4>
          {isEditing ? (
            <textarea
              value={currentData.receiverComment}
              onChange={e => onInputChange(item.id, 'receiverComment', e.target.value)}
              className="w-full p-2 border rounded text-sm"
              rows={2}
              placeholder="Enter comment..."
            />
          ) : (
            <p className="text-sm text-gray-600">{item.receiverComment || 'N/A'}</p>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Status</h4>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              item.status === 'Received' ? 'bg-green-100 text-green-800' :
              item.status === 'Dispatched' ? 'bg-blue-100 text-blue-800' :
              item.status === 'Forwarded' ? 'bg-purple-100 text-purple-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {item.status}
            </span>
          </div>
          {item.isForwarded && (
            <div className="flex items-center text-xs text-orange-600">
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span>Forwarded</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
