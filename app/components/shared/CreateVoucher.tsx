'use client';

import React, { useState, useEffect } from 'react';
import { FileText, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { VoucherForm, VoucherFormSubmitData } from './VoucherForm';
import { Voucher } from '@/types/voucher';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { getCurrentUser } from '@/config/firebase';
import { getNextAvailableVoucherNumber, VoucherNumberOptions } from '@/utils/voucherNumberGenerator';

// Helper to get today's date as YYYY-MM-DD
const getTodayDateString = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// Helper to get financial year based on a date (April 1st to March 31st)
const getFinancialYear = (dateString: string): { startDate: string, endDate: string, yearLabel: string } => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // getMonth() returns 0-11, so add 1

  let financialYearStart: number;
  if (month >= 4) {
    // If month is April (4) or later, financial year starts this year
    financialYearStart = year;
  } else {
    // If month is Jan-Mar, financial year started previous year
    financialYearStart = year - 1;
  }

  const startDate = `${financialYearStart}-04-01`;
  const endDate = `${financialYearStart + 1}-03-31`;
  const yearLabel = `${financialYearStart}-${financialYearStart + 1}`;

  return { startDate, endDate, yearLabel };
};

export default function CreateVoucher() {
  const router = useRouter();

  // State for selected date, defaulting to today
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString);

  // States for currently displayed voucher number
  const [currentVoucherNo, setCurrentVoucherNo] = useState('');
  const [isGeneratingVoucherNo, setIsGeneratingVoucherNo] = useState(false);

  // Generate voucher number using the new utility
  const generateVoucherNo = async (): Promise<string> => {
    const options: VoucherNumberOptions = {
      strategy: 'financial_year'
    };
    try {
      return await getNextAvailableVoucherNumber(options);
    } catch (error) {
      console.error('Error generating voucher number:', error);
      throw error;
    }
  };

  // Effect to update Voucher number when selectedDate changes
  useEffect(() => {
    const updateVoucherNumber = async () => {
      if (!selectedDate) {
        setCurrentVoucherNo('');
        return;
      }
      setIsGeneratingVoucherNo(true);
      try {
        const newVoucherNo = await generateVoucherNo();
        setCurrentVoucherNo(newVoucherNo);
      } catch (error) {
        console.error('Error generating voucher number:', error);
        setCurrentVoucherNo(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsGeneratingVoucherNo(false);
      }
    };
    updateVoucherNumber();
  }, [selectedDate]);

  const handleVoucherSubmit = async (data: VoucherFormSubmitData) => {
    const { formData, images } = data;
    const dateParts = selectedDate.split('-');
    const SDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
    if (isNaN(SDate.getTime()) || SDate.getDate() !== Number(dateParts[2])) {
      console.error("Invalid date on submit");
      return;
    }
    try {
      const finalVoucherNo = await generateVoucherNo();
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      const newVoucher: Voucher = {
        voucher_no: finalVoucherNo,
        voucher_status: 'Dispatched',
        created_at: selectedDate,
        created_by_user_id: currentUser.uid,
        item_details: {
          item_name: formData.item,
          images: [], // You may want to handle images separately
          initial_quantity: formData.quantity,
          supplier_name: formData.supplierName,
          supplier_price_per_piece: formData.supplierPrice
        },
        events: [],
        // Status tracking fields
        total_dispatched: formData.quantity,
        total_received: 0,
        total_forwarded: 0,
        total_missing_on_arrival: 0,
        total_damaged_on_arrival: 0,
        total_damaged_after_work: 0,
        admin_received_quantity: 0
      };
      await addDoc(collection(db, 'vouchers'), newVoucher);
      router.push('/admin-dashboard/vouchers');
    } catch (error) {
      console.error('Error saving voucher:', error);
      alert('Error saving voucher. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-2">
      <div className="flex items-center mb-6">
        <PlusCircle className="h-5 w-5 text-blue-600 mr-2" />
        <h2 className="text-xl font-bold text-blue-800">Create New Voucher</h2>
      </div>

      <div className="mb-4">
        <label htmlFor="voucherDate" className="block text-sm font-medium text-gray-700 mb-1">
          Voucher Date
        </label>
        <input
          type="date"
          id="voucherDate"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
        />
        {isGeneratingVoucherNo && (
          <p className="text-sm text-gray-500 mt-1">Generating voucher number...</p>
        )}
      </div>

      <VoucherForm
        onSubmit={handleVoucherSubmit}
        editingVoucher={null}
        initialVoucherNo={currentVoucherNo}
      />
    </div>
  );
}
