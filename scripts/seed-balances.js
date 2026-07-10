import fs from 'fs';
import path from 'path';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { LeaveBalancesColumns, LeaveRequestsColumns, TimeLogsColumns, SheetTabs, formatSheetFloat } from '../lib/sheetsColumns.js';

// 1. Manually parse .env.local
const envPath = path.resolve('.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found.');
  process.exit(1);
}

const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      acc[match[1].trim()] = value.trim();
    }
    return acc;
  }, {});

const spreadsheetId = envConfig.GOOGLE_SHEET_ID;
const email = envConfig.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = envConfig.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!spreadsheetId || !email || !privateKey) {
  console.error('Error: Missing Google Sheets environment variables in .env.local.');
  process.exit(1);
}

const serviceAccountAuth = new JWT({
  email,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);

async function run() {
  try {
    console.log('Connecting to Google Sheets...');
    await doc.loadInfo();
    console.log('Document title:', doc.title);

    // --- 1. Initialize Leave_Balances (Soldes_Conges) sheet ---
    console.log(`\n--- Initializing ${SheetTabs.balances}... ---`);
    let balanceSheet = doc.sheetsByTitle[SheetTabs.balances];
    if (!balanceSheet) {
      console.log(`Sheet "${SheetTabs.balances}" not found. Creating it...`);
      balanceSheet = await doc.addSheet({ title: SheetTabs.balances });
    }

    // Set headers
    const balanceHeaders = Object.values(LeaveBalancesColumns);
    console.log(`Setting headers for ${SheetTabs.balances}:`, balanceHeaders);
    await balanceSheet.setHeaderRow(balanceHeaders);

    const testUsers = [
      {
        [LeaveBalancesColumns.employee_id]: '87327813-ad8a-4127-a9b3-4ede219ecef7',
        [LeaveBalancesColumns.employee_name]: 'Alice Martin',
        [LeaveBalancesColumns.employee_email]: 'employee@entreprise.com',
        [LeaveBalancesColumns.role]: 'employee',
        [LeaveBalancesColumns.initial_balance]: formatSheetFloat(25.0),
        [LeaveBalancesColumns.taken_days]: formatSheetFloat(0.0),
        [LeaveBalancesColumns.remaining_balance]: formatSheetFloat(25.0),
        [LeaveBalancesColumns.initial_perm]: formatSheetFloat(5.0),
        [LeaveBalancesColumns.taken_perm]: formatSheetFloat(0.0),
        [LeaveBalancesColumns.remaining_perm]: formatSheetFloat(5.0),
        [LeaveBalancesColumns.manager_name]: 'Bob Dupont'
      },
      {
        [LeaveBalancesColumns.employee_id]: 'e7b63926-98ab-4f4d-b643-258de48438df',
        [LeaveBalancesColumns.employee_name]: 'Bob Dupont',
        [LeaveBalancesColumns.employee_email]: 'hr@entreprise.com',
        [LeaveBalancesColumns.role]: 'hr',
        [LeaveBalancesColumns.initial_balance]: formatSheetFloat(25.0),
        [LeaveBalancesColumns.taken_days]: formatSheetFloat(0.0),
        [LeaveBalancesColumns.remaining_balance]: formatSheetFloat(25.0),
        [LeaveBalancesColumns.initial_perm]: formatSheetFloat(5.0),
        [LeaveBalancesColumns.taken_perm]: formatSheetFloat(0.0),
        [LeaveBalancesColumns.remaining_perm]: formatSheetFloat(5.0),
        [LeaveBalancesColumns.manager_name]: 'Aucun'
      }
    ];

    console.log(`Checking existing rows in ${SheetTabs.balances}...`);
    const balanceRows = await balanceSheet.getRows();

    for (const user of testUsers) {
      const exists = balanceRows.some(r => r.get(LeaveBalancesColumns.employee_id) === user[LeaveBalancesColumns.employee_id]);
      if (exists) {
        console.log(`Row for ${user[LeaveBalancesColumns.employee_name]} already exists. Skipping.`);
      } else {
        console.log(`Adding balance for ${user[LeaveBalancesColumns.employee_name]}...`);
        await balanceSheet.addRow(user);
        console.log(`Added ${user[LeaveBalancesColumns.employee_name]} successfully.`);
      }
    }

    // --- 2. Initialize Leave_Requests (Demandes_Conges) sheet ---
    console.log(`\n--- Initializing ${SheetTabs.requests}... ---`);
    let requestsSheet = doc.sheetsByTitle[SheetTabs.requests];
    if (!requestsSheet) {
      console.log(`Sheet "${SheetTabs.requests}" not found. Creating it...`);
      requestsSheet = await doc.addSheet({ title: SheetTabs.requests });
    }

    const requestHeaders = Object.values(LeaveRequestsColumns);
    console.log(`Setting headers for ${SheetTabs.requests}:`, requestHeaders);
    await requestsSheet.setHeaderRow(requestHeaders);

    // --- 3. Initialize Time_Logs (Pointages) sheet ---
    console.log(`\n--- Initializing ${SheetTabs.timeLogs}... ---`);
    let logsSheet = doc.sheetsByTitle[SheetTabs.timeLogs];
    if (!logsSheet) {
      console.log(`Sheet "${SheetTabs.timeLogs}" not found. Creating it...`);
      logsSheet = await doc.addSheet({ title: SheetTabs.timeLogs });
    }

    const logHeaders = Object.values(TimeLogsColumns);
    console.log(`Setting headers for ${SheetTabs.timeLogs}:`, logHeaders);
    await logsSheet.setHeaderRow(logHeaders);

    console.log('\n🎉 ALL SHEET TABS SUCCESSFULLY INITIALIZED AND SEEDED WITH FRENCH HEADERS & NAMES! 🎉');

  } catch (error) {
    console.error('Error during Google Sheets seeding:', error);
  }
}

run();
