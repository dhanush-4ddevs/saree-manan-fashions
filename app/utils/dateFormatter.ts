/**
 * Formats a date string or timestamp to a readable format
 * @param date Date string, Timestamp, or ISO string
 * @returns Formatted date string
 */
export const formatDate = (date: string | Date | any): string => {
  if (!date) return 'N/A';

  try {
    const toDate: Date = date && typeof date.toDate === 'function' ? date.toDate() : (typeof date === 'string' ? new Date(date) : (date instanceof Date ? date : new Date()));

    // Use Intl parts to ensure IST timezone and build dd-MMM-yyyy with hyphens
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).formatToParts(toDate);

    const day = parts.find(p => p.type === 'day')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const year = parts.find(p => p.type === 'year')?.value || '';

    if (!day || !month || !year) return 'N/A';

    return `${day}-${month}-${year}`; // e.g., 29-Sep-2025
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(date);
  }
};

/**
 * Get current local time in IST format
 * @returns Formatted current time string
 */
export const getCurrentISTTime = (): string => {
  return new Date().toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
};

/**
 * Get current date in YYYY-MM-DD format for date inputs
 * @returns Current date string in YYYY-MM-DD format
 */
export const getCurrentDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Validate that from date is not greater than to date
 * @param fromDate Start date string
 * @param toDate End date string
 * @returns Object with isValid boolean and error message if invalid
 */
export const validateDateRange = (fromDate: string, toDate: string): { isValid: boolean; error?: string } => {
  // If both dates are empty, that's valid
  if (!fromDate && !toDate) {
    return { isValid: true };
  }

  // If only one date is provided, that's also valid
  if (!fromDate || !toDate) {
    return { isValid: true };
  }

  try {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    // Check if dates are valid
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return {
        isValid: false,
        error: 'Please enter valid dates'
      };
    }

    // Set time to start of day for accurate comparison
    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);

    if (from > to) {
      return {
        isValid: false,
        error: 'From date cannot be greater than to date'
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid date format'
    };
  }
};
