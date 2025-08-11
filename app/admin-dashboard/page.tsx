'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';
import { Toast } from '@/components/shared/Toast';

function AdminDashboardContent() {
  return (
    <AdminProtectedRoute>
      <AdminDashboard />
    </AdminProtectedRoute>
  );
}

export default function AdminDashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    const toast = searchParams.get('toast');
    const type = (searchParams.get('type') as 'success' | 'error' | null) || 'success';

    if (toast) {
      // Map known keys to friendly messages; fallback to provided text
      const message = toast === 'add_user_success'
        ? 'User created successfully'
        : decodeURIComponent(toast);

      setToastMessage(message);
      setToastType(type === 'error' ? 'error' : 'success');
      setIsToastVisible(true);

      // Clean the URL so the toast doesn't reappear on refresh
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      params.delete('toast');
      params.delete('type');
      const next = `/admin-dashboard${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(next);
    }
  }, [searchParams, router]);

  return (
    <>
      <Suspense fallback={<div>Loading...</div>}>
        <AdminDashboardContent />
      </Suspense>
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
    </>
  );
}
