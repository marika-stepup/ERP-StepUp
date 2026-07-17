import fs from 'fs';
import path from 'path';
import { getSheet } from '../lib/googleSheets.js';
import { LeaveRequestsColumns, SheetTabs } from '../lib/sheetsColumns.js';

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
    console.log('Fetching requests sheet...');
    const requestsSheet = await getSheet(SheetTabs.requests);
    const rows = await requestsSheet.getRows();
    console.log(`Loaded ${rows.length} rows`);

    rows.forEach((row, index) => {
      const startVal = row.get(LeaveRequestsColumns.start_date);
      const endVal = row.get(LeaveRequestsColumns.end_date);
      
      console.log(`Row ${index + 1}:`);
      console.log(`  Start Date: val="${startVal}", type=${typeof startVal}`);
      console.log(`  End Date: val="${endVal}", type=${typeof endVal}`);
    });

  } catch (error) {
    console.error('ERROR:', error);
  }
}

main();
