'use client';

import ReceiveReport from '../../components/vendor/ReceiveReport';
import VendorProtectedRoute from '../../components/vendor/VendorProtectedRoute';
import VendorNavbar from '../../components/vendor/VendorNavbar';

export default function ReceiveReportPage() {
  return (
    <VendorProtectedRoute>
      <VendorNavbar>
        <div className="mb-4 ">
          <h1 className="text-xl md:text-2xl font-bold text-blue-800 mb-2">Receive Report</h1>
          <p className="text-sm text-blue-600 mb-4">View and manage received vouchers</p>
          <ReceiveReport />
        </div>
      </VendorNavbar>
    </VendorProtectedRoute>
  );
}
