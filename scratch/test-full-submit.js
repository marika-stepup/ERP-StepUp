import fs from 'fs';
import path from 'path';
import { getSheet, runWithMutex } from '../lib/googleSheets.js';
import { calculateBusinessDays } from '../lib/utils.js';
import { LeaveBalancesColumns, LeaveRequestsColumns, SheetTabs, parseSheetFloat, formatSheetFloat, parseDateFromFrench } from '../lib/sheetsColumns.js';

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
    const employee = {
      id: '2e392014-f3c3-477b-9185-41e3da826e78', // Let's use this ID since it's the one in Leave_Balances for Tsoavina
      email: 'tsoavina.a@stepupdigital.net',
      name: 'ANDRIANAIVOMALALA Mamintsoavina'
    };

    const start_date = '2026-07-31';
    const end_date = '2026-07-31';
    const leave_type = 'CP';

    console.log('Calculating business days...');
    const businessDays = calculateBusinessDays(start_date, end_date);
    console.log('Business days:', businessDays);

    console.log('Loading balances sheet...');
    const balancesSheet = await getSheet(SheetTabs.balances);
    const balanceRows = await balancesSheet.getRows();
    console.log(`Fetched ${balanceRows.length} balance rows`);

    const employeeBalanceRow = balanceRows.find(
      (row) => row.get(LeaveBalancesColumns.employee_id) === employee.id ||
               row.get(LeaveBalancesColumns.employee_email)?.toLowerCase() === employee.email.toLowerCase()
    );

    if (!employeeBalanceRow) {
      console.log('Employee balance row not found!');
      return;
    }

    console.log('Found employee balance row');
    const isPermission = leave_type.toLowerCase().includes('perm');
    const balanceField = isPermission 
      ? LeaveBalancesColumns.remaining_perm 
      : LeaveBalancesColumns.remaining_balance;
    
    const remainingBalance = parseSheetFloat(employeeBalanceRow.get(balanceField));
    console.log('Remaining balance:', remainingBalance);

    if (remainingBalance < businessDays) {
      console.log('Insufficient balance!');
      return;
    }

    console.log('Loading requests sheet...');
    const requestsSheet = await getSheet(SheetTabs.requests);
    const requestRows = await requestsSheet.getRows();
    console.log(`Fetched ${requestRows.length} requests`);

    const employeeRequests = requestRows.filter(
      (row) => row.get(LeaveRequestsColumns.employee_id) === employee.id &&
               row.get(LeaveRequestsColumns.status) !== 'Refusé'
    );
    console.log(`Found ${employeeRequests.length} requests for employee`);

    const hasOverlap = employeeRequests.some(row => {
      console.log('Checking overlap for existing request row');
      const startVal = row.get(LeaveRequestsColumns.start_date);
      const endVal = row.get(LeaveRequestsColumns.end_date);
      console.log(`  raw start: ${startVal}, raw end: ${endVal}`);
      
      const existingStart = parseDateFromFrench(startVal);
      const existingEnd = parseDateFromFrench(endVal);
      console.log(`  parsed start: ${existingStart}, parsed end: ${existingEnd}`);
      
      const overlap = (start_date <= existingEnd) && (end_date >= existingStart);
      return overlap;
    });

    console.log('Has overlap?', hasOverlap);

  } catch (error) {
    console.error('CRASH OCCURRED:', error);
  }
}

main();
