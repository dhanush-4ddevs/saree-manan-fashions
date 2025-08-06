'use client';

import MyProfile from '../../components/admin/MyProfile';
import VendorProtectedRoute from '../../components/vendor/VendorProtectedRoute';
import VendorNavbar from '../../components/vendor/VendorNavbar';

export default function VendorProfilePage() {
  return (
    <VendorProtectedRoute>
      <VendorNavbar>
        <MyProfile />
      </VendorNavbar>
    </VendorProtectedRoute>
  );
}
