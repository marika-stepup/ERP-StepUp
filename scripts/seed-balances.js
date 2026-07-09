import fs from 'fs';
import path from 'path';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

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

    // --- 1. Initialize Leave_Balances sheet headers and seed ---
    console.log('\n--- Initializing Leave_Balances... ---');
    let balanceSheet = doc.sheetsByTitle['Leave_Balances'];
    if (!balanceSheet) {
      console.log('Sheet "Leave_Balances" not found. Creating it...');
      balanceSheet = await doc.addSheet({ title: 'Leave_Balances' });
    }
    
    // Set headers
    const balanceHeaders = ['employee_id', 'employee_name', 'employee_email', 'initial_balance', 'taken_days', 'remaining_balance'];
    console.log('Setting headers for Leave_Balances:', balanceHeaders);
    await balanceSheet.setHeaderRow(balanceHeaders);

    const testUsers = [
      {
        employee_id: '87327813-ad8a-4127-a9b3-4ede219ecef7',
        employee_name: 'Alice Martin',
        employee_email: 'employee@entreprise.com',
        initial_balance: '25.0',
        taken_days: '0.0',
        remaining_balance: '25.0'
      },
      {
        employee_id: 'e7b63926-98ab-4f4d-b643-258de48438df',
        employee_name: 'Bob Dupont',
        employee_email: 'hr@entreprise.com',
        initial_balance: '25.0',
        taken_days: '0.0',
        remaining_balance: '25.0'
      }
    ];

    console.log('Checking existing rows in Leave_Balances...');
    const balanceRows = await balanceSheet.getRows();

    for (const user of testUsers) {
      const exists = balanceRows.some(r => r.get('employee_id') === user.employee_id);
      if (exists) {
        console.log(`Row for ${user.employee_name} already exists. Skipping.`);
      } else {
        console.log(`Adding balance for ${user.employee_name}...`);
        await balanceSheet.addRow(user);
        console.log(`Added ${user.employee_name} successfully.`);
      }
    }

    // --- 2. Initialize Leave_Requests sheet headers ---
    console.log('\n--- Initializing Leave_Requests... ---');
    let requestsSheet = doc.sheetsByTitle['Leave_Requests'];
    if (!requestsSheet) {
      console.log('Sheet "Leave_Requests" not found. Creating it...');
      requestsSheet = await doc.addSheet({ title: 'Leave_Requests' });
    }
    
    const requestHeaders = ['request_id', 'employee_id', 'employee_name', 'start_date', 'end_date', 'business_days', 'leave_type', 'status', 'created_at', 'updated_at', 'hr_comment'];
    console.log('Setting headers for Leave_Requests:', requestHeaders);
    await requestsSheet.setHeaderRow(requestHeaders);

    // --- 3. Initialize Time_Logs sheet headers ---
    console.log('\n--- Initializing Time_Logs... ---');
    let logsSheet = doc.sheetsByTitle['Time_Logs'];
    if (!logsSheet) {
      console.log('Sheet "Time_Logs" not found. Creating it...');
      logsSheet = await doc.addSheet({ title: 'Time_Logs' });
    }
    
    const logHeaders = ['log_id', 'employee_id', 'date', 'clock_in', 'clock_out', 'break_duration', 'total_hours', 'status', 'created_at'];
    console.log('Setting headers for Time_Logs:', logHeaders);
    await logsSheet.setHeaderRow(logHeaders);

    console.log('\n🎉 ALL SHEET TABS SUCCESSFULLY INITIALIZED AND SEEDED! 🎉');

  } catch (error) {
    console.error('Error during Google Sheets seeding:', error);
  }
}

run();
