import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { 
  LeaveBalancesColumns, 
  SheetTabs, 
  formatDateToFrench, 
  parseDateFromFrench, 
  parseSheetFloat, 
  formatSheetFloat 
} from './sheetsColumns.js';

// In-Memory Mutex to serialize write operations and prevent race conditions
class Mutex {
  constructor() {
    this._queue = [];
    this._locked = false;
  }

  async acquire() {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve(() => this.release());
      } else {
        this._queue.push(resolve);
      }
    });
  }

  release() {
    if (this._queue.length > 0) {
      const nextResolve = this._queue.shift();
      nextResolve(() => this.release());
    } else {
      this._locked = false;
    }
  }
}

const sheetMutex = new Mutex();

/**
 * Executes a function with a global mutex lock, ensuring serialization of Google Sheets writes.
 * @param {Function} fn - Async function to run
 * @returns {Promise<any>}
 */
export async function runWithMutex(fn) {
  const release = await sheetMutex.acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Wrapped async operations with Exponential Backoff for Rate Limiting (429 errors)
 * @param {Function} fn - Async operation to run
 * @param {number} retries - Number of retries remaining
 * @param {number} delay - Current delay in ms
 * @returns {Promise<any>}
 */
export async function withRetry(fn, retries = 5, delay = 200) {
  try {
    return await fn();
  } catch (error) {
    const status = error.status || (error.response && error.response.status) || error.code;
    const isRateLimit = status === 429 || 
                        (error.message && error.message.includes('429')) || 
                        (error.message && error.message.toLowerCase().includes('quota exceeded'));

    if (isRateLimit && retries > 0) {
      console.warn(`[Google Sheets] Limit reached (429). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2.5); // Exponential backoff with multiplier
    }
    throw error;
  }
}

/**
 * Initializes and returns the authenticated Google Spreadsheet document
 */
export async function getDoc() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (privateKey) {
    // Strip surrounding quotes if present (common when copy-pasting to Vercel env vars)
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!spreadsheetId || !email || !privateKey) {
    throw new Error('Missing Google Sheets API environment variables (GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY).');
  }

  // Initialize service account auth using JWT
  const serviceAccountAuth = new JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
  
  // Load document info (worksheets metadata)
  await withRetry(() => doc.loadInfo());
  
  return doc;
}

/**
 * Gets a specific sheet by title
 * @param {string} title - The title of the worksheet (e.g. 'Leave_Balances')
 */
export async function getSheet(title) {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    throw new Error(`Worksheet with title "${title}" not found in the spreadsheet.`);
  }

  // Auto-heal headers if it's the balances sheet
  if (title === 'Soldes_Conges') {
    try {
      await sheet.loadHeaderRow();
      const headers = sheet.headerValues || [];
      let updatedHeaders = [...headers];
      let needsUpdate = false;

      if (!updatedHeaders.includes(LeaveBalancesColumns.service)) {
        updatedHeaders.push(LeaveBalancesColumns.service);
        needsUpdate = true;
      }
      if (!updatedHeaders.includes(LeaveBalancesColumns.hire_date)) {
        updatedHeaders.push(LeaveBalancesColumns.hire_date);
        needsUpdate = true;
      }
      if (!updatedHeaders.includes(LeaveBalancesColumns.last_anniversary_credited)) {
        updatedHeaders.push(LeaveBalancesColumns.last_anniversary_credited);
        needsUpdate = true;
      }
      if (!updatedHeaders.includes(LeaveBalancesColumns.last_monthly_credit)) {
        updatedHeaders.push(LeaveBalancesColumns.last_monthly_credit);
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log('[Google Sheets] Updating missing column headers for Soldes_Conges...');
        await sheet.setHeaderRow(updatedHeaders);
      }
    } catch (e) {
      console.warn('[Google Sheets] Could not auto-update headers:', e.message);
    }
  }

  return sheet;
}

/**
 * Checks and automatically credits contract anniversary leave days (30 days of CP per year)
 */
export async function autoCreditContractAnniversaries() {
  const balancesSheet = await getSheet(SheetTabs.balances);
  const rows = await balancesSheet.getRows();

  for (const row of rows) {
    const hireDateStr = row.get(LeaveBalancesColumns.hire_date);
    if (!hireDateStr) continue;

    const email = row.get(LeaveBalancesColumns.employee_email);
    const name = row.get(LeaveBalancesColumns.employee_name);
    
    // Parse hire date (stored as DD/MM/YYYY in French format in sheet)
    const parsedHireDate = parseDateFromFrench(hireDateStr); // YYYY-MM-DD
    if (!parsedHireDate) continue;

    const hireDate = new Date(parsedHireDate);
    if (isNaN(hireDate.getTime())) continue;

    // Use current local date in UTC to align with date inputs
    const today = new Date();
    // Normalize today to UTC midnight to compare dates safely
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const hireDateUTC = new Date(Date.UTC(hireDate.getFullYear(), hireDate.getMonth(), hireDate.getDate()));

    if (todayUTC < hireDateUTC) continue;

    // Calculate all anniversaries up to todayUTC
    const anniversaries = [];
    const hireYear = hireDateUTC.getUTCFullYear();
    const currentYear = todayUTC.getUTCFullYear();

    for (let y = hireYear + 1; y <= currentYear; y++) {
      const annDate = new Date(Date.UTC(y, hireDateUTC.getUTCMonth(), hireDateUTC.getUTCDate()));
      if (annDate <= todayUTC) {
        anniversaries.push(annDate);
      }
    }

    const lastCreditedStr = row.get(LeaveBalancesColumns.last_anniversary_credited);
    let lastCreditedDate = null;
    if (lastCreditedStr) {
      const parsedLastCredited = parseDateFromFrench(lastCreditedStr);
      if (parsedLastCredited) {
        lastCreditedDate = new Date(parsedLastCredited);
      }
    }

    let toCredit = [];
    let updatedAny = false;

    if (!lastCreditedDate) {
      // First time checking.
      // We initialize the last credited to the latest anniversary that has occurred.
      // But if the latest anniversary is TODAY, we should credit it!
      const latestAnniversary = anniversaries.length > 0 ? anniversaries[anniversaries.length - 1] : null;
      if (latestAnniversary) {
        const isToday = latestAnniversary.getUTCFullYear() === todayUTC.getUTCFullYear() &&
                        latestAnniversary.getUTCMonth() === todayUTC.getUTCMonth() &&
                        latestAnniversary.getUTCDate() === todayUTC.getUTCDate();
        if (isToday) {
          toCredit.push(latestAnniversary);
        } else {
          row.set(LeaveBalancesColumns.last_anniversary_credited, formatDateToFrench(latestAnniversary.toISOString().split('T')[0]));
          updatedAny = true;
        }
      } else {
        // No anniversary has occurred yet (hired less than a year ago).
        // Initialize to hire date.
        row.set(LeaveBalancesColumns.last_anniversary_credited, formatDateToFrench(parsedHireDate));
        updatedAny = true;
      }
    } else {
      // Filter anniversaries that are strictly after the last credited date
      const lastCreditedUTC = new Date(Date.UTC(lastCreditedDate.getFullYear(), lastCreditedDate.getMonth(), lastCreditedDate.getDate()));
      toCredit = anniversaries.filter(ann => ann > lastCreditedUTC);
    }

    if (toCredit.length > 0) {
      const currentInitial = parseSheetFloat(row.get(LeaveBalancesColumns.initial_balance));
      const currentTaken = parseSheetFloat(row.get(LeaveBalancesColumns.taken_days));
      
      const creditAmount = toCredit.length * 30; // 30 days per anniversary
      const newInitial = currentInitial + creditAmount;
      const newRemaining = newInitial - currentTaken;

      row.set(LeaveBalancesColumns.initial_balance, formatSheetFloat(newInitial));
      row.set(LeaveBalancesColumns.remaining_balance, formatSheetFloat(newRemaining));
      
      // Update last credited to the most recent one in toCredit list
      const latestCredited = toCredit[toCredit.length - 1];
      row.set(LeaveBalancesColumns.last_anniversary_credited, formatDateToFrench(latestCredited.toISOString().split('T')[0]));
      
      console.log(`[Auto Credit] Credited ${creditAmount}j to ${name} (${email}) for anniversary(ies)`);
      updatedAny = true;
    }

    if (updatedAny) {
      await withRetry(() => row.save());
      // Tiny sleep to avoid API rate limits
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}

/**
 * Automatically credits +2.5j CP to all active employees at the start of each month
 */
export async function autoCreditMonthlyLeaves() {
  const balancesSheet = await getSheet(SheetTabs.balances);
  const rows = await balancesSheet.getRows();

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // "YYYY-MM"

  for (const row of rows) {
    const empId = row.get(LeaveBalancesColumns.employee_id);
    if (!empId || empId.startsWith('SYSTEM_')) continue;

    const email = row.get(LeaveBalancesColumns.employee_email);
    const name = row.get(LeaveBalancesColumns.employee_name);
    const hireDateStr = row.get(LeaveBalancesColumns.hire_date);
    const lastMonthlyCredit = row.get(LeaveBalancesColumns.last_monthly_credit);

    // If already credited this month, skip
    if (lastMonthlyCredit === currentMonthStr) continue;

    // Parse hire date if present
    let hireMonthStr = '';
    if (hireDateStr) {
      const parsedHire = parseDateFromFrench(hireDateStr); // "YYYY-MM-DD"
      if (parsedHire) {
        hireMonthStr = parsedHire.substring(0, 7); // "YYYY-MM"
      }
    }

    let shouldCredit = false;

    if (!lastMonthlyCredit) {
      // First time initialization
      if (hireMonthStr) {
        // If they were hired in a previous month, credit them for the current month
        if (currentMonthStr > hireMonthStr) {
          shouldCredit = true;
        } else {
          // Hired this month or in the future: initialize without crediting
          row.set(LeaveBalancesColumns.last_monthly_credit, currentMonthStr);
          await withRetry(() => row.save());
          await new Promise((resolve) => setTimeout(resolve, 150));
          continue;
        }
      } else {
        // No hire date: initialize to current month without crediting
        row.set(LeaveBalancesColumns.last_monthly_credit, currentMonthStr);
        await withRetry(() => row.save());
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }
    } else {
      // If we have a last monthly credit, we should credit if current month is greater than last monthly credit
      if (currentMonthStr > lastMonthlyCredit) {
        shouldCredit = true;
      }
    }

    if (shouldCredit) {
      const currentInitial = parseSheetFloat(row.get(LeaveBalancesColumns.initial_balance));
      const currentTaken = parseSheetFloat(row.get(LeaveBalancesColumns.taken_days));
      
      const newInitial = currentInitial + 2.5;
      const newRemaining = newInitial - currentTaken;

      row.set(LeaveBalancesColumns.initial_balance, formatSheetFloat(newInitial));
      row.set(LeaveBalancesColumns.remaining_balance, formatSheetFloat(newRemaining));
      row.set(LeaveBalancesColumns.last_monthly_credit, currentMonthStr);

      console.log(`[Auto Monthly Credit] Credited +2.5j CP to ${name} (${email}) for month ${currentMonthStr}`);
      await withRetry(() => row.save());
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}
