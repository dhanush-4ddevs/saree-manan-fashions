'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Upload, Search } from 'lucide-react';
import VendorProtectedRoute from '../../components/vendor/VendorProtectedRoute';
import VendorNavbar from '../../components/vendor/VendorNavbar';

export default function DamagedVouchers() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  // Mock data for damaged vouchers
  const damagedVouchers = [
    {
      id: 'DMG001',
      voucherNumber: '123456',
      reportDate: '2023-05-15',
      itemDescription: 'Blue Silk Saree with Gold Border',
      damageType: 'Torn fabric',
      status: 'Pending',
      images: ['image1.jpg']
    },
    {
      id: 'DMG002',
      voucherNumber: '789012',
      reportDate: '2023-06-20',
      itemDescription: 'Red Cotton Saree',
      damageType: 'Color bleeding',
      status: 'Approved',
      images: ['image2.jpg', 'image3.jpg']
    },
    {
      id: 'DMG003',
      voucherNumber: '345678',
      reportDate: '2023-07-05',
      itemDescription: 'Green Georgette Saree',
      damageType: 'Missing embroidery',
      status: 'Rejected',
      images: ['image4.jpg']
    }
  ];

  const filteredVouchers = damagedVouchers.filter(voucher => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();

    // Enhanced search across all relevant fields
    return (
      // Basic voucher info
      voucher.id?.toLowerCase().includes(searchLower) ||
      voucher.voucherNumber?.toLowerCase().includes(searchLower) ||
      voucher.reportDate?.toLowerCase().includes(searchLower) ||
      voucher.itemDescription?.toLowerCase().includes(searchLower) ||
      voucher.damageType?.toLowerCase().includes(searchLower) ||
      voucher.status?.toLowerCase().includes(searchLower) ||

      // Search in images array
      voucher.images?.some(img => img.toLowerCase().includes(searchLower)) ||

      // Search in any other string fields
      Object.values(voucher).some(val =>
        typeof val === 'string' && val.toLowerCase().includes(searchLower)
      )
    );
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const damagedVouchersContent = (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 py-6 px-8">
        <div className="flex items-center text-white">
          <div className="bg-white/10 p-3 rounded-full">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold ml-4">Damaged Vouchers</h1>
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-col md:flex-row justify-between mb-6">
          {/* Search Bar */}
          <div className="relative mb-4 md:mb-0 w-full md:w-64">
            <input
              type="text"
              placeholder="Search vouchers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          {/* Report New Damage Button */}
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Report New Damage
          </button>
        </div>

        {/* Damaged Vouchers Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Report ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Voucher Number
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Report Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item Description
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Damage Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVouchers.length > 0 ? (
                filteredVouchers.map((voucher) => (
                  <tr key={voucher.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {voucher.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {voucher.voucherNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {voucher.reportDate}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {voucher.itemDescription}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {voucher.damageType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(voucher.status)}`}>
                        {voucher.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        className="text-blue-600 hover:text-blue-800"
                        onClick={() => {
                          // View details logic
                          alert(`View details for ${voucher.id}`);
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No damaged vouchers found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <VendorProtectedRoute>
      <VendorNavbar>
        {damagedVouchersContent}
      </VendorNavbar>
    </VendorProtectedRoute>
  );
}
