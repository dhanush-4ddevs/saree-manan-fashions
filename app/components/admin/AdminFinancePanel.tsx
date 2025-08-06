'use client';

import { useState, useEffect } from 'react';
import { IndianRupee, FileText, Users, Phone, Package, Briefcase, Calendar, Search, CreditCard } from 'lucide-react';

interface VendorPayment {
  vendorInvoiceNo: string;
  vendorCode: string;
  voucherDate: string;
  voucherNo: string;
  amount: number;
  vendorName: string;
  vendorPhone: string;
  itemName: string;
  jobWork: string;
  dispatchDate: string;
}

export function AdminFinancePanel() {
  const [vendorPayments, setVendorPayments] = useState<VendorPayment[]>([]);
  const [totalUnpaidAmount, setTotalUnpaidAmount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchVendorPayments = async () => {
      try {
        // Mock data for demonstration
        const mockData: VendorPayment[] = [
          {
            vendorInvoiceNo: 'INV001',
            vendorCode: 'V001',
            voucherDate: '20240315',
            voucherNo: 'VCH001',
            amount: 25000,
            vendorName: 'Sample Vendor',
            vendorPhone: '9876543210',
            itemName: 'Silk Saree',
            jobWork: 'Embroidery',
            dispatchDate: '2024-03-10',
          },
          // Add more mock data as needed
        ];
        setVendorPayments(mockData);
        setTotalUnpaidAmount(mockData.reduce((sum, payment) => sum + payment.amount, 0));
      } catch (error) {
        console.error('Error fetching vendor payments:', error);
      }
    };

    fetchVendorPayments();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN');
  };

  const filteredPayments = vendorPayments.filter(payment => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();

    // Enhanced search across all relevant fields
    return (
      // Basic payment info
      payment.vendorInvoiceNo?.toLowerCase().includes(searchLower) ||
      payment.vendorCode?.toLowerCase().includes(searchLower) ||
      payment.voucherNo?.toLowerCase().includes(searchLower) ||
      payment.amount?.toString().includes(searchLower) ||

      // Vendor details
      payment.vendorName?.toLowerCase().includes(searchLower) ||
      payment.vendorPhone?.toLowerCase().includes(searchLower) ||

      // Item and job details
      payment.itemName?.toLowerCase().includes(searchLower) ||
      payment.jobWork?.toLowerCase().includes(searchLower) ||

      // Date fields
      payment.voucherDate?.toLowerCase().includes(searchLower) ||
      payment.dispatchDate?.toLowerCase().includes(searchLower) ||

      // Search in any other string fields
      Object.values(payment).some(val =>
        typeof val === 'string' && val.toLowerCase().includes(searchLower)
      )
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-md border border-blue-100 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center">
              <CreditCard className="h-8 w-8 mr-3" />
              <h2 className="text-2xl font-bold">Vendor's Unpaid Amount</h2>
            </div>
            <div className="flex items-center gap-2 text-xl font-bold bg-white text-blue-600 px-4 py-2 rounded-lg shadow-sm">
              <IndianRupee className="h-6 w-6" />
              {formatCurrency(totalUnpaidAmount)}
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-blue-100 bg-blue-50">
          <div className="relative">
            <input
              type="text"
              placeholder="Search vendors or invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-blue-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-blue-100">
            <thead className="bg-blue-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    Invoice Details
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    Vendor Details
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">
                  <div className="flex items-center">
                    <IndianRupee className="h-4 w-4 mr-1" />
                    Amount
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-blue-50">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((payment, index) => (
                  <tr key={index} className="hover:bg-blue-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-700">{payment.vendorInvoiceNo}</div>
                      <div className="text-sm text-blue-600 flex items-center mt-1">
                        <Calendar className="h-4 w-4 mr-1 text-blue-400" />
                        <span>{formatDate(payment.dispatchDate)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-blue-700">{payment.vendorName}</div>
                      <div className="text-sm text-blue-600 space-y-1 mt-1">
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 mr-1 text-blue-400" />
                          <span>{payment.vendorPhone}</span>
                        </div>
                        <div className="flex items-center">
                          <Package className="h-4 w-4 mr-1 text-blue-400" />
                          <span>{payment.itemName}</span>
                        </div>
                        <div className="flex items-center">
                          <Briefcase className="h-4 w-4 mr-1 text-blue-400" />
                          <span>{payment.jobWork}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-700 bg-blue-50 px-3 py-2 rounded-lg inline-flex items-center">
                        <IndianRupee className="h-4 w-4 mr-1 text-blue-600" />
                        {formatCurrency(payment.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-blue-600">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="h-8 w-8 text-blue-400 mb-2" />
                      <p>No payments found matching your search.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
