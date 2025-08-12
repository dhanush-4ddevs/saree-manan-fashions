import Link from 'next/link'
import { BellIcon, User, LogOut, Menu, X } from 'lucide-react'
import { useState, useEffect, Dispatch, SetStateAction } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { getCurrentUser } from '../config/firebase'
import { NotificationBell } from '../components/shared/NotificationBell'
import Image from 'next/image';

interface AdminNavbarProps {
  userData?: any;
  handleProfileClick?: () => void;
  handleLogout?: () => Promise<void>;
  isSidebarOpen?: boolean;
  setIsSidebarOpen?: Dispatch<SetStateAction<boolean>>;
  hideMobileMenu?: boolean;
}

const AdminNavbar = ({
  userData,
  handleProfileClick,
  handleLogout,
  isSidebarOpen,
  setIsSidebarOpen,
  hideMobileMenu
}: AdminNavbarProps) => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const [pendingCount, setPendingCount] = useState(0)
  const [currentAdmin, setCurrentAdmin] = useState<any>(null)

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getCurrentUser()
        if (user && user.role === 'admin') {
          setCurrentAdmin(user)
        }
      } catch (error) {
        console.error('Error fetching current user:', error)
      }
    }

    if (!userData) {
      fetchCurrentUser()
    } else {
      setCurrentAdmin(userData)
    }
  }, [userData])

  useEffect(() => {
    const fetchPendingCompletions = async () => {
      try {
        if (!currentAdmin) return

        // Use new event-based approach instead of old forwardVouchers collection
        const vouchersRef = collection(db, 'vouchers')
        const vouchersQuery = query(vouchersRef)
        const vouchersSnapshot = await getDocs(vouchersQuery)

        let count = 0
        for (const docSnap of vouchersSnapshot.docs) {
          const voucherData = docSnap.data()
          if (!voucherData.events || !Array.isArray(voucherData.events)) continue

          // Get forward events to admin that haven't been received yet
          const forwardEventsToAdmin = voucherData.events.filter(event =>
            event.event_type === 'forward' &&
            event.details &&
            event.details.receiver_id === currentAdmin.uid
          )

          // Check which forward events have corresponding receive events
          const receivedForwardEventIds = new Set(
            voucherData.events
              .filter(event => event.event_type === 'receive' && event.user_id === currentAdmin.uid)
              .map(event => event.parent_event_id)
          )

          // Count forward events that haven't been received
          const pendingEvents = forwardEventsToAdmin.filter(event =>
            !receivedForwardEventIds.has(event.event_id)
          )

          count += pendingEvents.length
        }

        setPendingCount(count)

        // Removed duplicate notification creation logic
        // Notifications are already created in ForwardVoucherForm.tsx when vendors submit completion requests
      } catch (error) {
        console.error('Error fetching pending completions:', error)
      }
    }

    if (currentAdmin) {
      fetchPendingCompletions()
      // Set up an interval to refresh the count every minute
      const interval = setInterval(fetchPendingCompletions, 60000)
      return () => clearInterval(interval)
    }
  }, [currentAdmin])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md border-b border-blue-800">
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

          {/* Desktop menu links */}
          {/* <div className="hidden md:flex items-center space-x-4">
            <Link href="/admin-dashboard/vouchers" className={`text-sm font-medium text-white hover:text-blue-100 ${pathname.includes('/admin-dashboard/vouchers') ? 'text-blue-100' : ''}`}>
              <span>Vouchers</span>
            </Link>

            <Link href="/admin-dashboard?tab=Completion Requests" className={`text-sm font-medium text-white hover:text-blue-100 ${
              pathname.includes('/admin-dashboard/completion-requests') ||
              (pathname === '/admin-dashboard' && typeof window !== 'undefined' && window.location.search.includes('tab=Completion+Requests'))
                ? 'text-blue-100'
                : ''
              } flex items-center`}>
              <span>Completion Requests</span>
              {pendingCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs font-medium px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </Link>

            <Link href="/admin/migrate-vouchers" className={`text-sm font-medium text-white hover:text-blue-100 ${pathname === '/admin/migrate-vouchers' ? 'text-blue-100' : ''}`}>
              <span>Data Migration</span>
            </Link>

            <Link href="/admin-dashboard?tab=Accounts" className={`text-sm font-medium text-white hover:text-blue-100 ${
              pathname.includes('/admin-dashboard/accounts') ||
              (pathname === '/admin-dashboard' && typeof window !== 'undefined' && window.location.search.includes('tab=Accounts'))
                ? 'text-blue-100'
                : ''
              }`}>
              <span>Users</span>
            </Link>
          </div> */}

          {/* Desktop nav items */}
          <div className="hidden md:flex items-center space-x-4">
          <div>
              {currentAdmin && <NotificationBell userId={currentAdmin.uid} iconColor="text-white" />}
            </div>


            {currentAdmin && (
              <button
                onClick={handleProfileClick}
                className="flex items-center bg-blue-800/20 px-3 py-1.5 rounded-md hover:bg-blue-800/30 transition-colors"
              >
                {currentAdmin.profilePhotoUrl ? (
                  <div className="relative h-6 w-6 rounded-full overflow-hidden mr-2">
                    <Image
                      src={currentAdmin.profilePhotoUrl}
                      alt="Profile"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <User className="h-5 w-5 text-blue-100 mr-2" />
                )}
                <span className="text-sm font-medium text-white">
                  {currentAdmin.firstName} {currentAdmin.surname || ''}
                  {currentAdmin.companyName && (
                    <span className="text-blue-100"> | {currentAdmin.companyName}</span>
                  )}
                </span>
              </button>
            )}

            {/* Notification Bell */}


            {handleLogout && (
              <button
                onClick={handleLogout}
                className="flex items-center text-white hover:text-blue-100 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Logout
              </button>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="md:hidden flex items-center space-x-4">
            {/* Notification Bell on mobile */}
            {currentAdmin && <NotificationBell userId={currentAdmin.uid} iconColor="text-white" />}

            {/* Mobile logout button */}
            {handleLogout && (
              <button
                onClick={handleLogout}
                className="text-white p-2"
                aria-label="Logout"
                title="Logout"
              >
                <LogOut className="h-6 w-6" />
              </button>
            )}

            {setIsSidebarOpen && !hideMobileMenu && (
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="text-white p-2"
              >
                {isSidebarOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default AdminNavbar
