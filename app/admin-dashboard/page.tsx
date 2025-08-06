'use client';

import { Suspense } from 'react';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';

function AdminDashboardContent() {
  return (
    <AdminProtectedRoute>
      <AdminDashboard />
    </AdminProtectedRoute>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminDashboardContent />
    </Suspense>
  );
}
