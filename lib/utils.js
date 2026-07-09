/**
 * Calculates the number of business days (Monday to Friday) between two dates inclusive.
 * Safe for timezone shifts since it uses UTC dates parsed directly from YYYY-MM-DD strings.
 * 
 * @param {string} startDateStr - Start date in YYYY-MM-DD format
 * @param {string} endDateStr - End date in YYYY-MM-DD format
 * @returns {number} Number of business days
 */
export function calculateBusinessDays(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date formats. Use YYYY-MM-DD.');
  }

  if (start > end) {
    throw new Error('Start date must be before or equal to end date.');
  }

  let count = 0;
  let current = new Date(start);
  
  while (current <= end) {
    const dayOfWeek = current.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    // Advance one day in UTC
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
}

/**
 * Basic UUID generator (fallback if crypto.randomUUID is not available)
 * @returns {string} UUID v4
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
