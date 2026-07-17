import fs from 'fs';
import path from 'path';
import { getSheet } from '../lib/googleSheets.js';
import { LeaveRequestsColumns, LeaveBalancesColumns, SheetTabs, parseDateFromFrench } from '../lib/sheetsColumns.js';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const parts = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (parts) {
    const key = parts[1];
    let value = parts[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
});

async function main() {
  try {
    console.log('Connecting to Sheet...');
    const requestsSheet = await getSheet(SheetTabs.requests);
    const requestRows = await requestsSheet.getRows();
    console.log(`Fetched ${requestRows.length} requests`);

    const employee = {
      id: '5f928e46-cbcd-4cbf-8b24-87f0e4649507', // dummy id, let's look up Tsoavina by email
      email: 'tsoavina.a@stepupdigital.net'
    };

    // Find employee ID in balances
    const balancesSheet = await getSheet(SheetTabs.balances);
    const balanceRows = await balancesSheet.getRows();
    const balanceRow = balanceRows.find(
      row => row.get(LeaveBalancesColumns.employee_email)?.toLowerCase() === employee.email.toLowerCase()
    );

    if (balanceRow) {
      employee.id = balanceRow.get(LeaveBalancesColumns.employee_id);
      console.log(`Found employee ID: ${employee.id}`);
    } else {
      console.log('Employee not found in balances');
      return;
    }

    const employeeRequests = requestRows.filter(
      (row) => row.get(LeaveRequestsColumns.employee_id) === employee.id &&
               row.get(LeaveRequestsColumns.status) !== 'Refusé'
    );
    console.log(`Found ${employeeRequests.length} requests for this employee`);

    const newStart = '2026-07-31';
    const newEnd = '2026-07-31';

    employeeRequests.forEach((row, i) => {
      console.log(`Checking row ${i}:`);
      const rawStart = row.get(LeaveRequestsColumns.start_date);
      const rawEnd = row.get(LeaveRequestsColumns.end_date);
      console.log(`  Raw start: "${rawStart}", Raw end: "${rawEnd}"`);
      
      const existingStart = parseDateFromFrench(rawStart);
      const existingEnd = parseDateFromFrench(rawEnd);
      console.log(`  Parsed start: "${existingStart}", Parsed end: "${existingEnd}"`);
      
      const overlap = (newStart <= existingEnd) && (newEnd >= existingStart);
      console.log(`  Overlap? ${overlap}`);
    });

  } catch (err) {
    console.error('Error occurred:', err);
  }
}

main();
