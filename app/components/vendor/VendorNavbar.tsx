'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  LogOut,
  User,
  ArrowRight,
  CheckCircle,
  Menu,
  X,
  CreditCard
} from 'lucide-react';
import Image from 'next/image';
import { signOut, getCurrentUser } from '../../config/firebase';
import { VendorNotificationBell } from './VendorNotificationBell';

export default function VendorNavbar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const [vendorData, setVendorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeProfileTab, setActiveProfileTab] = useState<string | null>(null);

  // Always keep menu visible, especially on desktop
  const [menuVisible, setMenuVisible] = useState(true);

  useEffect(() => {
    const loadVendorData = async () => {
      try {
        const userData = await getCurrentUser();
        if (userData) {
          setVendorData(userData);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading vendor data:', error);
        setLoading(false);
      }
    };

    loadVendorData();
  }, []);

  // Ensure menu stays visible when changing routes
  useEffect(() => {
    setMenuVisible(true);
    // Sync active profile tab from localStorage when route changes
    try {
      const storedTab = typeof window !== 'undefined' ? localStorage.getItem('activeProfileTab') : null;
      setActiveProfileTab(storedTab);
    } catch { }
  }, [pathname]);

  // Listen for localStorage changes (e.g., across tabs)
  useEffect(() => {
    const handleStorage = () => {
      try {
        const storedTab = localStorage.getItem('activeProfileTab');
        setActiveProfileTab(storedTab);
      } catch { }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  const menuItems = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      path: '/vendor/dashboard'
    },
    {
      name: 'Received Vouchers',
      icon: CheckCircle,
      path: '/vendor/receive-report'
    },
    {
      name: 'Forward Voucher',
      icon: ArrowRight,
      path: '/vendor/forward-report'
    },
    {
      name: 'Accounts',
      icon: CreditCard,
      path: '/vendor/accounts'
    },
    {
      name: 'My Profile',
      icon: User,
      path: '/vendor/my-profile'
    },
  ];

  const handleMenuClick = (path: string, action?: string) => {
    // Navigating directly to My Profile should clear any stored sub-tab
    if (path === '/vendor/my-profile') {
      try {
        localStorage.removeItem('activeProfileTab');
        setActiveProfileTab(null);
      } catch { }
    }

    if (path === pathname) return;
    router.push(path);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-800">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-blue-100">
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md border-b border-blue-800 sticky top-0 z-30">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Image
                src="/logo_kraj.png"
                alt="Manan Fashions"
                width={100}
                height={100}
                className="object-contain"
              />
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              {vendorData?.uid && <VendorNotificationBell vendorUserId={vendorData.uid} iconColor="text-white" />}
              <button
                onClick={() => {
                  // Clear any stored active tab to default to personal details
                  localStorage.removeItem('activeProfileTab');
                  router.push('/vendor/my-profile');
                }}
                className="mr-2 md:mr-4 flex items-center bg-blue-800/20 px-2 md:px-3 py-1.5 rounded-md hover:bg-blue-800/30 transition-colors"
              >
                {vendorData?.profilePhotoUrl ? (
                  <div className="relative h-5 w-5 rounded-full overflow-hidden mr-1 md:mr-2">
                    <Image
                      src={vendorData.profilePhotoUrl}
                      alt="Profile"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <User className="h-5 w-5 text-blue-100 mr-1 md:mr-2" />
                )}
                <span className="text-xs md:text-sm font-medium text-white">
                  <span className="hidden md:inline">{vendorData?.firstName} {vendorData?.surname} | </span>
                  {vendorData?.companyName || 'Vendor'}
                </span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center text-white hover:text-blue-100 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden md:inline ml-2">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 relative">
        {/* Desktop Sidebar - Sticky position */}
        <div className="hidden md:block w-64 bg-white shadow-md border-r border-blue-100 sticky top-16 h-[calc(100vh-4rem)] overflow-auto z-20">
          <div className="p-4">
            <div className="text-sm font-medium text-blue-600 mb-4">Vendor Menu</div>
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.name}>
                    <button
                      onClick={() => handleMenuClick(item.path)}
                      className={`flex items-center w-full px-4 py-2 rounded-md transition-colors ${pathname === item.path || pathname.startsWith(`${item.path}/`)
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-blue-600 hover:bg-blue-50'
                        }`}
                    >
                      <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                      <span className="whitespace-nowrap">{item.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Main Content - Scrollable */}
        <div className="w-full flex-1 pb-16 md:pb-0 md:pl-18 overflow-auto">
          <div className="max-w-full mx-auto p-4 md:p-8">
            {children}
          </div>
        </div>

        {/* Mobile Menu - Bottom dock style (match AdminDashboard) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-blue-200 shadow-lg z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex justify-around items-center h-16">
            {menuItems.map((item) => {
              const Icon = item.icon;

              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);

              return (
                <button
                  key={item.name}
                  onClick={() => handleMenuClick(item.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${isActive
                    ? 'text-blue-600 bg-blue-50 border-t-2 border-blue-600'
                    : 'text-blue-400 hover:bg-blue-50'
                    }`}
                >
                  <div className={`relative ${isActive ? 'scale-110 -translate-y-1' : ''} transition-transform duration-200`}>
                    <Icon className={`h-6 w-6 ${isActive ? 'text-blue-600' : 'text-blue-400'}`} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`mt-1 text-[11px] leading-3 ${isActive ? 'font-semibold' : ''}`}>{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
