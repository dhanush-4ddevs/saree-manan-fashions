'use client';

import React from 'react';
import BackupManager from '../../components/admin/BackupManager';
import AdminProtectedRoute from '../../components/admin/AdminProtectedRoute';

export default function BackupManagementPage() {
  return (
    <AdminProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-8">
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Backup
                </h1>
                <p className="mt-2 text-blue-100">
                  Export and import daily backups of voucher data and images
                </p>
              </div>
              <div className="hidden md:block">
                <div className="flex items-center space-x-2 text-blue-100">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm">System Ready</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <BackupManager />
        </div>
      </div>
    </AdminProtectedRoute>
  );
}
