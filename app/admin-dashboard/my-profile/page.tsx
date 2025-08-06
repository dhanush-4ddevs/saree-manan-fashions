'use client';

import MyProfile from '@/components/admin/MyProfile';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';

export default function AdminProfilePage() {
  return (
    <AdminProtectedRoute>
      <MyProfile />
    </AdminProtectedRoute>
  );
}
