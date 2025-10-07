import jsPDF from 'jspdf';
import { db } from '../config/firebase';
import { doc as firestoreDoc, getDoc } from 'firebase/firestore';

const formatCurrencyForPDF = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    currencyDisplay: 'code',
  }).format(amount);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export interface PaymentRow {
    id: string;
    vendorId: string;
    vendorName: string;
    vendorCode: string;
    voucherId: string;
    voucherNo: string;
    voucherDate: string;
    itemName: string;
    jobWorkDone: string;
    pricePerPiece: number;
    netQty: number;
    totalAmount: number;
    amountPaid: number;
    pendingAmount: number;
    status: 'Paid' | 'Partially Paid' | 'Unpaid';
    voucherStatus: string;
}

interface VendorData {
    uid: string;
    firstName?: string;
    surname?: string;
    vendorCode?: string;
    companyName?: string;
    phone?: string;
    email?: string;
}

// Helper function to add footer to every page
const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  
  // Set footer styling
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  
  // Left side - Generation timestamp
  const timestamp = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  doc.text(`Generated on: ${timestamp}`, 20, pageHeight - 10);
  
  // Center - Company name
  doc.text('Manan Fashions - Payment Management System', pageWidth / 2, pageHeight - 10, { align: 'center' });
  
  // Right side - Page number
  doc.text(`Page ${pageNumber}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
};

// Helper function to check if we need a new page
const checkPageBreak = (doc: jsPDF, yPosition: number, requiredSpace: number, currentPage: number, totalPages: number): { yPosition: number; currentPage: number; totalPages: number } => {
  const pageHeight = doc.internal.pageSize.height;
  const margin = 30; // Reduced margin for landscape mode
  
  if (yPosition + requiredSpace > pageHeight - margin) {
    doc.addPage();
    const newPage = currentPage + 1;
    const newTotalPages = Math.max(totalPages, newPage);
    addFooter(doc, newPage, newTotalPages);
    return { yPosition: 25, currentPage: newPage, totalPages: newTotalPages }; // Start position on new page
  }
  return { yPosition, currentPage, totalPages };
};

// Helper function to draw table with improved styling
const drawTable = (doc: jsPDF, data: Array<{ label: string; value: string }>, startX: number, startY: number, tableWidth: number = 170) => {
  const rowHeight = 8; // Increased for better readability
  const headerHeight = 10; // Increased header height
  const cellPadding = 4; // Increased padding

  // Draw header with gradient effect
  doc.setFillColor(37, 99, 235);
  doc.rect(startX, startY, tableWidth, headerHeight, 'F');
  
  // Add subtle border to header
  doc.setDrawColor(29, 78, 216);
  doc.rect(startX, startY, tableWidth, headerHeight);
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12); // Increased font size
  doc.text('Description', startX + cellPadding, startY + 6);
  doc.text('Information', startX + tableWidth/2 + cellPadding, startY + 6);

  // Draw data rows with improved styling
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10); // Increased font size

  data.forEach((row, index) => {
    const y = startY + headerHeight + (index * rowHeight);

    // Enhanced alternate row colors
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(241, 245, 249);
    }
    doc.rect(startX, y, tableWidth, rowHeight, 'F');

    // Draw borders with better color
    doc.setDrawColor(226, 232, 240);
    doc.rect(startX, y, tableWidth, rowHeight);
    doc.line(startX + tableWidth/2, y, startX + tableWidth/2, y + rowHeight);

    // Add text with better positioning
    doc.setFont('helvetica', 'bold');
    doc.text(row.label, startX + cellPadding, y + 5);
    doc.setFont('helvetica', 'normal');
    
    // Handle long text by wrapping
    const maxWidth = tableWidth/2 - cellPadding - 2;
    const lines = doc.splitTextToSize(row.value, maxWidth);
    doc.text(lines, startX + tableWidth/2 + cellPadding, y + 5);
  });

  return startY + headerHeight + (data.length * rowHeight) + 12; // Increased spacing
};

// Helper function to draw payment details table
const drawPaymentDetailsTable = (doc: jsPDF, paymentRow: PaymentRow, startX: number, startY: number, tableWidth: number = 170) => {
  const rowHeight = 8;
  const headerHeight = 10;
  const cellPadding = 4;

  // Draw header with gradient effect
  doc.setFillColor(37, 99, 235);
  doc.rect(startX, startY, tableWidth, headerHeight, 'F');
  
  // Add subtle border to header
  doc.setDrawColor(29, 78, 216);
  doc.rect(startX, startY, tableWidth, headerHeight);
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Payment Details', startX + cellPadding, startY + 6);

  // Draw data rows with improved styling
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const paymentData = [
    { label: 'Rate per piece', value: `Rs.${paymentRow.pricePerPiece.toLocaleString('en-IN')}` },
    { label: 'Bill Amount', value: `Rs.${paymentRow.totalAmount.toLocaleString('en-IN')}` },
    { label: 'Paid Amount', value: `Rs.${paymentRow.amountPaid.toLocaleString('en-IN')}` },
    { label: 'Pending Amount', value: `Rs.${paymentRow.pendingAmount.toLocaleString('en-IN')}` },
    { label: 'Payment Status', value: paymentRow.status }
  ];

  paymentData.forEach((row, index) => {
    const y = startY + headerHeight + (index * rowHeight);

    // Enhanced alternate row colors
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(241, 245, 249);
    }
    doc.rect(startX, y, tableWidth, rowHeight, 'F');

    // Draw borders with better color
    doc.setDrawColor(226, 232, 240);
    doc.rect(startX, y, tableWidth, rowHeight);
    doc.line(startX + tableWidth/2, y, startX + tableWidth/2, y + rowHeight);

    // Add text with better positioning
    doc.setFont('helvetica', 'bold');
    doc.text(row.label, startX + cellPadding, y + 5);
    doc.setFont('helvetica', 'normal');
    
    // Handle long text by wrapping
    const maxWidth = tableWidth/2 - cellPadding - 2;
    const lines = doc.splitTextToSize(row.value, maxWidth);
    doc.text(lines, startX + tableWidth/2 + cellPadding, y + 5);
  });

  return startY + headerHeight + (paymentData.length * rowHeight) + 12;
};

export const printSinglePayment = async (paymentRow: PaymentRow) => {
  const doc = new jsPDF();
  let currentPage = 1;
  let totalPages = 1;

  // Enhanced blue themed header with gradient effect
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
  
  // Add subtle border to header
  doc.setDrawColor(29, 78, 216);
  doc.rect(0, 0, doc.internal.pageSize.width, 40);

  // Company name and title in white with enhanced styling
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('MANAN FASHIONS', doc.internal.pageSize.width / 2, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text('PAYMENT DETAILS FORMAT', doc.internal.pageSize.width / 2, 28, { align: 'center' });

  // Reset text color for content
  doc.setTextColor(0, 0, 0);

  // Add footer to first page
  addFooter(doc, currentPage, totalPages);

  let yPosition = 55;

  // Get vendor data
  let vendorData: VendorData | null = null;
  try {
    const vendorDoc = await getDoc(firestoreDoc(db, 'users', paymentRow.vendorId));
    if (vendorDoc.exists()) {
      vendorData = vendorDoc.data() as VendorData;
    }
  } catch (error) {
    console.error('Error fetching vendor data:', error);
  }

  // Vendor Details Table
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('VENDOR DETAIL', 20, yPosition);
  yPosition += 5;

  const vendorName = vendorData ? `${vendorData.firstName || ''} ${vendorData.surname || ''}`.trim() : paymentRow.vendorName;
  const vendorTableData = [
    { label: 'Code', value: vendorData?.vendorCode || paymentRow.vendorCode || 'N/A' },
    { label: 'Name', value: vendorName },
    { label: 'Company Name', value: vendorData?.companyName || 'N/A' },
    { label: 'Phone', value: vendorData?.phone || 'N/A' },
    { label: 'Email', value: vendorData?.email || 'N/A' }
  ];

  yPosition = drawTable(doc, vendorTableData, 20, yPosition);

  yPosition += 3;

  // Voucher Details Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('VOUCHER DETAIL', 20, yPosition);
  yPosition += 5;

  const voucherTableData = [
    { label: 'Voucher No', value: paymentRow.voucherNo },
    { label: 'Voucher Date', value: formatDate(paymentRow.voucherDate) },
    { label: 'Item', value: paymentRow.itemName },
    { label: 'Qty', value: `${paymentRow.netQty} pieces` },
    { label: 'Status', value: paymentRow.voucherStatus }
  ];

  yPosition = drawTable(doc, voucherTableData, 20, yPosition);

  yPosition += 3;

  // Billing Details Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('BILLING DETAILS', 20, yPosition);
  yPosition += 5;

  yPosition = drawPaymentDetailsTable(doc, paymentRow, 20, yPosition);

  // Update total pages count for final footer
  totalPages = Math.max(totalPages, currentPage);
  
  // Update footer on the last page with final page count
  addFooter(doc, currentPage, totalPages);

  return doc;
};

export const printAllPayments = async (paymentRows: PaymentRow[]) => {
  const doc = new jsPDF('landscape'); // Set landscape orientation for better horizontal layout
  let currentPage = 1;
  let totalPages = 1;

  // Enhanced blue themed header with gradient effect
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
  
  // Add subtle border to header
  doc.setDrawColor(29, 78, 216);
  doc.rect(0, 0, doc.internal.pageSize.width, 40);

  // Company name and title in white with enhanced styling
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('MANAN FASHIONS', doc.internal.pageSize.width / 2, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text('ALL PAYMENTS REPORT', doc.internal.pageSize.width / 2, 28, { align: 'center' });

  // Reset text color for content
  doc.setTextColor(0, 0, 0);

  // Add footer to first page
  addFooter(doc, currentPage, totalPages);

  let yPosition = 55;

  // Summary Information
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('SUMMARY', 20, yPosition);
  yPosition += 5;

  const totalPaid = paymentRows.reduce((sum, row) => sum + row.amountPaid, 0);
  const totalPending = paymentRows.reduce((sum, row) => sum + row.pendingAmount, 0);
  const totalAmount = paymentRows.reduce((sum, row) => sum + row.totalAmount, 0);

  const summaryData = [
    { label: 'Total Records', value: paymentRows.length.toString() },
    { label: 'Total Bill Amount', value: `Rs.${totalAmount.toLocaleString('en-IN')}` },
    { label: 'Total Paid Amount', value: `Rs.${totalPaid.toLocaleString('en-IN')}` },
    { label: 'Total Pending Amount', value: `Rs.${totalPending.toLocaleString('en-IN')}` },
    { label: 'Generated Date', value: new Date().toLocaleDateString('en-GB') }
  ];

  // Use full width for summary table in landscape mode
  const pageWidth = doc.internal.pageSize.width;
  const summaryTableWidth = pageWidth - 40; // Leave 20px margin on each side
  yPosition = drawTable(doc, summaryData, 20, yPosition, summaryTableWidth);

  yPosition += 3;

  // Use the same page width for table
  const tableWidth = pageWidth - 40; // Leave 20px margin on each side

  // Calculate column widths for landscape layout - optimized to fit page width
  const totalAvailableWidth = tableWidth - 10; // Leave some padding
  const columnWidths = {
    voucherNo: Math.floor(totalAvailableWidth * 0.11), // ~32px
    vendor: Math.floor(totalAvailableWidth * 0.14),    // ~42px
    code: Math.floor(totalAvailableWidth * 0.07),      // ~21px
    date: Math.floor(totalAvailableWidth * 0.07),      // ~21px
    item: Math.floor(totalAvailableWidth * 0.09),      // ~27px
    jobWork: Math.floor(totalAvailableWidth * 0.09),   // ~27px
    perPiece: Math.floor(totalAvailableWidth * 0.07),  // ~21px
    qty: Math.floor(totalAvailableWidth * 0.04),       // ~12px
    totalAmt: Math.floor(totalAvailableWidth * 0.09),  // ~27px
    paidAmt: Math.floor(totalAvailableWidth * 0.09),   // ~27px
    pendingAmt: Math.floor(totalAvailableWidth * 0.09), // ~27px
    status: Math.floor(totalAvailableWidth * 0.15)     // ~45px - increased for status
  };

  // Calculate required space for the table with dynamic row heights
  const tableHeaderHeight = 10;
  const baseRowHeight = 8;
  
  // Estimate total height by calculating each row's required height
  let estimatedTotalHeight = tableHeaderHeight;
  for (const row of paymentRows) {
    // Create a temporary doc to calculate text wrapping
    const tempDoc = new jsPDF('landscape');
    tempDoc.setFontSize(7);
    
    // Check how many lines each column needs
    const voucherLines = tempDoc.splitTextToSize(row.voucherNo, columnWidths.voucherNo - 2).length;
    const vendorLines = tempDoc.splitTextToSize(row.vendorName, columnWidths.vendor - 2).length;
    const codeLines = tempDoc.splitTextToSize(row.vendorCode, columnWidths.code - 2).length;
    const dateLines = tempDoc.splitTextToSize(formatDate(row.voucherDate), columnWidths.date - 2).length;
    const itemLines = tempDoc.splitTextToSize(row.itemName, columnWidths.item - 2).length;
    const jobWorkLines = tempDoc.splitTextToSize(row.jobWorkDone, columnWidths.jobWork - 2).length;
    const perPieceLines = tempDoc.splitTextToSize(`Rs.${row.pricePerPiece}`, columnWidths.perPiece - 2).length;
    const qtyLines = tempDoc.splitTextToSize(row.netQty.toString(), columnWidths.qty - 2).length;
    const totalLines = tempDoc.splitTextToSize(`Rs.${row.totalAmount.toLocaleString('en-IN')}`, columnWidths.totalAmt - 2).length;
    const paidLines = tempDoc.splitTextToSize(`Rs.${row.amountPaid.toLocaleString('en-IN')}`, columnWidths.paidAmt - 2).length;
    const pendingLines = tempDoc.splitTextToSize(`Rs.${row.pendingAmount.toLocaleString('en-IN')}`, columnWidths.pendingAmt - 2).length;
    const statusLines = tempDoc.splitTextToSize(row.status, columnWidths.status - 2).length;
    
    const maxLines = Math.max(1, voucherLines, vendorLines, codeLines, dateLines, itemLines, jobWorkLines, perPieceLines, qtyLines, totalLines, paidLines, pendingLines, statusLines);
    estimatedTotalHeight += baseRowHeight * maxLines;
  }
  
  // Add space for the title and some padding
  const tableRequiredSpace = estimatedTotalHeight + 30;

  // Check if we need a new page for the table
  const pageBreakResult = checkPageBreak(doc, yPosition, tableRequiredSpace, currentPage, totalPages);
  yPosition = pageBreakResult.yPosition;
  currentPage = pageBreakResult.currentPage;
  totalPages = pageBreakResult.totalPages;

  // Payment Details Table Title - now on the new page
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('PAYMENT DETAILS', 20, yPosition);
  yPosition += 5; // Add more space after the title

  // Draw table header
  doc.setFillColor(37, 99, 235);
  doc.rect(20, yPosition, tableWidth, tableHeaderHeight, 'F');
  
  doc.setDrawColor(29, 78, 216);
  doc.rect(20, yPosition, tableWidth, tableHeaderHeight);
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8); // Reduced font size for better fit

  // Draw column headers with proper positioning
  let headerX = 25;
  
  doc.text('Voucher', headerX, yPosition + 6);
  headerX += columnWidths.voucherNo;
  
  doc.text('Vendor company', headerX, yPosition + 6);
  headerX += columnWidths.vendor;
  
  doc.text('Code', headerX, yPosition + 6);
  headerX += columnWidths.code;
  
  doc.text('Date', headerX, yPosition + 6);
  headerX += columnWidths.date;
  
  doc.text('Item', headerX, yPosition + 6);
  headerX += columnWidths.item;
  
  doc.text('Job Work', headerX, yPosition + 6);
  headerX += columnWidths.jobWork;
  
  doc.text('Per Piece', headerX, yPosition + 6);
  headerX += columnWidths.perPiece;
  
  doc.text('Qty', headerX, yPosition + 6);
  headerX += columnWidths.qty;
  
  doc.text('Total', headerX, yPosition + 6);
  headerX += columnWidths.totalAmt;
  
  doc.text('Paid', headerX, yPosition + 6);
  headerX += columnWidths.paidAmt;
  
  doc.text('Pending', headerX, yPosition + 6);
  headerX += columnWidths.pendingAmt;
  
  doc.text('Status', headerX, yPosition + 6);

  yPosition += tableHeaderHeight;

  // Draw table rows
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7); // Reduced font size for better fit

  paymentRows.forEach((row, index) => {
    // Calculate dynamic row height based on content
    let maxLines = 1;
    
    // Check how many lines each column needs
    const voucherLines = doc.splitTextToSize(row.voucherNo, columnWidths.voucherNo - 2).length;
    const vendorLines = doc.splitTextToSize(row.vendorName, columnWidths.vendor - 2).length;
    const codeLines = doc.splitTextToSize(row.vendorCode, columnWidths.code - 2).length;
    const dateLines = doc.splitTextToSize(formatDate(row.voucherDate), columnWidths.date - 2).length;
    const itemLines = doc.splitTextToSize(row.itemName, columnWidths.item - 2).length;
    const jobWorkLines = doc.splitTextToSize(row.jobWorkDone, columnWidths.jobWork - 2).length;
    const perPieceLines = doc.splitTextToSize(`Rs.${row.pricePerPiece}`, columnWidths.perPiece - 2).length;
    const qtyLines = doc.splitTextToSize(row.netQty.toString(), columnWidths.qty - 2).length;
    const totalLines = doc.splitTextToSize(`Rs.${row.totalAmount.toLocaleString('en-IN')}`, columnWidths.totalAmt - 2).length;
    const paidLines = doc.splitTextToSize(`Rs.${row.amountPaid.toLocaleString('en-IN')}`, columnWidths.paidAmt - 2).length;
    const pendingLines = doc.splitTextToSize(`Rs.${row.pendingAmount.toLocaleString('en-IN')}`, columnWidths.pendingAmt - 2).length;
    const statusLines = doc.splitTextToSize(row.status, columnWidths.status - 2).length;
    
    maxLines = Math.max(maxLines, voucherLines, vendorLines, codeLines, dateLines, itemLines, jobWorkLines, perPieceLines, qtyLines, totalLines, paidLines, pendingLines, statusLines);
    
    const dynamicRowHeight = baseRowHeight * maxLines;
    
    // Row background
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(241, 245, 249);
    }
    doc.rect(20, yPosition, tableWidth, dynamicRowHeight, 'F');

    // Row borders
    doc.setDrawColor(226, 232, 240);
    doc.rect(20, yPosition, tableWidth, dynamicRowHeight);

    // Row data with proper column positioning and text wrapping
    let currentX = 25;
    
    // Voucher No
    const voucherText = doc.splitTextToSize(row.voucherNo, columnWidths.voucherNo - 2);
    doc.text(voucherText, currentX, yPosition + 5);
    currentX += columnWidths.voucherNo;
    
    // Vendor
    const vendorText = doc.splitTextToSize(row.vendorName, columnWidths.vendor - 2);
    doc.text(vendorText, currentX, yPosition + 5);
    currentX += columnWidths.vendor;
    
    // Code
    const codeText = doc.splitTextToSize(row.vendorCode, columnWidths.code - 2);
    doc.text(codeText, currentX, yPosition + 5);
    currentX += columnWidths.code;
    
    // Date
    const dateText = doc.splitTextToSize(formatDate(row.voucherDate), columnWidths.date - 2);
    doc.text(dateText, currentX, yPosition + 5);
    currentX += columnWidths.date;
    
    // Item
    const itemText = doc.splitTextToSize(row.itemName, columnWidths.item - 2);
    doc.text(itemText, currentX, yPosition + 5);
    currentX += columnWidths.item;
    
    // Job Work
    const jobWorkText = doc.splitTextToSize(row.jobWorkDone, columnWidths.jobWork - 2);
    doc.text(jobWorkText, currentX, yPosition + 5);
    currentX += columnWidths.jobWork;
    
    // Per Piece
    const perPieceText = doc.splitTextToSize(`Rs.${row.pricePerPiece}`, columnWidths.perPiece - 2);
    doc.text(perPieceText, currentX, yPosition + 5);
    currentX += columnWidths.perPiece;
    
    // Qty
    const qtyText = doc.splitTextToSize(row.netQty.toString(), columnWidths.qty - 2);
    doc.text(qtyText, currentX, yPosition + 5);
    currentX += columnWidths.qty;
    
    // Total Amount
    const totalText = doc.splitTextToSize(`Rs.${row.totalAmount.toLocaleString('en-IN')}`, columnWidths.totalAmt - 2);
    doc.text(totalText, currentX, yPosition + 5);
    currentX += columnWidths.totalAmt;
    
    // Paid Amount
    const paidText = doc.splitTextToSize(`Rs.${row.amountPaid.toLocaleString('en-IN')}`, columnWidths.paidAmt - 2);
    doc.text(paidText, currentX, yPosition + 5);
    currentX += columnWidths.paidAmt;
    
    // Pending Amount
    const pendingText = doc.splitTextToSize(`Rs.${row.pendingAmount.toLocaleString('en-IN')}`, columnWidths.pendingAmt - 2);
    doc.text(pendingText, currentX, yPosition + 5);
    currentX += columnWidths.pendingAmt;
    
    // Status - with proper text wrapping
    const statusText = doc.splitTextToSize(row.status, columnWidths.status - 2);
    doc.text(statusText, currentX, yPosition + 5);

    yPosition += dynamicRowHeight;
  });

  // Update total pages count for final footer
  totalPages = Math.max(totalPages, currentPage);
  
  // Update footer on the last page with final page count
  addFooter(doc, currentPage, totalPages);

  return doc;
}; 