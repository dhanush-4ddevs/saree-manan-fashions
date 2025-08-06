'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Phone, User, MapPin, Building, Save } from 'lucide-react';

export default function AddVendor() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    address: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Here you would typically make an API call to save the vendor
      console.log('Adding vendor:', formData);
      router.push('/admin-dashboard');
    } catch (err) {
      setError('Failed to add vendor. Please try again.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden md:max-w-2xl">
            <div className="p-8">
              <div className="flex items-center mb-6">
                <button
                  onClick={() => router.back()}
                  className="flex items-center text-blue-600 hover:text-blue-800 transition-colors duration-200"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back to Dashboard
                </button>
              </div>

              <div className="flex items-center mb-6">
                <Building className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-bold text-blue-800">Add New Vendor</h2>
              </div>

              {error && (
                <div className="mb-4 text-red-500 text-sm text-center bg-red-50 p-2 rounded-md border border-red-100">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-blue-700">
                    Vendor Name
                  </label>
                  <div className="mt-1 relative">
                    <User className="absolute left-3 top-2.5 h-5 w-5 text-blue-400" />
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="appearance-none block w-full pl-10 pr-3 py-2 border border-blue-300 rounded-md shadow-sm placeholder-blue-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter vendor name"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-blue-700">
                    Phone Number
                  </label>
                  <div className="mt-1 relative">
                    <Phone className="absolute left-3 top-2.5 h-5 w-5 text-blue-400" />
                    <input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      required
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      className="appearance-none block w-full pl-10 pr-3 py-2 border border-blue-300 rounded-md shadow-sm placeholder-blue-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-blue-700">
                    Address
                  </label>
                  <div className="mt-1 relative">
                    <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-blue-400" />
                    <textarea
                      id="address"
                      name="address"
                      required
                      value={formData.address}
                      onChange={handleChange}
                      rows={3}
                      className="appearance-none block w-full pl-10 pr-3 py-2 border border-blue-300 rounded-md shadow-sm placeholder-blue-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter vendor address"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-blue-100">
                  <button
                    type="submit"
                    className="flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Add Vendor
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
