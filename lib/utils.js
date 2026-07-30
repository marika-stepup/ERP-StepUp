/**
 * Checks if a given date (YYYY-MM-DD format) is a public holiday in Madagascar.
 * Uses timezone-independent calculations.
 * 
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {boolean} True if the date is a Madagascar public holiday
 */
export function isMadagascarHoliday(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // 0-indexed month
  const d = parseInt(parts[2], 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return false;

  // Fixed holidays
  if (m === 0 && d === 1) return true; // Jour de l'an (1 Jan)
  if (m === 2 && d === 29) return true; // Commémoration du 29 mars 1947
  if (m === 4 && d === 1) return true; // Fête du travail (1 Mai)
  if (m === 5 && d === 26) return true; // Fête nationale / Indépendance (26 Juin)
  if (m === 7 && d === 15) return true; // Assomption (15 Août)
  if (m === 10 && d === 1) return true; // Toussaint (1 Nov)
  if (m === 11 && d === 25) return true; // Noël (25 Déc)

  // Variable holidays calculation (Easter, Ascension, Pentecost)
  // Meeus/Jones/Butcher Algorithm
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const dVal = Math.floor(b / 4);
  const eVal = b % 4;
  const fVal = Math.floor((b + 8) / 25);
  const gVal = Math.floor((b - fVal + 1) / 3);
  const hVal = (19 * a + b - dVal - gVal + 15) % 30;
  const iVal = Math.floor(c / 4);
  const kVal = c % 4;
  const lVal = (32 + 2 * eVal + 2 * iVal - hVal - kVal) % 7;
  const mVal = Math.floor((a + 11 * hVal + 22 * lVal) / 451);
  const easterMonth = Math.floor((hVal + lVal - 7 * mVal + 114) / 31);
  const easterDay = ((hVal + lVal - 7 * mVal + 114) % 31) + 1;

  const easterSunday = new Date(Date.UTC(y, easterMonth - 1, easterDay));

  // Easter Monday (Easter + 1 day)
  const easterMonday = new Date(easterSunday);
  easterMonday.setUTCDate(easterSunday.getUTCDate() + 1);
  if (m === easterMonday.getUTCMonth() && d === easterMonday.getUTCDate()) return true;

  // Ascension Thursday (Easter + 39 days)
  const ascension = new Date(easterSunday);
  ascension.setUTCDate(easterSunday.getUTCDate() + 39);
  if (m === ascension.getUTCMonth() && d === ascension.getUTCDate()) return true;

  // Pentecost Monday (Easter + 50 days)
  const pentecost = new Date(easterSunday);
  pentecost.setUTCDate(easterSunday.getUTCDate() + 50);
  if (m === pentecost.getUTCMonth() && d === pentecost.getUTCDate()) return true;

  return false;
}

/**
 * Calculates the number of business days (Monday to Friday) between two dates inclusive,
 * excluding public holidays in Madagascar.
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
    throw new Error('La date de début doit être antérieure ou égale à la date de fin.');
  }

  let count = 0;
  let fridayCount = 0;
  let current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const yearStr = current.getUTCFullYear();
    const monthStr = String(current.getUTCMonth() + 1).padStart(2, '0');
    const dayStr = String(current.getUTCDate()).padStart(2, '0');
    const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

    const isHoliday = isMadagascarHoliday(dateStr);

    if (!isHoliday) {
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      if (dayOfWeek === 5) { // Friday
        // Check if Saturday (Friday + 1 day) is a holiday
        const nextDay = new Date(current);
        nextDay.setUTCDate(current.getUTCDate() + 1);
        const nextYearStr = nextDay.getUTCFullYear();
        const nextMonthStr = String(nextDay.getUTCMonth() + 1).padStart(2, '0');
        const nextDayStr = String(nextDay.getUTCDate()).padStart(2, '0');
        const nextDateStr = `${nextYearStr}-${nextMonthStr}-${nextDayStr}`;

        if (!isMadagascarHoliday(nextDateStr)) {
          fridayCount++;
        }
      }
    }
    // Advance one day in UTC
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count + fridayCount;
}

/**
 * Basic UUID generator (fallback if crypto.randomUUID is not available)
 * @returns {string} UUID v4
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Splits a full name into first name and last name.
 * Handles uppercase last names (typical in Madagascar/French context)
 * and falls back to Western first/last name order if no uppercase words exist.
 * 
 * @param {string} fullName - Full name string
 * @returns {{ firstName: string, lastName: string }}
 */
export function splitFullName(fullName) {
  if (!fullName) return { lastName: '', firstName: '' };

  const trimmed = fullName.trim();
  const words = trimmed.split(/\s+/);

  if (words.length <= 1) {
    return { lastName: '', firstName: trimmed };
  }

  // Identify words that are fully uppercase (at least 2 characters)
  const isUppercase = (word) => {
    const letters = word.replace(/[^a-zA-ZÀ-ÖØ-ß]/g, '');
    if (letters.length === 0) return false;
    return letters === letters.toUpperCase() && letters.length >= 2;
  };

  const uppercaseWords = words.filter(isUppercase);
  const otherWords = words.filter(w => !isUppercase(w));

  if (uppercaseWords.length > 0 && otherWords.length > 0) {
    return {
      lastName: uppercaseWords.join(' '),
      firstName: otherWords.join(' ')
    };
  }

  // Fallback: first word is first name, the rest is last name
  return {
    lastName: words.slice(1).join(' '),
    firstName: words[0]
  };
}

