'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/config/firebase';

interface AdminProtectedRouteProps {
  children: ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();

        if (!user) {
          // Not authenticated, redirect to login
          router.push('/');
          return;
        }

        // Verify this is an admin account
        if (user.role !== 'admin') {
          console.error('Not an admin account');

          // If vendor trying to access admin page, redirect to vendor dashboard
          if (user.role === 'vendor') {
            router.push('/vendor/dashboard');
          } else {
            router.push('/');
          }
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error('Error checking admin authentication:', error);
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
          <p className="mt-4 text-blue-800">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return isAdmin ? <>{children}</> : null;
}
