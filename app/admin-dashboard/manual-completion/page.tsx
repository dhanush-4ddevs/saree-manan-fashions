'use client';

import React from 'react';
import ManualCompletionTool from '@/components/admin/ManualCompletionTool';

export default function ManualCompletionPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manual Completion Tool</h1>
          <p className="mt-2 text-gray-600">
            Use this tool to manually mark vouchers as complete when there are minor quantity discrepancies
            but the workflow is logically finished.
          </p>
        </div>

        <ManualCompletionTool />
      </div>
    </div>
  );
}
