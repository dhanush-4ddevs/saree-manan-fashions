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
  const tableAreaWidth = 170; // total width used previously for single tables
  const gutter = 10;
  const columnWidth = (tableAreaWidth - gutter) / 2; // fits two columns

  // Estimate required space for the taller of the two
  const headerHeight = 10;
  const rowHeight = 8;
  const titleToTableGap = 5;
  const tableBottomExtra = 12;

  const leftHeight = titleToTableGap + headerHeight + (left.data.length * rowHeight) + tableBottomExtra;
  const rightHeight = right ? (titleToTableGap + headerHeight + (right.data.length * rowHeight) + tableBottomExtra) : 0;
  const requiredSpace = Math.max(leftHeight, rightHeight);

  // Page break if needed before drawing
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

  const newY = Math.max(leftBottom, rightBottom) + 3; // spacing after the row
  return { yPosition: newY, currentPage, totalPages };
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
  let imagesDrawnOnPage1 = 0;

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

  // First row: two side-by-side tables
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

  const firstRow = drawTwoColumnTables(
    doc,
    { title: 'Voucher Information', data: voucherData },
    { title: 'Item Details', data: itemData },
    yPosition,
    currentPage,
    totalPages
  );
  yPosition = firstRow.yPosition;
  currentPage = firstRow.currentPage;
  totalPages = firstRow.totalPages;

  // Prepare Vendor & Admin (left) and Transport (right) row
  let vendorData: UserData | null = null;
  try {
    const receiverId = dispatchEvent?.details?.receiver_id;
    if (receiverId) {
      const vendorDoc = await getDoc(firestoreDoc(db, 'users', receiverId));
      if (vendorDoc.exists()) {
        vendorData = vendorDoc.data() as UserData;
      }
    }
  } catch (error) {
    console.error('Error fetching vendor data:', error);
  }

  // Get admin user data for merging
  let adminData: UserData | null = null;
  try {
    const adminDoc = await getDoc(firestoreDoc(db, 'users', voucher.created_by_user_id));
    if (adminDoc.exists()) {
      adminData = adminDoc.data() as UserData;
    }
  } catch (error) {
    console.error('Error fetching admin data:', error);
  }

  const vendorName = vendorData ? `${vendorData.firstName || ''} ${vendorData.surname || ''}`.trim() : 'N/A';
  const adminName = adminData ? `${adminData.firstName || ''} ${adminData.surname || ''}`.trim() : 'N/A';

  const vendorTableData = [
    { label: 'Vendor Name', value: vendorName || 'N/A' },
    { label: 'Vendor Code', value: vendorData?.userCode || 'N/A' },
    { label: 'Company', value: vendorData?.companyName || 'N/A' },
    { label: 'Job Work Type', value: vendorData?.vendorJobWork || jobWork },
    { label: 'Admin Name', value: adminName || 'N/A' }
  ];
  const transportEvent = voucher.events.find(event => event.details?.transport);
  const transportInfo = transportEvent?.details?.transport;

  const transportRight = (transportInfo && transportInfo.transporter_name && transportInfo.lr_no && transportInfo.lr_date)
    ? { title: 'Transport Details', data: [
        { label: 'Transport Name', value: transportInfo.transporter_name || 'N/A' },
        { label: 'LR Number', value: transportInfo.lr_no || 'N/A' },
        { label: 'LR Date', value: transportInfo.lr_date || 'N/A' }
      ] }
    : null;

  const secondRow = drawTwoColumnTables(
    doc,
    { title: 'Vendor Details', data: vendorTableData },
    transportRight,
    yPosition,
    currentPage,
    totalPages
  );
  yPosition = secondRow.yPosition;
  currentPage = secondRow.currentPage;
  totalPages = secondRow.totalPages;

  // Place voucher images on Page 1 directly below the above sections,
  // scaled to fit the remaining space above the footer without changing the existing layout.
  {
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const bottomMargin = 40; // footer space
    const leftMargin = 20;
    const rightMargin = 20;
    const titleGap = 7; // space for section title
    const topGap = 3; // small gap below title

    const imageTitleY = yPosition + 2;
    const imageY = imageTitleY + titleGap + topGap;
    const availableHeight = pageHeight - bottomMargin - imageY;
    const availableWidth = pageWidth - leftMargin - rightMargin;

    if (availableHeight > 8) {
      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.text('Voucher Images', leftMargin, imageTitleY);

      const allImages = voucher.item_details.images || [];
      const imagesPerRow = 2;
      const spacing = 10;
      const imageWidth = (availableWidth - spacing * (imagesPerRow - 1)) / imagesPerRow;
      const imageHeight = Math.min(Math.max(availableHeight - 6, 6), imageWidth * 0.75);

      const toDraw = Math.min(imagesPerRow, allImages.length);
      for (let i = 0; i < toDraw; i++) {
        const img = allImages[i];
        const imgX = leftMargin + i * (imageWidth + spacing);
        const imgY = imageY;
        if (img && img.trim() !== '') {
          try {
            let format: 'JPEG' | 'PNG' = 'JPEG';
            if (img.startsWith('data:image/png')) format = 'PNG';
            doc.addImage(img, format, imgX, imgY, imageWidth, imageHeight);
            imagesDrawnOnPage1 += 1;
          } catch (error) {
            console.error('Error adding voucher image on page 1:', error);
            doc.setFillColor(248, 250, 252);
            doc.rect(imgX, imgY, imageWidth, imageHeight, 'F');
            doc.setDrawColor(226, 232, 240);
            doc.rect(imgX, imgY, imageWidth, imageHeight);
            doc.setTextColor(156, 163, 175);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text('Image not available', imgX + 5, imgY + imageHeight / 2);
            doc.setTextColor(0, 0, 0);
          }
        } else {
          doc.setFillColor(248, 250, 252);
          doc.rect(imgX, imgY, imageWidth, imageHeight, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.rect(imgX, imgY, imageWidth, imageHeight);
          doc.setTextColor(156, 163, 175);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text('No image', imgX + 5, imgY + imageHeight / 2);
          doc.setTextColor(0, 0, 0);
        }
      }

      // Move cursor past the image block
      yPosition = imageY + imageHeight + 6;
    }
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

  // Images Section - show remaining images (skip the first if already drawn on Page 1)
  // if (
  //   voucher.item_details.images &&
  //   voucher.item_details.images.length > imagesDrawnOnPage1
  // ) {
  //   // Check if we need a new page for images
  //   const imagesPerRow = 3; // reduced size to fit three per row
  //   const pageWidth = doc.internal.pageSize.width;
  //   const leftMargin = 20;
  //   const rightMargin = 20;
  //   const containerWidth = pageWidth - leftMargin - rightMargin;
  //   const imageSpacing = 10;
  //   const imageWidth = (containerWidth - imageSpacing * (imagesPerRow - 1)) / imagesPerRow;
  //   const imageHeight = imageWidth * 0.75; // keep similar aspect as before
  //   const remainingCount = voucher.item_details.images.length - imagesDrawnOnPage1;
  //   const totalRows = Math.ceil(remainingCount / imagesPerRow);
  //   const imagesRequiredSpace = 20 + (totalRows * (imageHeight + imageSpacing)) + 20; // Header + images + spacing

  //   const imagesPageBreakResult = checkPageBreak(doc, yPosition, imagesRequiredSpace, currentPage, totalPages);
  //   yPosition = imagesPageBreakResult.yPosition;
  //   currentPage = imagesPageBreakResult.currentPage;
  //   totalPages = imagesPageBreakResult.totalPages;

  // //   doc.setFont('helvetica', 'bold');
  //   doc.setFontSize(17); // Increased font size
  //   doc.setTextColor(0, 0, 0);
  //   doc.text('Voucher Images', 20, yPosition);
  //   yPosition += 5; // Increased spacing

  //   for (let i = imagesDrawnOnPage1; i < voucher.item_details.images.length; i++) {
  //     const logicalIndex = i - imagesDrawnOnPage1;
  //     const image = voucher.item_details.images[i];
  //     const row = Math.floor(logicalIndex / imagesPerRow);
  //     const col = logicalIndex % imagesPerRow;

  //     const imageX = leftMargin + (col * (imageWidth + imageSpacing));
  //     const imageY = yPosition + (row * (imageHeight + imageSpacing));

  //     try {
  //       // Add image to PDF with better error handling
  //       if (image && image.trim() !== '') {
  //         doc.addImage(image, 'JPEG', imageX, imageY, imageWidth, imageHeight);
  //       } else {
  //         throw new Error('Empty image data');
  //       }

  //       // Add image label with better styling
  //       doc.setFontSize(10); // Increased font size
  //       doc.setFont('helvetica', 'bold');
  //       doc.setTextColor(37, 99, 235);
  //       doc.text(`Image ${i + 1}`, imageX, imageY + imageHeight + 6);
  //       doc.setTextColor(0, 0, 0);
  //     } catch (error) {
  //       console.error('Error adding image to PDF:', error);
  //       // If image fails to load, add styled placeholder
  //       doc.setFillColor(248, 250, 252);
  //       doc.rect(imageX, imageY, imageWidth, imageHeight, 'F');
  //       doc.setDrawColor(226, 232, 240);
  //       doc.rect(imageX, imageY, imageWidth, imageHeight);
  //       doc.setTextColor(156, 163, 175);
  //       doc.setFont('helvetica', 'normal');
  //       doc.setFontSize(10);
  //       doc.text('Image not available', imageX + 5, imageY + imageHeight / 2);
  //       doc.setTextColor(0, 0, 0);
  //     }
  //   }

  //   // Update yPosition based on number of images
  //   yPosition += (totalRows * (imageHeight + 15)) + 15; // Increased spacing
  // } else{

  //   const noImagesPageBreakResult = checkPageBreak(doc, yPosition, 10, currentPage, totalPages);
  //   yPosition = noImagesPageBreakResult.yPosition;
  //   currentPage = noImagesPageBreakResult.currentPage;
  //   totalPages = noImagesPageBreakResult.totalPages;

  //   doc.setFont('helvetica', 'bold');
  //   doc.setFontSize(17); // Increased font size
  //   doc.text('Voucher Images', 20, yPosition);
  //   yPosition += 7; // Increased spacing

  //   doc.setFont('helvetica', 'normal');
  //   doc.setFontSize(12); // Increased font size
  //   doc.text('No images available', 20, yPosition);
  //   yPosition += 5; // Increased spacing
  // }

  // Update total pages count for final footer
  totalPages = Math.max(totalPages, currentPage);
  
  // Update footer on the last page with final page count
  addFooter(doc, currentPage, totalPages);

  return doc;
};
