import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { LeaveBalancesColumns, SheetTabs } from '../lib/sheetsColumns.js';

// Parse .env.local
const envPath = path.resolve('.env.local');
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

const supabaseUrl = envConfig.SUPABASE_URL;
const supabaseAnonKey = envConfig.SUPABASE_ANON_KEY;
const spreadsheetId = envConfig.GOOGLE_SHEET_ID;
const email = envConfig.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let privateKey = envConfig.GOOGLE_PRIVATE_KEY;
if (privateKey) {
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const serviceAccountAuth = new JWT({
  email,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);

const usersToRegister = [
  { email: 'oli.a@stepupdigital.net', name: 'ANDRIAMAHEFA Olitahina', role: 'employee' },
  { email: 'dany.r@stepupdigital.net', name: 'RAKOTOARISOA Dany', role: 'employee' },
  { email: 'tsoavina.a@stepupdigital.net', name: 'ANDRIANAIVOMANANTSOA Mamintsoavina', role: 'employee' },
  { email: 'ingrid.g@stepupdigital.net', name: 'Ingrid GENILLON', role: 'hr' }
];

const password = 'passStepUp123';

async function run() {
  console.log('Connecting to Google Sheets...');
  await doc.loadInfo();
  const balancesSheet = doc.sheetsByTitle[SheetTabs.balances];
  const rows = await balancesSheet.getRows();

  for (const user of usersToRegister) {
    console.log(`\nRegistering user in Supabase: ${user.email}...`);
    const { data, error } = await supabase.auth.signUp({
      email: user.email,
      password: password,
      options: {
        data: {
          full_name: user.name,
          role: user.role
        }
      }
    });

    let employeeId = null;
    if (error) {
      if (error.message.includes('already registered') || error.status === 400) {
        console.log(`⚠️ User ${user.email} already exists in Supabase. Attempting login to retrieve ID...`);
        const { data: logData, error: logError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: password
        });
        if (logError) {
          console.error(`❌ Could not login or sign up for ${user.email}:`, logError.message);
          continue;
        }
        employeeId = logData.user?.id;
      } else {
        console.error(`❌ SignUp error for ${user.email}:`, error.message);
        continue;
      }
    } else {
      employeeId = data.user?.id;
      console.log(`✅ Registered! ID: ${employeeId}`);
    }

    if (employeeId) {
      // Find row in Google Sheet by email
      const row = rows.find(r => r.get(LeaveBalancesColumns.employee_email)?.toLowerCase() === user.email.toLowerCase());
      if (row) {
        const oldId = row.get(LeaveBalancesColumns.employee_id);
        if (oldId !== employeeId) {
          console.log(`Updating Google Sheets row for ${user.email}: ID "${oldId}" -> "${employeeId}"`);
          row.set(LeaveBalancesColumns.employee_id, employeeId);
          await row.save();
          console.log(`✅ ID successfully updated in Google Sheets.`);
        } else {
          console.log(`ℹ️ Google Sheets row already has correct ID: ${employeeId}`);
        }
      } else {
        console.error(`❌ Row not found in Soldes_Conges sheet for email ${user.email}`);
      }
    }
  }
}

run().catch(console.error);
