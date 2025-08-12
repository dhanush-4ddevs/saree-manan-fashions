'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ListChecks, Users, Clock, LayoutDashboard, FileText, UserPlus, Settings, LogOut, ChevronDown, ChevronRight, IndianRupee, Plus, User, Check, Menu, X, Search, CreditCard, CheckCircle, RefreshCw, Printer, ArrowLeft, Info } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import AllVouchers from '@/components/shared/AllVouchers';
import AddUser from '@/admin-dashboard/add-user/page';
import TodayVouchers from '@/components/shared/TodayVouchers';
import CreateVoucher from '@/admin-dashboard/vouchers/create/page';
import ListUsers from '@/components/admin/ListUsers';
import MyProfile from './MyProfile';
import { signOut, getCurrentUser } from '@/config/firebase';
import { db } from '@/config/firebase';
import { collection, getDocs, query, where, orderBy, limit, Timestamp, updateDoc, doc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import AdminReceiveVoucher from '../admin/AdminReceiveVoucher';
import AdminNavbar from '@/admin-dashboard/AdminNavbar';
import { jsPDF } from 'jspdf';
import autoTable, { HookData } from 'jspdf-autotable';
import AdminPaymentComponent from './AdminPaymentComponent';

// Add type declarations for jsPDF with autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Add type for autoTable callback data
interface AutoTableData {
  cursor?: {
    y: number;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activePage, setActivePage] = useState('Dashboard');
  // Add navigation history state
  const [pageHistory, setPageHistory] = useState<string[]>(['Dashboard']);
  // Initialize all menus as collapsed by default
  const [expandedMenus, setExpandedMenus] = useState<{ [key: string]: boolean }>({
    'User Management': false,
    'Voucher Management': false
  });
  const [userData, setUserData] = useState<any>(null);
  const [dashboardStats, setDashboardStats] = useState({
    vouchersCreatedToday: 0,
    vouchersCreatedThisMonth: 0,
    vouchersCompletedToday: 0,
    vouchersCompletedThisMonth: 0,
    pendingVouchers: 0,
    completionRequests: 0
  });
  // Add state for mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Add state for stat card interactions
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [createdDateFilter, setCreatedDateFilter] = useState<'today' | 'month'>('today');
  const [completedDateFilter, setCompletedDateFilter] = useState<'today' | 'month'>('month');

  // Add state for expanded vouchers in accounts
  const [expandedVouchers, setExpandedVouchers] = useState<Record<string, boolean>>({});

  // Add state for refresh loading
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Close sidebar when clicking outside of it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  // Check for URL parameters to set active page
  useEffect(() => {
    if (searchParams) {
      const tab = searchParams.get('tab');
      const voucherId = searchParams.get('voucherId');

      // If there's a voucherId parameter, navigate to All Vouchers page
      if (voucherId) {
        setActivePage('All Vouchers');
        setExpandedMenus(prev => ({ ...prev, 'Voucher Management': true }));
        return;
      }

      if (tab) {
        setActivePage(tab);

        // Expand the related menu if needed
        if (tab === 'All Vouchers' || tab === 'Create New Voucher' || tab === 'Completion Requests' || tab === 'Receive Vouchers') {
          setExpandedMenus(prev => ({ ...prev, 'Voucher Management': true }));
        } else if (tab === 'Add User' || tab === 'List Users' || tab === 'My Profile') {
          setExpandedMenus(prev => ({ ...prev, 'User Management': true }));
        }
      }
    }
  }, [searchParams]);

  // Check if we're on the completion-requests route for backward compatibility
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname.includes('/admin-dashboard/completion-requests')) {
        setActivePage('Receive Vouchers');
        setExpandedMenus(prev => ({ ...prev, 'Voucher Management': true }));
      }
    }
  }, []);

  // Fetch current user data and dashboard stats when component mounts
  const fetchDashboardStats = async (showLoading = false) => {
    if (showLoading) {
      setIsRefreshing(true);
    }

    try {
      const vouchersRef = collection(db, 'vouchers');

      // Get today's date range
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Get this month's date range
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      // Fetch all vouchers to analyze their status and dates
      const allVouchersQuery = query(vouchersRef);
      const allVouchersSnapshot = await getDocs(allVouchersQuery);

      let vouchersCreatedToday = 0;
      let vouchersCreatedThisMonth = 0;
      let vouchersCompletedToday = 0;
      let vouchersCompletedThisMonth = 0;
      let pendingVouchers = 0;
      let completionRequests = 0;

      allVouchersSnapshot.forEach((doc) => {
        const voucherData = doc.data();

        // Use new voucher structure fields
        const voucherDate = voucherData.createdAt?.toDate() ||
          (voucherData.created_at ? new Date(voucherData.created_at) : new Date());
        const voucherStatus = voucherData.voucher_status || voucherData.status || 'Dispatched';

        // Count vouchers created today and this month
        if (voucherDate >= startOfToday && voucherDate < endOfToday) {
          vouchersCreatedToday++;
        }
        if (voucherDate >= startOfMonth && voucherDate < endOfMonth) {
          vouchersCreatedThisMonth++;
        }

        // Count vouchers completed today and this month
        // Check completion date from updatedAt field when status is Completed
        if (voucherStatus === 'Completed') {
          const completionDate = voucherData.updatedAt?.toDate() ||
            (voucherData.updated_at ? new Date(voucherData.updated_at) : voucherDate);

          if (completionDate >= startOfToday && completionDate < endOfToday) {
            vouchersCompletedToday++;
          }
          if (completionDate >= startOfMonth && completionDate < endOfMonth) {
            vouchersCompletedThisMonth++;
          }
        }

        // Count pending vouchers (not completed)
        if (voucherStatus && !['Completed', 'Cancelled'].includes(voucherStatus)) {
          pendingVouchers++;
        }

        // Count completion requests (vouchers with damaged items or pending completion)
        // Use new structure fields for damage tracking
        const totalDamagedOnArrival = voucherData.total_damaged_on_arrival || 0;
        const totalDamagedAfterWork = voucherData.total_damaged_after_work || 0;
        const totalMissingOnArrival = voucherData.total_missing_on_arrival || 0;

        if (totalDamagedOnArrival > 0 ||
          totalDamagedAfterWork > 0 ||
          totalMissingOnArrival > 0 ||
          voucherStatus === 'Pending Completion') {
          completionRequests++;
        }
      });

      setDashboardStats({
        vouchersCreatedToday: vouchersCreatedToday,
        vouchersCreatedThisMonth: vouchersCreatedThisMonth,
        vouchersCompletedToday: vouchersCompletedToday,
        vouchersCompletedThisMonth: vouchersCompletedThisMonth,
        pendingVouchers: pendingVouchers,
        completionRequests: completionRequests
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      if (showLoading) {
        setIsRefreshing(false);
      }
    }
  };

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
    fetchDashboardStats();

    // Set up interval to refresh stats every 5 minutes
    const interval = setInterval(fetchDashboardStats, 5 * 60 * 1000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  // Updated menu structure with categories
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

  // Mobile menu items - simplified version for the dock
  const mobileMenuItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    {
      name: 'Users', icon: Users, hasSubMenu: true, subItems: [
        { name: 'Add User', icon: UserPlus },
        { name: 'List Users', icon: Users },
        { name: 'My Profile', icon: User }
      ]
    },
    {
      name: 'Vouchers', icon: FileText, hasSubMenu: true, subItems: [
        { name: 'Create New Voucher', icon: Plus },
        { name: 'All Vouchers', icon: ListChecks },
        { name: 'Receive Vouchers', icon: Check }
      ]
    },
    { name: 'Accounts', icon: IndianRupee },
    { name: 'Profile', icon: User, action: () => handleProfileClick() }
  ];

  // Add state for mobile sub-menu visibility
  const [mobileSubMenuOpen, setMobileSubMenuOpen] = useState<string | null>(null);

  const toggleMenu = (categoryName: string) => {
    setExpandedMenus(prevState => ({
      ...prevState,
      [categoryName]: !prevState[categoryName]
    }));
  };

  // Navigation functions
  const navigateTo = (pageName: string) => {
    if (pageName !== activePage) {
      setPageHistory(prev => [...prev, activePage]);
      setActivePage(pageName);
    }

    // Close dropdowns/expanded menus when navigating to top-level sections
    if (['Dashboard', 'Accounts', 'My Profile'].includes(pageName)) {
      setExpandedMenus(prevState => {
        const collapsed: { [key: string]: boolean } = {};
        Object.keys(prevState).forEach(key => {
          collapsed[key] = false;
        });
        return collapsed;
      });
      // Close any open mobile sub-menu
      setMobileSubMenuOpen(null);
    }
  };

  const goBack = () => {
    if (pageHistory.length > 1) {
      const newHistory = [...pageHistory];
      const previousPage = newHistory.pop();
      setPageHistory(newHistory);
      if (previousPage) {
        setActivePage(previousPage);
      }
    } else {
      // Fallback to Dashboard if no history
      setActivePage('Dashboard');
      setPageHistory(['Dashboard']);
    }
  };

  const handleSubItemClick = (name: string) => {
    navigateTo(name);
    // Close all submenus when a subitem is clicked
    const updatedMenus = { ...expandedMenus };
    Object.keys(updatedMenus).forEach(key => {
      updatedMenus[key] = false;
    });
    setExpandedMenus(updatedMenus);
    // Close mobile sidebar after selection
    setIsSidebarOpen(false);
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

  const handleProfileClick = () => {
    navigateTo('My Profile');
    setIsSidebarOpen(false);
  };

  const handleAccountsClick = () => {
    navigateTo('Accounts');
    setIsSidebarOpen(false);
  };

  const handleMobileMenuClick = (item: any) => {
    if (item.hasSubMenu) {
      // Toggle sub-menu visibility
      setMobileSubMenuOpen(mobileSubMenuOpen === item.name ? null : item.name);
    } else if (item.action) {
      item.action();
    } else if (item.name === 'Dashboard') {
      navigateTo('Dashboard');
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
      setActivePage('Dashboard');
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

  // Remove VoucherPayment interface, payment-related state, fetchVoucherPayments, handlePayment, and all payment helpers







  // Back Button Component
  const BackButton = ({ position }: { position: 'top' | 'bottom' }) => {
    if (activePage === 'Dashboard') return null;

    const baseClasses = "flex items-center gap-2 px-3 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-all duration-200 border border-blue-200 hover:border-blue-300 bg-white shadow-sm";
    const positionClasses = position === 'top'
      ? "mb-4"
      : "mt-8 ml-auto w-fit";

    return (
      <button
        onClick={goBack}
        className={`${baseClasses} ${positionClasses}`}
        title="Go back to previous page"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Back</span>
      </button>
    );
  };

  // Stat card details configuration
  const statCardDetails = {
    'Vouchers Created': {
      icon: Plus,
      value: createdDateFilter === 'today' ? dashboardStats.vouchersCreatedToday : dashboardStats.vouchersCreatedThisMonth,
      color: 'blue',
      title: `Vouchers Created ${createdDateFilter === 'today' ? 'Today' : 'This Month'}`,
      shortDescription: `Total vouchers created ${createdDateFilter === 'today' ? 'today' : 'this month'}`,
      actionText: `Switch to ${createdDateFilter === 'today' ? 'Monthly' : 'Daily'} View`,
      actionHandler: () => {
        setCreatedDateFilter(createdDateFilter === 'today' ? 'month' : 'today');
        setExpandedCard(null);
      }
    },
    'Pending Vouchers': {
      icon: Clock,
      value: dashboardStats.pendingVouchers,
      color: 'amber',
      title: 'Pending Vouchers',
      shortDescription: 'Vouchers not yet completed',
      actionText: 'View All Vouchers',
      actionHandler: () => navigateTo('All Vouchers')
    },
    'Vouchers Completed': {
      icon: CheckCircle,
      value: completedDateFilter === 'today' ? dashboardStats.vouchersCompletedToday : dashboardStats.vouchersCompletedThisMonth,
      color: 'green',
      title: `Vouchers Completed ${completedDateFilter === 'today' ? 'Today' : 'This Month'}`,
      shortDescription: `Total vouchers completed ${completedDateFilter === 'today' ? 'today' : 'this month'}`,
      actionText: `Switch to ${completedDateFilter === 'today' ? 'Monthly' : 'Daily'} View`,
      actionHandler: () => {
        setCompletedDateFilter(completedDateFilter === 'today' ? 'month' : 'today');
        setExpandedCard(null);
      }
    }
  };

  // Handle stat card interactions
  const handleCardClick = (cardName: string) => {
    setExpandedCard(expandedCard === cardName ? null : cardName);
  };

  const handleCardAction = (cardName: string) => {
    const card = statCardDetails[cardName as keyof typeof statCardDetails];
    if (card?.actionHandler) {
      card.actionHandler();
      setExpandedCard(null); // Close expanded view when navigating
    }
  };

  const renderContent = () => {
    const pageContent = (() => {
      switch (activePage) {
        case 'Create New Voucher':
          return <CreateVoucher />;
        case 'All Vouchers':
          return <AllVouchers onCreateVoucher={() => navigateTo('Create New Voucher')} />;
        case 'Add User':
          return <AddUser />;
        case 'List Users':
          return <ListUsers />;
        case 'My Profile':
          return <MyProfile />;
        case 'Receive Vouchers':
          return (
            <div>
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
          );
        case 'Accounts':
          return <AdminPaymentComponent />;
        default:
          return null;
      }
    })();

    return (
      <div>
        <BackButton position="top" />
        {pageContent}
        <BackButton position="bottom" />
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-blue-100 pt-16">
      {/* Admin Navbar */}
      <AdminNavbar
        userData={userData}
        handleProfileClick={handleProfileClick}
        handleLogout={handleLogout}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        hideMobileMenu={true}
      />

      <div className="flex flex-1 relative">
        {/* Sidebar - Always fixed position */}
        <div
          ref={sidebarRef}
          className={`${isSidebarOpen ? 'block' : 'hidden'
            } md:block fixed z-30 top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white shadow-md border-r border-blue-100 transition-all duration-300 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
                        onClick={() => item.name === 'Accounts' ? handleAccountsClick() : navigateTo(item.name)}
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

            {/* Desktop logout button */}
            <div className="mt-8 hidden md:block">
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 rounded-md text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-3" />
                <span>Logout</span>
              </button>
            </div>

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

        {/* Main content area - Adjust margin for fixed sidebar */}
        <div className={`flex-1 p-4 md:p-8 md:ml-64 overflow-y-auto ${mobileSubMenuOpen ? 'pb-32' : 'pb-20'} md:pb-8`}>
          {activePage === 'Dashboard' ? (
            <>
              <div className="mb-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold text-blue-800">Dashboard</h1>
                    <p className="text-blue-600">Manage your saree voucher workflow</p>
                  </div>
                  <button
                    onClick={() => fetchDashboardStats(true)}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    title="Refresh dashboard stats"
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                {/* Add welcome message for admin */}
                {userData && (
                  <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-lg font-medium text-blue-800">
                      Hello, {userData.firstName} {userData.surname}
                      {userData.companyName && (
                        <span className="text-blue-600"> - {userData.companyName}</span>
                      )}
                    </p>
                    <p className="text-sm text-blue-600 mt-1">Welcome to your admin dashboard</p>
                  </div>
                )}
              </div>

              {/* Stats Cards - Updated with real data - responsive grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 mb-6">
                {Object.entries(statCardDetails).map(([cardName, cardData]) => {
                  const Icon = cardData.icon;
                  const isExpanded = expandedCard === cardName;
                  const isHovered = hoveredCard === cardName;
                  const colorVariants = {
                    blue: {
                      icon: 'text-blue-600',
                      title: 'text-blue-700',
                      value: 'text-blue-800',
                      border: 'border-blue-100',
                      hover: 'hover:border-blue-200 hover:shadow-md',
                      expanded: 'border-blue-300 shadow-lg',
                      bg: 'bg-blue-50',
                      button: 'bg-blue-600 hover:bg-blue-700 text-white'
                    },
                    green: {
                      icon: 'text-green-600',
                      title: 'text-green-700',
                      value: 'text-green-800',
                      border: 'border-green-100',
                      hover: 'hover:border-green-200 hover:shadow-md',
                      expanded: 'border-green-300 shadow-lg',
                      bg: 'bg-green-50',
                      button: 'bg-green-600 hover:bg-green-700 text-white'
                    },
                    amber: {
                      icon: 'text-amber-600',
                      title: 'text-amber-700',
                      value: 'text-amber-800',
                      border: 'border-amber-100',
                      hover: 'hover:border-amber-200 hover:shadow-md',
                      expanded: 'border-amber-300 shadow-lg',
                      bg: 'bg-amber-50',
                      button: 'bg-amber-600 hover:bg-amber-700 text-white'
                    }
                  };
                  const colors = colorVariants[cardData.color as keyof typeof colorVariants];

                  return (
                    <div
                      key={cardName}
                      className={`bg-white rounded-lg shadow-sm border transition-all duration-300 cursor-pointer ${colors.border
                        } ${colors.hover} ${isExpanded ? colors.expanded : ''} ${isHovered ? 'transform scale-105' : ''
                        }`}
                      onClick={() => handleCardClick(cardName)}
                      onMouseEnter={() => setHoveredCard(cardName)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      {/* Main Card Content */}
                      <div className="p-4 md:p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Icon className={`h-5 w-5 ${colors.icon}`} />
                            <div className="ml-3">
                              <h2 className={`${colors.title} font-medium text-sm`}>{cardData.title}</h2>
                              <p className={`text-xl font-semibold ${colors.value}`}>{cardData.value}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {isHovered && (
                              <div className="animate-pulse">
                                <Info className={`h-4 w-4 ${colors.icon}`} />
                              </div>
                            )}
                            <ChevronRight
                              className={`h-4 w-4 ${colors.icon} transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''
                                }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className={`border-t ${colors.border} ${colors.bg} p-4 md:p-5 animate-fade-in`}>
                          <div className="space-y-3">
                            {/* Short Description */}
                            <div>
                              <p className="text-sm text-gray-700 leading-relaxed">
                                {cardData.shortDescription}
                              </p>
                            </div>

                            {/* Action Button */}
                            <div className="pt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCardAction(cardName);
                                }}
                                className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${colors.button}`}
                              >
                                {cardData.actionText}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 mb-6">
                <button
                  onClick={() => navigateTo('Create New Voucher')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Create New Voucher
                </button>
                <button
                  onClick={() => navigateTo('Add User')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </button>
              </div>

              {/* Today's Vouchers */}
              <div className="mb-8">
                <TodayVouchers />
              </div>
            </>
          ) : (
            renderContent()
          )}
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
                  {/* Notification indicator example - could be dynamic based on data */}
                  {item.name === 'Vouchers' && dashboardStats.pendingVouchers > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {dashboardStats.pendingVouchers > 9 ? '9+' : dashboardStats.pendingVouchers}
                    </span>
                  )}
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
