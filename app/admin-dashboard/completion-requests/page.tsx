'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ListChecks, Users, Clock, LayoutDashboard, FileText, UserPlus, Settings, LogOut, ChevronDown, ChevronRight, IndianRupee, Plus, User, Check, Menu, X } from 'lucide-react';
import AdminReceiveVoucher from '../../components/admin/AdminReceiveVoucher';
import Link from 'next/link';
import Image from 'next/image';
import { signOut, getCurrentUser } from '../../config/firebase';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';

function CompletionRequestsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activePage, setActivePage] = useState('Receive Vouchers');
  // Initialize all menus as collapsed by default
  const [expandedMenus, setExpandedMenus] = useState<{ [key: string]: boolean }>({
    'User Management': false,
    'Voucher Management': true // Open by default for this page
  });
  const [userData, setUserData] = useState<any>(null);
  // Add state for mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Add state for mobile sub-menu visibility
  const [mobileSubMenuOpen, setMobileSubMenuOpen] = useState<string | null>(null);

  // Mobile menu items - simplified version for the dock
  const mobileMenuItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Users', icon: Users, hasSubMenu: true, subItems: [
      { name: 'Add User', icon: UserPlus },
      { name: 'List Users', icon: Users },
      { name: 'My Profile', icon: User }
    ]},
    { name: 'Vouchers', icon: FileText, hasSubMenu: true, subItems: [
      { name: 'Create New Voucher', icon: Plus },
      { name: 'All Vouchers', icon: ListChecks },
      { name: 'Receive Vouchers', icon: Check }
    ]},
    { name: 'Accounts', icon: IndianRupee },
    { name: 'Profile', icon: User, action: () => handleProfileClick() }
  ];

  // Fetch current user data when component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setUserData(user);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  // Menu structure with categories - same as AdminDashboard
  const menuCategories = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      isCategory: false
    },
    {
      name: 'User Management',
      icon: Users,
      isCategory: true,
      subItems: [
        { name: 'Add User', icon: UserPlus },
        { name: 'List Users', icon: Users },
        { name: 'My Profile', icon: User }
      ]
    },
    {
      name: 'Voucher Management',
      icon: FileText,
      isCategory: true,
      subItems: [
        { name: 'Create New Voucher', icon: Plus },
        { name: 'All Vouchers', icon: ListChecks },
        { name: 'Receive Vouchers', icon: Check }
      ]
    },
    {
      name: 'Accounts',
      icon: IndianRupee,
      isCategory: false
    }
  ];

  const toggleMenu = (categoryName: string) => {
    setExpandedMenus(prevState => ({
      ...prevState,
      [categoryName]: !prevState[categoryName]
    }));
  };

  const handleSubItemClick = (name: string) => {
    if (name === 'Dashboard') {
      router.push('/admin-dashboard');
    } else if (name === 'Add User') {
      router.push('/admin-dashboard?tab=Add User');
    } else if (name === 'List Users') {
      router.push('/admin-dashboard?tab=List Users');
    } else if (name === 'My Profile') {
      router.push('/admin-dashboard?tab=My Profile');
    } else if (name === 'Create New Voucher') {
      router.push('/admin-dashboard?tab=Create New Voucher');
    } else if (name === 'All Vouchers') {
      router.push('/admin-dashboard?tab=All Vouchers');
    } else if (name === 'Receive Vouchers') {
      router.push('/admin-dashboard/completion-requests');
    }

    // Close mobile sidebar after selection
    setIsSidebarOpen(false);
  };

  const handleProfileClick = () => {
    router.push('/admin-dashboard/my-profile');
  };

  const handleMobileMenuClick = (item: any) => {
    if (item.hasSubMenu) {
      // Toggle sub-menu visibility
      setMobileSubMenuOpen(mobileSubMenuOpen === item.name ? null : item.name);
    } else if (item.action) {
      item.action();
    } else if (item.name === 'Dashboard') {
      router.push('/admin-dashboard');
    } else if (item.name === 'Accounts') {
      handleAccountsClick();
    }
    // Never open sidebar on mobile - only use bottom navigation
  };

  const handleMobileSubItemClick = (subItemName: string) => {
    // Close sub-menu
    setMobileSubMenuOpen(null);

    // Navigate to the sub-item
    if (subItemName === 'Dashboard') {
      router.push('/admin-dashboard');
    } else if (subItemName === 'Add User') {
      router.push('/admin-dashboard?tab=Add User');
    } else if (subItemName === 'List Users') {
      router.push('/admin-dashboard?tab=List Users');
    } else if (subItemName === 'My Profile') {
      router.push('/admin-dashboard?tab=My Profile');
    } else if (subItemName === 'Create New Voucher') {
      router.push('/admin-dashboard?tab=Create New Voucher');
    } else if (subItemName === 'All Vouchers') {
      router.push('/admin-dashboard?tab=All Vouchers');
    } else if (subItemName === 'Receive Vouchers') {
      router.push('/admin-dashboard/completion-requests');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to logout. Please try again.');
    }
  };

  const handleAccountsClick = () => {
    router.push('/admin-dashboard/accounts');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-blue-100">
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md border-b border-blue-800">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Image
                src="/logo_kraj.png"
                alt="Manan Fashions"
                width={100}
                height={80}
                className="object-contain"
              />
            </div>

            {/* Desktop nav items */}
            <div className="hidden md:flex items-center space-x-4">
              {userData && (
                <button
                  onClick={() => handleSubItemClick('My Profile')}
                  className="flex items-center bg-blue-800/20 px-3 py-1.5 rounded-md hover:bg-blue-800/30 transition-colors"
                >
                  {userData.profilePhotoUrl ? (
                    <div className="relative h-6 w-6 rounded-full overflow-hidden mr-2">
                      <Image
                        src={userData.profilePhotoUrl}
                        alt="Profile"
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <User className="h-5 w-5 text-blue-100 mr-2" />
                  )}
                  <span className="text-sm font-medium text-white">
                    {userData.firstName} {userData.surname || ''}
                  </span>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center text-white hover:text-blue-100 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Logout
              </button>
            </div>

            {/* Mobile actions */}
            <div className="md:hidden flex items-center">
              <button
                onClick={handleLogout}
                className="text-white p-2"
                aria-label="Logout"
                title="Logout"
              >
                <LogOut className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <div
          className={`${isSidebarOpen ? 'block' : 'hidden'
            } md:block fixed md:static z-30 h-[calc(100vh-4rem)] md:h-auto w-64 bg-white shadow-md border-r border-blue-100 transition-all duration-300 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } md:translate-x-0 hidden md:block`}
        >
          <div className="p-4 overflow-y-auto h-full pb-20 md:pb-4">
            <div className="text-sm font-medium text-blue-600 mb-4">Admin Menu</div>
            <ul className="space-y-2">
              {menuCategories.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.name}>
                    {item.isCategory ? (
                      <div>
                        <button
                          onClick={() => toggleMenu(item.name)}
                          className="flex items-center justify-between w-full px-4 py-2 text-left text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <div className="flex items-center">
                            <Icon className="h-5 w-5 mr-3" />
                            <span>{item.name}</span>
                          </div>
                          {expandedMenus[item.name] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        {item.isCategory && expandedMenus[item.name] && item.subItems && (
                          <ul className="mt-2 space-y-1 ml-10">
                            {item.subItems.map((subItem) => {
                              const SubIcon = subItem.icon;
                              return (
                                <li key={subItem.name}>
                                  <button
                                    onClick={() => handleSubItemClick(subItem.name)}
                                    className={`flex items-center w-full px-4 py-2 text-sm rounded-md transition-colors ${activePage === subItem.name
                                      ? 'bg-blue-50 text-blue-600'
                                      : 'text-blue-600 hover:bg-blue-50'
                                      }`}
                                  >
                                    <SubIcon className="h-4 w-4 mr-3" />
                                    <span>{subItem.name}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => item.name === 'Accounts' ? handleAccountsClick() : handleSubItemClick(item.name)}
                        className={`flex items-center w-full px-4 py-2 rounded-md transition-colors ${activePage === item.name
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-blue-600 hover:bg-blue-50'
                          }`}
                      >
                        <Icon className="h-5 w-5 mr-3" />
                        <span>{item.name}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Mobile-only logout button */}
            <div className="mt-8 md:hidden">
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 rounded-md text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-3" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className={`flex-1 p-4 md:p-8 overflow-y-auto ${mobileSubMenuOpen ? 'pb-32' : 'pb-20'} md:pb-8`}>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-blue-800">Receive Vouchers</h1>
            <p className="text-blue-600 mt-1">
              Review and receive vouchers that have been sent to admin for completion.
            </p>
          </div>

          <div className="bg-white shadow-md rounded-lg p-6 border border-blue-100">
            <AdminReceiveVoucher />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Dock Menu */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-blue-200 shadow-lg z-40">
        {/* Mobile Sub-menu Box */}
        {mobileSubMenuOpen && (
          <div className="bg-white border-b border-blue-200 shadow-lg">
            <div className="p-4">
              <div className="text-sm font-medium text-blue-600 mb-3">
                {mobileSubMenuOpen === 'Users' ? 'User Management' : 'Voucher Management'}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {mobileMenuItems.find(item => item.name === mobileSubMenuOpen)?.subItems?.map((subItem) => {
                  const SubIcon = subItem.icon;
                  return (
                    <button
                      key={subItem.name}
                      onClick={() => handleMobileSubItemClick(subItem.name)}
                      className="flex items-center w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <SubIcon className="h-4 w-4 mr-3" />
                      <span>{subItem.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-around items-center h-16">
          {mobileMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = (item.name === 'Dashboard' && activePage === 'Dashboard') ||
              (item.name === 'Users' && activePage.includes('User')) ||
              (item.name === 'Vouchers' && activePage.includes('Voucher')) ||
              (item.name === 'Accounts' && activePage === 'Accounts') ||
              (item.name === 'Profile' && activePage === 'My Profile') ||
              (mobileSubMenuOpen === item.name);

            return (
              <button
                key={item.name}
                onClick={() => handleMobileMenuClick(item)}
                className={`flex flex-col items-center justify-center w-full h-full transition-all duration-200 ${isActive
                    ? 'text-blue-600 bg-blue-50 border-t-2 border-blue-600'
                    : 'text-blue-400 hover:bg-blue-50'
                  }`}
              >
                <div className={`relative ${isActive ? 'scale-110 -translate-y-1' : ''} transition-transform duration-200`}>
                  <Icon className={`h-6 w-6 ${isActive ? 'text-blue-600' : 'text-blue-400'}`} />
                </div>
                <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : ''}`}>{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CompletionRequestsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CompletionRequestsPageContent />
    </Suspense>
  );
}
