import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { LeaveBalancesColumns } from './sheetsColumns.js';

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
      if (!headers.includes(LeaveBalancesColumns.service)) {
        console.log('[Google Sheets] Adding missing "Service" column header...');
        await sheet.setHeaderRow([...headers, LeaveBalancesColumns.service]);
      }
    } catch (e) {
      console.warn('[Google Sheets] Could not auto-update headers:', e.message);
    }
  }

  return sheet;
}
