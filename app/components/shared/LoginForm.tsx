'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Phone, Lock, LogIn, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { loginWithPhoneAndPassword, getCurrentUser, User, requestPasswordChange } from '@/config/firebase';
import { PasswordChangeForm } from './PasswordChangeForm';

export function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Forgot password modal state
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordPhone, setForgotPasswordPhone] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPhoneError, setForgotPhoneError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          if (pathname === '/') {
            if (user.role === 'admin') {
              router.push('/admin-dashboard');
            } else if (user.role === 'vendor') {
              router.push('/vendor/dashboard');
            }
          } else {
            setUserData(user);
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, [router, pathname]);

  const validatePhoneRealTime = (value: string): string | null => {
    if (!value) return null;
    if (!/^\d+$/.test(value)) return 'Only numbers are allowed.';
    if (!/^[6-9]/.test(value[0])) return 'Phone number must start with 6, 7, 8, or 9.';
    if (value.length < 10) {
      const remaining = 10 - value.length;
      return `Enter ${remaining} more digit${remaining > 1 ? 's' : ''}.`;
    }
    return null;
  };

  const isValidPhoneNumber = (value: string): boolean => {
    return /^\d{10}$/.test(value) && /^[6-9]/.test(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate phone before submit
    if (!isValidPhoneNumber(phone)) {
      setError('Please enter a valid 10-digit phone number starting with 6, 7, 8, or 9.');
      return;
    }

    setLoading(true);

    try {
      const user = await loginWithPhoneAndPassword(phone, password);

      if (user.requiresPasswordChange) {
        // If first login, show password change form
        setUserData(user);
        setRequirePasswordChange(true);
        setLoading(false);
        return;
      }

      // Regular login flow
      if (user) {
        // Redirect based on user role
        if (user.role === 'admin' || user.role === 'master_admin') {
          router.push('/admin-dashboard');
        } else if (user.role === 'vendor') {
          router.push('/vendor/dashboard');
        } else {
          setError('Unknown user role. Please contact support.');
          setLoading(false);
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handlePasswordChangeSuccess = () => {
    // After password change, redirect based on user role
    if (userData.role === 'admin' || userData.role === 'master_admin') {
      router.push('/admin-dashboard');
    } else if (userData.role === 'vendor') {
      router.push('/vendor/dashboard');
    } else {
      setError('Unknown user role after password change. Please contact support.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordError('');
    // Validate before triggering request
    if (!isValidPhoneNumber(forgotPasswordPhone)) {
      setForgotPasswordError('Please enter a valid 10-digit phone number starting with 6, 7, 8, or 9.');
      return;
    }
    setForgotPasswordLoading(true);

    try {
      if (!forgotPasswordPhone.trim()) {
        setForgotPasswordError('Please enter your phone number');
        return;
      }

      await requestPasswordChange(forgotPasswordPhone);
      setForgotPasswordSuccess(true);
      setForgotPasswordPhone('');
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setForgotPasswordError(err.message || 'Failed to request password change. Please try again.');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const openForgotPasswordModal = () => {
    setShowForgotPasswordModal(true);
    setForgotPasswordPhone('');
    setForgotPasswordError('');
    setForgotPasswordSuccess(false);
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
    setForgotPasswordPhone('');
    setForgotPasswordError('');
    setForgotPasswordSuccess(false);
  };

  // If password change is required, show the password change form
  if (requirePasswordChange) {
    return (
      <div className="mt-8 space-y-6">
        <PasswordChangeForm
          onSuccess={handlePasswordChangeSuccess}
          isFirstLogin={true}
        />
      </div>
    );
  }

  // Show a loading spinner while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Otherwise show the normal login form
  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-md border border-red-100">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              PHONE NUMBER
            </label>
            <div className="mt-1 relative">
              <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                id="phone"
                name="phone"
                type="tel"
                maxLength={10}
                required
                value={phone}
                onChange={(e) => {
                  const numeric = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                  setPhone(numeric);
                  setPhoneError(validatePhoneRealTime(numeric));
                }}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Tab') {
                    e.preventDefault();
                  }
                }}
                className={`appearance-none block w-full pl-10 pr-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${phoneError ? 'border-red-500 bg-red-50' : (phone && isValidPhoneNumber(phone) ? 'border-green-500 bg-green-50' : 'border-gray-300')}`}
                placeholder="Enter your phone number"
              />
              {phoneError && (
                <p className="mt-1 text-sm text-red-600">{phoneError}</p>
              )}
              {!phoneError && phone.length === 10 && isValidPhoneNumber(phone) && (
                <p className="mt-1 text-sm text-green-600">✓ Valid phone number</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              PASSWORD
            </label>
            <div className="mt-1 relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/[\s\t]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Tab') {
                    e.preventDefault();
                  }
                }}
                className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
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
            disabled={loading || !!phoneError || !isValidPhoneNumber(phone)}
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4 mr-2" />
            LOGIN
          </button>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={openForgotPasswordModal}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              FORGOT PASSWORD?
            </button>
          </div>

          {/* <div className="text-sm text-center text-gray-600 mt-4">
            <p>For new users: Your default password is your phone number</p>
            <p className="mt-1">Admin access: 9999999999 / admin123</p>
          </div> */}
        </div>
      </form>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Forgot Password
              </h3>
              <button
                onClick={closeForgotPasswordModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!forgotPasswordSuccess ? (
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Need to change your password?</p>
                    <p>Enter your phone number below and click the button to request a password change. An admin will be notified and can help you reset your password.</p>
                  </div>
                </div>

                <form onSubmit={handleForgotPassword}>
                  <div>
                    <label htmlFor="forgotPasswordPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="forgotPasswordPhone"
                      value={forgotPasswordPhone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                        setForgotPasswordPhone(value);
                        setForgotPhoneError(validatePhoneRealTime(value));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Tab') {
                          e.preventDefault();
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${forgotPhoneError ? 'border-red-500 bg-red-50' : (forgotPasswordPhone && isValidPhoneNumber(forgotPasswordPhone) ? 'border-green-500 bg-green-50' : 'border-gray-300')}`}
                      placeholder="Enter your phone number"
                      maxLength={10}
                      required
                    />
                    {forgotPhoneError && (
                      <div className="text-red-600 text-sm bg-red-50 p-2 rounded mt-2">
                        {forgotPhoneError}
                      </div>
                    )}
                  </div>

                  {forgotPasswordError && (
                    <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                      {forgotPasswordError}
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={closeForgotPasswordModal}
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                      disabled={forgotPasswordLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotPasswordLoading || !!forgotPhoneError || !isValidPhoneNumber(forgotPasswordPhone)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {forgotPasswordLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                          Requesting...
                        </>
                      ) : (
                        'Request Password Change'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium">Request Submitted Successfully!</p>
                    <p>Your password change request has been sent to the admin. contact admin and get your password updated.</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={closeForgotPasswordModal}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
