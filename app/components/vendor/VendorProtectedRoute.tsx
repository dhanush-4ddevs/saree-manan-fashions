'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '../../config/firebase';

interface VendorProtectedRouteProps {
  children: ReactNode;
}

export default function VendorProtectedRoute({ children }: VendorProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isVendor, setIsVendor] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();

        if (!user) {
          // Not authenticated, redirect to login
          router.push('/');
          return;
        }

        // Verify this is a vendor account
        if (user.role !== 'vendor') {
          // If admin trying to access vendor page, silently redirect to admin dashboard
          if (user.role === 'admin') {
            console.log('Admin user accessing vendor route, redirecting to admin dashboard');
            router.push('/admin-dashboard');
          } else {
            console.error('Unauthorized user role');
            router.push('/');
          }
          return;
        }

        // Verify this account is approved
        if (!user.approved) {
          console.error('Vendor account not approved');
          router.push('/?error=account-not-approved');
          return;
        }

        setIsVendor(true);
      } catch (error) {
        console.error('Error checking vendor authentication:', error);
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-800">Loading vendor dashboard...</p>
        </div>
      </div>
    );
  }

  return isVendor ? <>{children}</> : null;
}
