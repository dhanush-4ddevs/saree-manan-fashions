'use client';

import { useEffect } from 'react';
import VendorProtectedRoute from '../../components/vendor/VendorProtectedRoute';
import VendorNavbar from '../../components/vendor/VendorNavbar';
import MyProfile from '../../components/admin/MyProfile';

export default function VendorAccountsPage() {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeProfileTab', 'account');
      }
    } catch {}
  }, []);

  return (
    <VendorProtectedRoute>
      <VendorNavbar>
        <MyProfile />
      </VendorNavbar>
    </VendorProtectedRoute>
  );
}
