'use client';

import ForwardReport from "../../components/vendor/ForwardReport";
import VendorProtectedRoute from '../../components/vendor/VendorProtectedRoute';
import VendorNavbar from '../../components/vendor/VendorNavbar';

export default function ForwardReportPage() {
  return (
    <VendorProtectedRoute>
      <VendorNavbar>
        <div>
          <h1 className="text-2xl font-bold text-blue-800 mb-6">Forward Report</h1>
          <ForwardReport />
        </div>
      </VendorNavbar>
    </VendorProtectedRoute>
  );
}
