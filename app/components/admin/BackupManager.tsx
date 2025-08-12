'use client';

import React, { useState, useRef } from 'react';
import { BackupService, BackupData, BackupImportResult } from '../../services/backupService';
import { toast } from 'react-hot-toast';
import { Calendar, Download, Upload, FileText, AlertCircle, CheckCircle, XCircle, Loader2, Database, Shield, Clock } from 'lucide-react';

interface BackupStats {
  voucherCount: number;
  imageCount: number;
  userCount: number;
  totalSize: number;
}

export default function BackupManager() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [backupStats, setBackupStats] = useState<BackupStats | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [importResult, setImportResult] = useState<BackupImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadBackupStats = async (date: Date) => {
    setIsLoadingStats(true);
    try {
      const stats = await BackupService.getBackupStats(date);
      setBackupStats(stats);
    } catch (error) {
      console.error('Error loading backup stats:', error);
      toast.error('Failed to load backup statistics');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    loadBackupStats(new Date(date));
  };

  const exportDailyBackup = async () => {
    setIsExporting(true);
    try {
      const targetDate = new Date(selectedDate);
      const backupData = await BackupService.exportDailyBackup(targetDate);

      // Create and download the backup file
      const blob = await BackupService.createBackupFile(backupData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${selectedDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Daily backup exported successfully! ${backupData.metadata.summary.totalVouchers} vouchers, ${backupData.metadata.summary.totalImages} images`);
    } catch (error) {
      console.error('Error exporting daily backup:', error);
      toast.error('Failed to export daily backup');
    } finally {
      setIsExporting(false);
    }
  };

  const exportDateRangeBackup = async () => {
    setIsExporting(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        toast.error('Start date must be before end date');
        return;
      }

      const backupData = await BackupService.exportDateRangeBackup(start, end);

      // Create and download the backup file
      const blob = await BackupService.createBackupFile(backupData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${startDate}_to_${endDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Date range backup exported successfully! ${backupData.metadata.summary.totalVouchers} vouchers, ${backupData.metadata.summary.totalImages} images`);
    } catch (error) {
      console.error('Error exporting date range backup:', error);
      toast.error('Failed to export date range backup');
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


      {/* Export Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Export */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Daily Export
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="daily-date" className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <input
                type="date"
                id="daily-date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={exportDailyBackup}
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
                  <Download className="w-5 h-5" />
                  <span>Export Daily Backup</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Date Range Export */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Date Range Export
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  id="start-date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  id="end-date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onClick={exportDateRangeBackup}
              disabled={isExporting}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 px-4 rounded-md transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Export Date Range</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Upload className="w-5 h-5 mr-2" />
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
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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
                  <Upload className="w-5 h-5" />
                  <span>Choose File</span>
                </>
              )}
            </button>
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
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Images</p>
                    <p className="text-lg font-bold text-green-900">
                      {importResult.details.imagesRestored} restored / {importResult.details.imagesProcessed} total
                    </p>
                  </div>
                  <Shield className="w-6 h-6 text-green-500" />
                </div>
              </div>
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
