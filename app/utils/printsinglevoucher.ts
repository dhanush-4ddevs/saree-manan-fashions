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
  const month = date.toLocaleDateString('en-US', { month: 'short' });
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
  doc.text(`Generated on: ${timestamp}          `, 20, pageHeight - 10);
  
  // Center - Company name
  doc.text('        Manan Fashions - Job Work Tracking System', pageWidth / 2, pageHeight - 10, { align: 'center' });
  
  // Right side - Page number
  doc.text(`Page ${pageNumber}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
};

// Helper function to check if we need a new page
const checkPageBreak = (doc: jsPDF, yPosition: number, requiredSpace: number, currentPage: number, totalPages: number): { yPosition: number; currentPage: number; totalPages: number } => {
  const pageHeight = doc.internal.pageSize.height;
  const margin = 40; // Increased bottom margin for footer
  
  if (yPosition + requiredSpace > pageHeight - margin) {
    doc.addPage();
    const newPage = currentPage + 1;
    const newTotalPages = Math.max(totalPages, newPage);
    addFooter(doc, newPage, newTotalPages);
    return { yPosition: 30, currentPage: newPage, totalPages: newTotalPages }; // Start position on new page
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

// Helper function to draw enhanced job progression timeline
const drawJobProgressionTimeline = async (doc: jsPDF, events: any[], startX: number, startY: number, tableWidth: number = 170) => {
  const headerHeight = 12;
  const baseRowHeight = 16;
  const minRowHeight = 16;
  const cellPadding = 6;
  const stepColumnWidth = 20;
  const actionColumnWidth = 25; // Reduced from 30 to 25
  const userColumnWidth = 35; // Reduced from 45 to 35
  const dateColumnWidth = 25;
  const commentColumnWidth = tableWidth - stepColumnWidth - actionColumnWidth - userColumnWidth - dateColumnWidth - 8; // Increased space for comments

  let currentY = startY;

  // Draw table header
  doc.setFillColor(51, 65, 85);
  doc.rect(startX, currentY, tableWidth, headerHeight, 'F');
  
  // Header text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Step', startX + stepColumnWidth/2, currentY + 8, { align: 'center' });
  doc.text('Action', startX + stepColumnWidth + actionColumnWidth/2, currentY + 8, { align: 'center' });
  doc.text('User Details', startX + stepColumnWidth + actionColumnWidth + userColumnWidth/2, currentY + 8, { align: 'center' });
  doc.text('Date', startX + stepColumnWidth + actionColumnWidth + userColumnWidth + dateColumnWidth/2, currentY + 8, { align: 'center' });
  doc.text('Comments', startX + stepColumnWidth + actionColumnWidth + userColumnWidth + dateColumnWidth + commentColumnWidth/2, currentY + 8, { align: 'center' });

  currentY += headerHeight;

  // Draw data rows with dynamic height
  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Get user data for this event
    let userData: UserData | null = null;
    if (event.user_id) {
      try {
        const userDoc = await getDoc(firestoreDoc(db, 'users', event.user_id));
        if (userDoc.exists()) {
          userData = userDoc.data() as UserData;
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    }

    const userName = userData ? `${userData.firstName || ''} ${userData.surname || ''}`.trim() : 'Unknown User';
    const userCode = userData?.userCode || 'N/A';
    const companyName = userData?.companyName || '';

    // Format the event type
    const eventTypeFormatted = event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1).replace(/_/g, ' ');

    // Calculate dynamic row height based on content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    // Calculate comment lines
    let commentLines = [];
    if (event.comment) {
      commentLines = doc.splitTextToSize(event.comment, commentColumnWidth - 4);
    } else {
      commentLines = ['No comment'];
    }
    
    // Calculate user details lines with wrapping
    const userNameLines = doc.splitTextToSize(userName, userColumnWidth - 6);
    const userCodeLines = doc.splitTextToSize(`(${userCode})`, userColumnWidth - 6);
    let companyLines = [];
    if (companyName) {
      companyLines = doc.splitTextToSize(companyName, userColumnWidth - 6);
    }
    
    // Calculate required height for this row
    const lineHeight = 4; // Height per line of text
    const commentHeight = commentLines.length * lineHeight;
    const userHeight = (userNameLines.length + userCodeLines.length + companyLines.length) * lineHeight;
    const requiredHeight = Math.max(commentHeight, userHeight, minRowHeight) + 8; // Add padding

    // Row background
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(241, 245, 249);
    }
    doc.rect(startX, currentY, tableWidth, requiredHeight, 'F');

    // Row borders
    doc.setDrawColor(226, 232, 240);
    doc.rect(startX, currentY, tableWidth, requiredHeight);

    // Calculate vertical center position for this row
    const rowCenterY = currentY + requiredHeight / 2;

    // Step number - perfectly centered vertically
    doc.setTextColor(37, 99, 235);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text((i + 1).toString(), startX + stepColumnWidth/2, rowCenterY + 3, { align: 'center' });

    // Action type - perfectly centered vertically
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(eventTypeFormatted, startX + stepColumnWidth + actionColumnWidth/2, rowCenterY + 3, { align: 'center' });

    // User details - with text wrapping to prevent overflow
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    // Calculate user content center
    const userContentHeight = (userNameLines.length + userCodeLines.length + companyLines.length) * lineHeight;
    const userStartY = rowCenterY - (userContentHeight / 2) + 2;
    
    // User name with wrapping
    doc.text(userNameLines, startX + stepColumnWidth + actionColumnWidth + 3, userStartY);
    
    // User code with wrapping
    doc.setTextColor(75, 85, 99);
    doc.text(userCodeLines, startX + stepColumnWidth + actionColumnWidth + 3, userStartY + (userNameLines.length * lineHeight));
    
    // Company name if available with wrapping
    if (companyName) {
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(7);
      doc.text(companyLines, startX + stepColumnWidth + actionColumnWidth + 3, userStartY + (userNameLines.length * lineHeight) + (userCodeLines.length * lineHeight));
    }

    // Date - perfectly centered vertically
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    const dateText = formatDate(event.timestamp);
    doc.text(dateText, startX + stepColumnWidth + actionColumnWidth + userColumnWidth + dateColumnWidth/2, rowCenterY + 3, { align: 'center' });

    // Comments - vertically centered with dynamic height
    if (event.comment) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      
      // Calculate comment content center
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

export const printSingleVoucher = async (voucher: Voucher) => {
  const doc = new jsPDF();
  let currentPage = 1;
  let totalPages = 1; // Will be updated as pages are added

  // Enhanced blue themed header with gradient effect
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F'); // Increased height
  
  // Add subtle border to header
  doc.setDrawColor(29, 78, 216);
  doc.rect(0, 0, doc.internal.pageSize.width, 40);

  // Company name and title in white with enhanced styling
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24); // Increased font size
  doc.setFont('helvetica', 'bold');
  doc.text('MANAN FASHIONS', doc.internal.pageSize.width / 2, 20, { align: 'center' });
  doc.setFontSize(10); // Increased font size
  doc.text('JOB-WORK TRACKING VOUCHER', doc.internal.pageSize.width / 2, 28, { align: 'center' });

  // Reset text color for content
  doc.setTextColor(0, 0, 0);

  // Add footer to first page
  addFooter(doc, currentPage, totalPages);

  let yPosition = 55; // Increased starting position

  // Voucher Information Table
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17); // Increased font size
  doc.text('Voucher Information', 20, yPosition);
  yPosition += 5; // Increased spacing

  const voucherData = [
    { label: 'Voucher Number', value: voucher.voucher_no },
    { label: 'Creation Date', value: formatDate(voucher.created_at) },
    { label: 'Status', value: voucher.voucher_status }
  ];

  yPosition = drawTable(doc, voucherData, 20, yPosition);

  yPosition += 3; // Increased spacing
  
  // Item Details Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17); // Increased font size
  doc.text('Item Details', 20, yPosition);
  yPosition += 5; // Increased spacing

  const dispatchEvent = voucher.events.find(event => event.event_type === 'dispatch');
  const jobWork = dispatchEvent?.details.jobWork || 'N/A';

  const itemData = [
    { label: 'Item Name', value: voucher.item_details.item_name },
    { label: 'Quantity', value: `${voucher.item_details.initial_quantity} pieces` },
    { label: 'Job Work Type', value: jobWork }
  ];

  yPosition = drawTable(doc, itemData, 20, yPosition);

  yPosition += 3; // Increased spacing

  // Admin Details Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17); // Increased font size
  doc.text('Admin Details', 20, yPosition);
  yPosition += 5; // Increased spacing

  // Get admin user data
  let adminData: UserData | null = null;
  try {
    const adminDoc = await getDoc(firestoreDoc(db, 'users', voucher.created_by_user_id));
    if (adminDoc.exists()) {
      adminData = adminDoc.data() as UserData;
    }
  } catch (error) {
    console.error('Error fetching admin data:', error);
  }

  const adminName = adminData ? `${adminData.firstName || ''} ${adminData.surname || ''}`.trim() : 'N/A';

  const adminTableData = [
    { label: 'Admin Name', value: adminName },
    { label: 'User Code', value: adminData?.userCode || 'N/A' },
    { label: 'Designation', value: adminData?.designation || 'Admin' },
    { label: 'Company', value: adminData?.companyName || 'MANAN FASHIONS' }
  ];

  yPosition = drawTable(doc, adminTableData, 20, yPosition);

  yPosition += 3; // Increased spacing

  // Transport Details Table (if available)
  // Find transport information from any event that has it
  const transportEvent = voucher.events.find(event => event.details?.transport);
  const transportInfo = transportEvent?.details?.transport;
  
  if (transportInfo && transportInfo.transporter_name && transportInfo.lr_no && transportInfo.lr_date) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17); // Increased font size
    doc.text('Transport Details', 20, yPosition);
    yPosition += 5; // Increased spacing

    const transportData = [
      { label: 'Transport Name', value: transportInfo.transporter_name || 'N/A' },
      { label: 'LR Number', value: transportInfo.lr_no || 'N/A' },
      { label: 'LR Date', value: transportInfo.lr_date || 'N/A' }
    ];

    yPosition = drawTable(doc, transportData, 20, yPosition);
  }

  // Sort events by timestamp for timeline
  const sortedEvents = [...voucher.events].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Calculate required space for dynamic timeline table
  const tableHeaderHeight = 12;
  const timelineHeaderHeight = 25;
  const minRowHeight = 16;
  const lineHeight = 4;
  const stepColumnWidth = 20;
  const actionColumnWidth = 25;
  const userColumnWidth = 35;
  const dateColumnWidth = 25;
  const commentColumnWidth = 170 - stepColumnWidth - actionColumnWidth - userColumnWidth - dateColumnWidth - 8; // Calculate available comment width with new column widths
  
  // Estimate total height by calculating each row's required height
  let estimatedTotalHeight = timelineHeaderHeight + tableHeaderHeight;
  for (const event of sortedEvents) {
    let commentLines = 1;
    if (event.comment) {
      // Create a temporary doc to calculate text wrapping
      const tempDoc = new jsPDF();
      tempDoc.setFontSize(9);
      commentLines = tempDoc.splitTextToSize(event.comment, commentColumnWidth - 4).length;
    }
    
         // Estimate user details lines with wrapping
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
  
  const timelineRequiredSpace = estimatedTotalHeight + 20; // Extra buffer

  // Check if we need a new page for the timeline section
  const pageBreakResult = checkPageBreak(doc, yPosition, timelineRequiredSpace, currentPage, totalPages);
  yPosition = pageBreakResult.yPosition;
  currentPage = pageBreakResult.currentPage;
  totalPages = pageBreakResult.totalPages;

  // Enhanced Job Progression Timeline
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18); // Increased font size
  doc.text('Job Progression', 20, yPosition);
  yPosition += 8; // Increased spacing

  if (sortedEvents.length > 0) {
    yPosition = await drawJobProgressionTimeline(doc, sortedEvents, 20, yPosition);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(107, 114, 128);
    doc.text('No progression events recorded', 20, yPosition);
    yPosition += 15;
  }

  yPosition += 5; // Increased spacing

  // Images Section - Improved to ensure images display
  if (voucher.item_details.images && voucher.item_details.images.length > 0) {
    // Check if we need a new page for images
    const imagesPerRow = 2;
    const imageWidth = 80; // Increased size
    const imageHeight = 60; // Increased size
    const imageSpacing = 15; // Increased spacing
    const totalRows = Math.ceil(voucher.item_details.images.length / imagesPerRow);
    const imagesRequiredSpace = 20 + (totalRows * (imageHeight + 15)) + 20; // Header + images + spacing

    const imagesPageBreakResult = checkPageBreak(doc, yPosition, imagesRequiredSpace, currentPage, totalPages);
    yPosition = imagesPageBreakResult.yPosition;
    currentPage = imagesPageBreakResult.currentPage;
    totalPages = imagesPageBreakResult.totalPages;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17); // Increased font size
    doc.setTextColor(0, 0, 0);
    doc.text('Voucher Images', 20, yPosition);
    yPosition += 5; // Increased spacing

    for (let i = 0; i < voucher.item_details.images.length; i++) {
      const image = voucher.item_details.images[i];
      const row = Math.floor(i / imagesPerRow);
      const col = i % imagesPerRow;

      const imageX = 20 + (col * (imageWidth + imageSpacing));
      const imageY = yPosition + (row * (imageHeight + 15)); // Increased spacing

      try {
        // Add image to PDF with better error handling
        if (image && image.trim() !== '') {
          doc.addImage(image, 'JPEG', imageX, imageY, imageWidth, imageHeight);
        } else {
          throw new Error('Empty image data');
        }

        // Add image label with better styling
        doc.setFontSize(10); // Increased font size
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(37, 99, 235);
        doc.text(`Image ${i + 1}`, imageX, imageY + imageHeight + 6);
        doc.setTextColor(0, 0, 0);
      } catch (error) {
        console.error('Error adding image to PDF:', error);
        // If image fails to load, add styled placeholder
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

    // Update yPosition based on number of images
    yPosition += (totalRows * (imageHeight + 15)) + 15; // Increased spacing
  } else{

    const noImagesPageBreakResult = checkPageBreak(doc, yPosition, 10, currentPage, totalPages);
    yPosition = noImagesPageBreakResult.yPosition;
    currentPage = noImagesPageBreakResult.currentPage;
    totalPages = noImagesPageBreakResult.totalPages;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17); // Increased font size
    doc.text('Voucher Images', 20, yPosition);
    yPosition += 7; // Increased spacing

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12); // Increased font size
    doc.text('No images available', 20, yPosition);
    yPosition += 5; // Increased spacing
  }

  // Update total pages count for final footer
  totalPages = Math.max(totalPages, currentPage);
  
  // Update footer on the last page with final page count
  addFooter(doc, currentPage, totalPages);

  return doc;
};
