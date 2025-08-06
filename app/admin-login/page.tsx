'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Phone, Lock, LogIn, ShieldCheck, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { loginWithPhoneAndPassword, createDefaultAdminIfNotExists } from '@/config/firebase';
import { PasswordChangeForm } from '@/components/shared/PasswordChangeForm';
import Image from 'next/image';

export default function AdminLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const router = useRouter();

  // Initialize default admin on first load
  useEffect(() => {
    const init = async () => {
      try {
        // Create default admin
        await createDefaultAdminIfNotExists();
      } catch (error) {
        console.error('Error creating default admin:', error);
      }
    };
    init();
  }, []);

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await loginWithPhoneAndPassword(phone, password);

      if (user.requiresPasswordChange) {
        // First check if user is admin before showing password change
        if (user.role !== 'admin') {
          setError('Access denied. Only admins can login here.');
          setLoading(false);
          return;
        }

        // If first login and is admin, show password change form
        setUserData(user);
        setRequirePasswordChange(true);
        setLoading(false);
        return;
      }

      // Regular login flow
      if (user.role === 'admin') {
        router.push('/admin-dashboard');
      } else {
        setError('Access denied. Only admins can login here.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeSuccess = () => {
    // After password change, redirect to admin dashboard
    router.push('/admin-dashboard');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-md border border-blue-100">
        <div className="text-center">
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 py-8 -mx-8 mb-6 rounded-t-xl">
            <div className="flex justify-center">
              <Image
                src="/logo_kraj.png"
                alt="Manan Fashions"
                width={100}
                height={80}
                className="object-contain"
              />
            </div>
          </div>
          <h2 className="text-xl text-blue-600">Admin Login</h2>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-md border border-red-100">
              {error}
            </div>
          )}

          {requirePasswordChange ? (
            <PasswordChangeForm
              onSuccess={handlePasswordChangeSuccess}
              isFirstLogin={true}
            />
          ) : (
            <>
              {/* Admin Phone/Password Login Form */}
              <form onSubmit={handlePhoneLogin} className="space-y-4">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    ADMIN PHONE
                  </label>
                  <div className="mt-1 relative">
                    <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[\s\t]/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Tab') {
                          e.preventDefault();
                        }
                      }}
                      className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="9999999999"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    ADMIN PASSWORD
                  </label>
                  <div className="mt-1 relative">
                    <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value.replace(/[\s\t]/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Tab') {
                          e.preventDefault();
                        }
                      }}
                      className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter admin password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Login as Admin
                </button>
              </form>

              {/* Vendor Login Button */}
              <button
                onClick={() => router.push('/')}
                className="w-full flex justify-center items-center py-2 px-4 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <User className="h-5 w-5 mr-2" />
                Go to Vendor Login
              </button>

              {/* <div className="text-sm text-center text-gray-600">
                <p>Default admin credentials:</p>
                <p>Phone: 9999999999</p>
                <p>Password: admin123</p>
              </div> */}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
