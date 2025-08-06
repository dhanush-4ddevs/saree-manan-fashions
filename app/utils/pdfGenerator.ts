import jsPDF from 'jspdf';
import { Voucher } from '../types/voucher';
import { printSingleVoucher } from './printsinglevoucher';

// Legacy function - now redirects to the new printSingleVoucher
export const generateVoucherPDF = async (voucher: Voucher) => {
  return await printSingleVoucher(voucher);
};
