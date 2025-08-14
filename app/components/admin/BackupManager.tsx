'use client';

import React, { useState, useRef } from 'react';
import { BackupService, BackupImportResult } from '../../services/backupService';
import { toast } from 'react-hot-toast';
import { Download, Upload, FileText, AlertCircle, CheckCircle, Loader2, Shield, Clock } from 'lucide-react';

interface BackupStats {
  voucherCount: number;
  imageCount: number;
  userCount: number;
  totalSize: number;
}

export default function BackupManager() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<BackupImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportAllUntilNow = async () => {
    setIsExporting(true);
    try {
      const backupData = await BackupService.exportBackupUntilNow();

      const blob = await BackupService.createBackupFile(backupData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dd = pad(now.getDate());
      const mm = pad(now.getMonth() + 1);
      const yyyy = now.getFullYear();
      const hh = pad(now.getHours());
      const min = pad(now.getMinutes());
      const ss = pad(now.getSeconds());
      a.download = `manan_fashions_backup_${dd}-${mm}-${yyyy}_${hh}-${min}-${ss}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Backup exported successfully! ${backupData.metadata.summary.totalVouchers} vouchers, ${backupData.metadata.summary.totalImages} images`);
    } catch (error) {
      console.error('Error exporting backup:', error);
      toast.error('Failed to export backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const backupData = await BackupService.loadBackupFromFile(file);
      const result = await BackupService.importBackup(backupData);
      setImportResult(result);

      const totalProcessed = result.details.vouchersProcessed + result.details.imagesProcessed + result.details.usersProcessed;
      const totalRestored = result.details.vouchersRestored + result.details.imagesRestored + result.details.usersRestored;

      if (totalRestored > 0) {
        toast.success(`Import completed! ${totalRestored} items restored, ${totalProcessed - totalRestored} items already existed`);
      } else {
        toast.success(`Import completed! All ${totalProcessed} items already existed`);
      }
    } catch (error) {
      console.error('Error importing backup:', error);
      toast.error('Failed to import backup file');
    } finally {
      setIsImporting(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };



  return (
    <div className="space-y-6">
      {/* Export + Import cards side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Single Export Section */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Upload className="w-5 h-5 mr-2" />
              Export All Data (until now)
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <h4 className="text-sm font-medium text-blue-800 mb-3">About This Backup</h4>
              <ul className="text-sm space-y-2">
                <li className="flex items-start">
                  <Shield className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-blue-700">Creates a complete backup including all vouchers, user profiles, and images up to the current moment.</p>
                </li>
                <li className="flex items-start">
                  <Download className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-blue-700">Downloaded file can be used in the import section to restore your data at any time.</p>
                </li>
                <li className="flex items-start">
                  <Clock className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-blue-700">Backup files are automatically named with date and time for easy tracking.</p>
                </li>
              </ul>
            </div>
            <button
              onClick={exportAllUntilNow}
              disabled={isExporting}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium py-3 px-4 rounded-md transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>Export All Data</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Download className="w-5 h-5 mr-2" />
              Import Backup
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Download className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Select a backup file to import</p>
              <p className="text-sm text-gray-500 mb-4">Only .json files are supported</p>
              <button
                onClick={triggerFileSelect}
                disabled={isImporting}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium py-2 px-4 rounded-md transition-all duration-200 flex items-center justify-center space-x-2 mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Choose File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Import Results */}
      {importResult && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-600 to-gray-700 px-6 py-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Import Results
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Vouchers</p>
                    <p className="text-lg font-bold text-blue-900">
                      {importResult.details.vouchersRestored} restored / {importResult.details.vouchersProcessed} total
                    </p>
                  </div>
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              {/* <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Images</p>
                    <p className="text-lg font-bold text-green-900">
                      {importResult.details.imagesRestored} restored / {importResult.details.imagesProcessed} total
                    </p>
                  </div>
                  <Shield className="w-6 h-6 text-green-500" />
                </div>
              </div> */}
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Users</p>
                    <p className="text-lg font-bold text-purple-900">
                      {importResult.details.usersRestored} restored / {importResult.details.usersProcessed} total
                    </p>
                  </div>
                  <Clock className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </div>

            {importResult.details.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Errors ({importResult.details.errors.length})
                </h4>
                <div className="space-y-1">
                  {importResult.details.errors.map((error: string, index: number) => (
                    <p key={index} className="text-sm text-red-700">{error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
