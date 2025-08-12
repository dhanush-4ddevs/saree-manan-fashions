import jsPDF from 'jspdf';
import { Voucher } from '../types/voucher';
import { printSingleVoucher } from './printsinglevoucher';
import { printSingleVoucherAlt } from './printsinglevoucher_alt';

// Legacy function - now redirects to the new printSingleVoucher
export const generateVoucherPDF = async (voucher: Voucher) => {
  return await printSingleVoucher(voucher);
};

// Alternate generator used by the alternate print preview (AllVouchers)
export const generateVoucherPDFAlt = async (voucher: Voucher) => {
  return await printSingleVoucherAlt(voucher);
};
