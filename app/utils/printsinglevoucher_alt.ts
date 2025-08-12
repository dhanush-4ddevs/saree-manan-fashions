import jsPDF from 'jspdf';
import { Voucher } from '../types/voucher';
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
  return `${day}/${month}/${year}`;
};

interface UserData {
  uid: string;
  firstName?: string;
  surname?: string;
  userCode?: string;
  designation?: string;
  companyName?: string;
  vendorJobWork?: string;
}

// Helper function to add footer to every page
const addFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  const timestamp = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  doc.text(`Generated on: ${timestamp}          `, 20, pageHeight - 10);
  doc.text('        Manan Fashions - Job Work Tracking System', pageWidth / 2, pageHeight - 10, { align: 'center' });
  doc.text(`Page ${pageNumber}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
};

// Helper function to check if we need a new page
const checkPageBreak = (doc: jsPDF, yPosition: number, requiredSpace: number, currentPage: number, totalPages: number): { yPosition: number; currentPage: number; totalPages: number } => {
  const pageHeight = doc.internal.pageSize.height;
  const margin = 40;
  if (yPosition + requiredSpace > pageHeight - margin) {
    doc.addPage();
    const newPage = currentPage + 1;
    const newTotalPages = Math.max(totalPages, newPage);
    addFooter(doc, newPage, newTotalPages);
    return { yPosition: 30, currentPage: newPage, totalPages: newTotalPages };
  }
  return { yPosition, currentPage, totalPages };
};

// Helper function to draw table with improved styling
const drawTable = (doc: jsPDF, data: Array<{ label: string; value: string }>, startX: number, startY: number, tableWidth: number = 170) => {
  const rowHeight = 8;
  const headerHeight = 10;
  const cellPadding = 4;
  doc.setFillColor(37, 99, 235);
  doc.rect(startX, startY, tableWidth, headerHeight, 'F');
  doc.setDrawColor(29, 78, 216);
  doc.rect(startX, startY, tableWidth, headerHeight);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Description', startX + cellPadding, startY + 6);
  doc.text('Information', startX + tableWidth/2 + cellPadding, startY + 6);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  data.forEach((row, index) => {
    const y = startY + headerHeight + (index * rowHeight);
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(241, 245, 249);
    }
    doc.rect(startX, y, tableWidth, rowHeight, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(startX, y, tableWidth, rowHeight);
    doc.line(startX + tableWidth/2, y, startX + tableWidth/2, y + rowHeight);
    doc.setFont('helvetica', 'bold');
    doc.text(row.label, startX + cellPadding, y + 5);
    doc.setFont('helvetica', 'normal');
    const maxWidth = tableWidth/2 - cellPadding - 2;
    const lines = doc.splitTextToSize(row.value, maxWidth);
    doc.text(lines, startX + tableWidth/2 + cellPadding, y + 5);
  });
  return startY + headerHeight + (data.length * rowHeight) + 12;
};

// Helper to draw two tables side-by-side in a single row
const drawTwoColumnTables = (
  doc: jsPDF,
  left: { title: string; data: Array<{ label: string; value: string }> },
  right: { title: string; data: Array<{ label: string; value: string }> } | null,
  yPosition: number,
  currentPage: number,
  totalPages: number
): { yPosition: number; currentPage: number; totalPages: number } => {
  const contentLeftX = 20;
  const tableAreaWidth = 170;
  const gutter = 10;
  const columnWidth = (tableAreaWidth - gutter) / 2;

  // Estimate required space for the taller of the two
  const headerHeight = 10;
  const rowHeight = 8;
  const titleToTableGap = 5;
  const tableBottomExtra = 12;
  const leftHeight = titleToTableGap + headerHeight + (left.data.length * rowHeight) + tableBottomExtra;
  const rightHeight = right ? (titleToTableGap + headerHeight + (right.data.length * rowHeight) + tableBottomExtra) : 0;
  const requiredSpace = Math.max(leftHeight, rightHeight);

  const pb = checkPageBreak(doc, yPosition, requiredSpace + 6, currentPage, totalPages);
  yPosition = pb.yPosition;
  currentPage = pb.currentPage;
  totalPages = pb.totalPages;

  // Titles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(0, 0, 0);
  doc.text(left.title, contentLeftX, yPosition);
  if (right) {
    const rightX = contentLeftX + columnWidth + gutter;
    doc.text(right.title, rightX, yPosition);
  }
  yPosition += titleToTableGap;

  // Tables
  const leftBottom = drawTable(doc, left.data, contentLeftX, yPosition, columnWidth);
  let rightBottom = yPosition;
  if (right) {
    const rightX = contentLeftX + columnWidth + gutter;
    rightBottom = drawTable(doc, right.data, rightX, yPosition, columnWidth);
  }

  const newY = Math.max(leftBottom, rightBottom) + 3;
  return { yPosition: newY, currentPage, totalPages };
};

// Helper function to draw enhanced job progression timeline
const drawJobProgressionTimeline = async (doc: jsPDF, events: any[], startX: number, startY: number, tableWidth: number = 170) => {
  const headerHeight = 12;
  const minRowHeight = 16;
  const stepColumnWidth = 20;
  const actionColumnWidth = 25;
  const userColumnWidth = 35;
  const dateColumnWidth = 25;
  const commentColumnWidth = tableWidth - stepColumnWidth - actionColumnWidth - userColumnWidth - dateColumnWidth - 8;
  let currentY = startY;
  doc.setFillColor(51, 65, 85);
  doc.rect(startX, currentY, tableWidth, headerHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Step', startX + stepColumnWidth/2, currentY + 8, { align: 'center' });
  doc.text('Action', startX + stepColumnWidth + actionColumnWidth/2, currentY + 8, { align: 'center' });
  doc.text('User Details', startX + stepColumnWidth + actionColumnWidth + userColumnWidth/2, currentY + 8, { align: 'center' });
  doc.text('Date', startX + stepColumnWidth + actionColumnWidth + userColumnWidth + dateColumnWidth/2, currentY + 8, { align: 'center' });
  doc.text('Comments', startX + stepColumnWidth + actionColumnWidth + userColumnWidth + dateColumnWidth + commentColumnWidth/2, currentY + 8, { align: 'center' });
  currentY += headerHeight;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    let userData: UserData | null = null;
    if (event.user_id) {
      try {
        const userDoc = await getDoc(firestoreDoc(db, 'users', event.user_id));
        if (userDoc.exists()) {
          userData = userDoc.data() as UserData;
        }
      } catch {}
    }
    const userName = userData ? `${userData.firstName || ''} ${userData.surname || ''}`.trim() : 'Unknown User';
    const userCode = userData?.userCode || 'N/A';
    const companyName = userData?.companyName || '';
    const eventTypeFormatted = event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1).replace(/_/g, ' ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let commentLines = [] as string[];
    if (event.comment) {
      commentLines = doc.splitTextToSize(event.comment, commentColumnWidth - 4) as string[];
    } else {
      commentLines = ['No comment'];
    }
    const userNameLines = doc.splitTextToSize(userName, userColumnWidth - 6) as string[];
    const userCodeLines = doc.splitTextToSize(`(${userCode})`, userColumnWidth - 6) as string[];
    let companyLines: string[] = [];
    if (companyName) {
      companyLines = doc.splitTextToSize(companyName, userColumnWidth - 6) as string[];
    }
    const lineHeight = 4;
    const commentHeight = commentLines.length * lineHeight;
    const userHeight = (userNameLines.length + userCodeLines.length + companyLines.length) * lineHeight;
    const requiredHeight = Math.max(commentHeight, userHeight, minRowHeight) + 8;
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(241, 245, 249);
    }
    doc.rect(startX, currentY, tableWidth, requiredHeight, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(startX, currentY, tableWidth, requiredHeight);
    const rowCenterY = currentY + requiredHeight / 2;
    doc.setTextColor(37, 99, 235);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text((i + 1).toString(), startX + stepColumnWidth/2, rowCenterY + 3, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(eventTypeFormatted, startX + stepColumnWidth + actionColumnWidth/2, rowCenterY + 3, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const userContentHeight = (userNameLines.length + userCodeLines.length + companyLines.length) * lineHeight;
    const userStartY = rowCenterY - (userContentHeight / 2) + 2;
    doc.text(userNameLines, startX + stepColumnWidth + actionColumnWidth + 3, userStartY);
    doc.setTextColor(75, 85, 99);
    doc.text(userCodeLines, startX + stepColumnWidth + actionColumnWidth + 3, userStartY + (userNameLines.length * lineHeight));
    if (companyName) {
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(7);
      doc.text(companyLines, startX + stepColumnWidth + actionColumnWidth + 3, userStartY + (userNameLines.length * lineHeight) + (userCodeLines.length * lineHeight));
    }
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    const dateText = formatDate(event.timestamp);
    doc.text(dateText, startX + stepColumnWidth + actionColumnWidth + userColumnWidth + dateColumnWidth/2, rowCenterY + 3, { align: 'center' });
    if (event.comment) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      const commentContentHeight = commentLines.length * lineHeight;
      const commentStartY = rowCenterY - (commentContentHeight / 2) + 2;
      doc.text(commentLines, startX + stepColumnWidth + actionColumnWidth + userColumnWidth + dateColumnWidth + 2, commentStartY);
    } else {
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(8);
      doc.text('No comment', startX + stepColumnWidth + actionColumnWidth + userColumnWidth + dateColumnWidth + 2, rowCenterY + 3);
    }
    currentY += requiredHeight;
  }
  return currentY + 15;
};

export const printSingleVoucherAlt = async (voucher: Voucher) => {
  const doc = new jsPDF();
  let currentPage = 1;
  let totalPages = 1;
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
  doc.setDrawColor(29, 78, 216);
  doc.rect(0, 0, doc.internal.pageSize.width, 40);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('MANAN FASHIONS', doc.internal.pageSize.width / 2, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text('JOB-WORK TRACKING VOUCHER', doc.internal.pageSize.width / 2, 28, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  addFooter(doc, currentPage, totalPages);
  let yPosition = 55;
  // First row: two side-by-side tables
  doc.setTextColor(0, 0, 0);
  const dispatchEvent = voucher.events.find(event => event.event_type === 'dispatch');
  const jobWork = dispatchEvent?.details.jobWork || 'N/A';
  const voucherData = [
    { label: 'Voucher Number', value: voucher.voucher_no },
    { label: 'Creation Date', value: formatDate(voucher.created_at) },
    { label: 'Status', value: voucher.voucher_status }
  ];
  const itemData = [
    { label: 'Item Name', value: voucher.item_details.item_name },
    { label: 'Quantity', value: `${voucher.item_details.initial_quantity} pieces` },
    { label: 'Job Work Type', value: jobWork }
  ];
  const row1 = drawTwoColumnTables(
    doc,
    { title: 'Voucher Information', data: voucherData },
    { title: 'Item Details', data: itemData },
    yPosition,
    currentPage,
    totalPages
  );
  yPosition = row1.yPosition;
  currentPage = row1.currentPage;
  totalPages = row1.totalPages;
  // Second row: Vendor & Admin (left) and Transport (right)
  let vendorData: UserData | null = null;
  try {
    const receiverId = dispatchEvent?.details?.receiver_id;
    if (receiverId) {
      const vendorDoc = await getDoc(firestoreDoc(db, 'users', receiverId));
      if (vendorDoc.exists()) {
        vendorData = vendorDoc.data() as UserData;
      }
    }
  } catch {}
  // Fetch admin for merged row
  let adminData: UserData | null = null;
  try {
    const adminDoc = await getDoc(firestoreDoc(db, 'users', voucher.created_by_user_id));
    if (adminDoc.exists()) {
      adminData = adminDoc.data() as UserData;
    }
  } catch {}
  const vendorName = vendorData ? `${vendorData.firstName || ''} ${vendorData.surname || ''}`.trim() : 'N/A';
  const adminName = adminData ? `${adminData.firstName || ''} ${adminData.surname || ''}`.trim() : 'N/A';
  const vendorTableData = [
    { label: 'Vendor Name', value: vendorName || 'N/A' },
    { label: 'Vendor Code', value: vendorData?.userCode || 'N/A' },
    { label: 'Company', value: vendorData?.companyName || 'N/A' },
    { label: 'Job Work Type', value: vendorData?.vendorJobWork || jobWork },
    { label: 'Admin Name', value: adminName || 'N/A' },
  ];
  const transportEvent2 = voucher.events.find(event => event.details?.transport);
  const transportInfo2 = transportEvent2?.details?.transport;
  const rightTable = (transportInfo2 && transportInfo2.transporter_name && transportInfo2.lr_no && transportInfo2.lr_date)
    ? { title: 'Transport Details', data: [
        { label: 'Transport Name', value: transportInfo2.transporter_name || 'N/A' },
        { label: 'LR Number', value: transportInfo2.lr_no || 'N/A' },
        { label: 'LR Date', value: transportInfo2.lr_date || 'N/A' }
      ] }
    : null;
  const row2 = drawTwoColumnTables(
    doc,
    { title: 'Vendor Details', data: vendorTableData },
    rightTable,
    yPosition,
    currentPage,
    totalPages
  );
  yPosition = row2.yPosition;
  currentPage = row2.currentPage;
  totalPages = row2.totalPages;
  // Transport details already included in the two-column row above
  const sortedEvents = [...voucher.events].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const tableHeaderHeight = 12;
  const timelineHeaderHeight = 25;
  const minRowHeight = 16;
  const lineHeight = 4;
  const stepColumnWidth = 20;
  const actionColumnWidth = 25;
  const userColumnWidth = 35;
  const dateColumnWidth = 25;
  const commentColumnWidth = 170 - stepColumnWidth - actionColumnWidth - userColumnWidth - dateColumnWidth - 8;
  let estimatedTotalHeight = timelineHeaderHeight + tableHeaderHeight;
  for (const event of sortedEvents) {
    let commentLines = 1;
    if (event.comment) {
      const tempDoc = new jsPDF();
      tempDoc.setFontSize(9);
      commentLines = tempDoc.splitTextToSize(event.comment, commentColumnWidth - 4).length;
    }
    const tempDoc = new jsPDF();
    tempDoc.setFontSize(9);
    const userNameLines = tempDoc.splitTextToSize('Sample User Name', userColumnWidth - 6).length;
    const userCodeLines = tempDoc.splitTextToSize('(Sample Code)', userColumnWidth - 6).length;
    const companyLines = tempDoc.splitTextToSize('Sample Company Name', userColumnWidth - 6).length;
    const userLines = userNameLines + userCodeLines + companyLines;
    const commentHeight = commentLines * lineHeight;
    const userHeight = userLines * lineHeight;
    const rowHeight = Math.max(commentHeight, userHeight, minRowHeight) + 8;
    estimatedTotalHeight += rowHeight;
  }
  const timelineRequiredSpace = estimatedTotalHeight + 20;
  const pageBreakResult = checkPageBreak(doc, yPosition, timelineRequiredSpace, currentPage, totalPages);
  yPosition = pageBreakResult.yPosition;
  currentPage = pageBreakResult.currentPage;
  totalPages = pageBreakResult.totalPages;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Job Progression', 20, yPosition);
  yPosition += 8;
  if (sortedEvents.length > 0) {
    yPosition = await drawJobProgressionTimeline(doc, sortedEvents, 20, yPosition);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(107, 114, 128);
    doc.text('No progression events recorded', 20, yPosition);
    yPosition += 15;
  }
  yPosition += 5;
  if (voucher.item_details.images && voucher.item_details.images.length > 0) {
    const imagesPerRow = 2; // fit two images per row for larger size
    const pageWidth = doc.internal.pageSize.width;
    const leftMargin = 20;
    const rightMargin = 20;
    const containerWidth = pageWidth - leftMargin - rightMargin;
    const imageSpacing = 12; // slight increase to keep balance
    const imageWidth = (containerWidth - imageSpacing * (imagesPerRow - 1)) / imagesPerRow;
    const imageHeight = imageWidth * 0.75; // maintain aspect ratio
    const totalRows = Math.ceil(voucher.item_details.images.length / imagesPerRow);
    const imagesRequiredSpace = 20 + (totalRows * (imageHeight + imageSpacing)) + 20;
    const imagesPageBreakResult = checkPageBreak(doc, yPosition, imagesRequiredSpace, currentPage, totalPages);
    yPosition = imagesPageBreakResult.yPosition;
    currentPage = imagesPageBreakResult.currentPage;
    totalPages = imagesPageBreakResult.totalPages;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(0, 0, 0);
    doc.text('Voucher Images', 20, yPosition);
    yPosition += 5;
    for (let i = 0; i < voucher.item_details.images.length; i++) {
      const image = voucher.item_details.images[i];
      const row = Math.floor(i / imagesPerRow);
      const col = i % imagesPerRow;
      const imageX = leftMargin + (col * (imageWidth + imageSpacing));
      const imageY = yPosition + (row * (imageHeight + imageSpacing));
      try {
        if (image && image.trim() !== '') {
          doc.addImage(image, 'JPEG', imageX, imageY, imageWidth, imageHeight);
        } else {
          throw new Error('Empty image data');
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(37, 99, 235);
        doc.text(`Image ${i + 1}`, imageX, imageY + imageHeight + 6);
        doc.setTextColor(0, 0, 0);
      } catch {
        doc.setFillColor(248, 250, 252);
        doc.rect(imageX, imageY, imageWidth, imageHeight, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(imageX, imageY, imageWidth, imageHeight);
        doc.setTextColor(156, 163, 175);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Image not available', imageX + 5, imageY + imageHeight / 2);
        doc.setTextColor(0, 0, 0);
      }
    }
    yPosition += (totalRows * (imageHeight + 15)) + 15;
  } else {
    const noImagesPageBreakResult = checkPageBreak(doc, yPosition, 10, currentPage, totalPages);
    yPosition = noImagesPageBreakResult.yPosition;
    currentPage = noImagesPageBreakResult.currentPage;
    totalPages = noImagesPageBreakResult.totalPages;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('Voucher Images', 20, yPosition);
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('No images available', 20, yPosition);
    yPosition += 5;
  }
  totalPages = Math.max(totalPages, currentPage);
  addFooter(doc, currentPage, totalPages);
  return doc;
};


