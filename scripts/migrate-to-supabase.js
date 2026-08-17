import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import pkg from '@next/env';
const { loadEnvConfig } = pkg;

// Load environment variables via Next.js env loader
loadEnvConfig(process.cwd());

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY;
if (googlePrivateKey) {
  if (googlePrivateKey.startsWith('"') && googlePrivateKey.endsWith('"')) {
    googlePrivateKey = googlePrivateKey.slice(1, -1);
  } else if (googlePrivateKey.startsWith("'") && googlePrivateKey.endsWith("'")) {
    googlePrivateKey = googlePrivateKey.slice(1, -1);
  }
  googlePrivateKey = googlePrivateKey.replace(/\\n/g, '\n');
}

if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !googlePrivateKey) {
  console.error('Error: Missing Google Sheets configuration in environment.');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

// 2. Initialize Clients
const serviceAccountAuth = new JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: googlePrivateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper to convert DD/MM/YYYY into YYYY-MM-DD
function parseFrenchDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
  }
  // Try fallback standard parsing if already ISO
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : dateStr;
}

function parseSheetFloat(value) {
  if (value === undefined || value === null || value === '') return 0;
  const normalized = value.toString().replace(',', '.');
  return parseFloat(normalized) || 0;
}

// Configuration mapping of headers
const LeaveBalancesColumns = {
  employee_id: 'ID Employé',
  employee_name: 'Nom',
  employee_first_name: 'Prénom',
  employee_email: 'Email',
  role: 'Rôle',
  initial_balance: 'Solde CP Initial',
  taken_days: 'CP Pris',
  remaining_balance: 'Solde CP Restant',
  initial_perm: 'Solde Permissions Initial',
  taken_perm: 'Permissions Prises',
  remaining_perm: 'Solde Permissions Restant',
  manager_name: 'Manager',
  service: 'Service',
  hire_date: 'Date d\'embauche',
  last_anniversary_credited: 'Dernier Anniversaire Crédité',
  last_monthly_credit: 'Dernier Crédit Mensuel'
};

const LeaveRequestsColumns = {
  request_id: 'ID Demande',
  employee_id: 'ID Employé',
  employee_name: 'Nom',
  start_date: 'Date Début',
  end_date: 'Date Fin',
  business_days: 'Jours Ouvrés',
  leave_type: 'Type Congé',
  status: 'Statut',
  created_at: 'Date Création',
  updated_at: 'Date Mise à jour',
  hr_comment: 'Commentaire RH'
};

async function runMigration() {
  console.log('--- Starting Migration Google Sheets -> Supabase ---');
  await doc.loadInfo();
  console.log(`Connected to Google Spreadsheet: "${doc.title}"`);

  // --- MIGRATION 1: Soldes_Conges -> leave_balances ---
  const balancesSheet = doc.sheetsByTitle['Soldes_Conges'];
  if (!balancesSheet) {
    console.error('Error: Sheet "Soldes_Conges" not found.');
  } else {
    console.log('\nMigrating Leave Balances (Soldes_Conges)...');
    await balancesSheet.loadHeaderRow();
    const rows = await balancesSheet.getRows();
    
    // Filter out rows that are configurations or missing IDs
    const empRows = rows.filter(row => {
      const id = row.get(LeaveBalancesColumns.employee_id);
      return id && !id.startsWith('SYSTEM_');
    });

    console.log(`Found ${empRows.length} employee rows to migrate.`);

    for (const row of empRows) {
      const empId = row.get(LeaveBalancesColumns.employee_id);
      const email = row.get(LeaveBalancesColumns.employee_email)?.toLowerCase().trim();
      
      const payload = {
        employee_id: empId,
        employee_name: row.get(LeaveBalancesColumns.employee_name) || '',
        employee_first_name: row.get(LeaveBalancesColumns.employee_first_name) || '',
        employee_email: email,
        role: row.get(LeaveBalancesColumns.role) || 'employee',
        initial_balance: parseSheetFloat(row.get(LeaveBalancesColumns.initial_balance)),
        taken_days: parseSheetFloat(row.get(LeaveBalancesColumns.taken_days)),
        remaining_balance: parseSheetFloat(row.get(LeaveBalancesColumns.remaining_balance)),
        initial_perm: parseSheetFloat(row.get(LeaveBalancesColumns.initial_perm)),
        taken_perm: parseSheetFloat(row.get(LeaveBalancesColumns.taken_perm)),
        remaining_perm: parseSheetFloat(row.get(LeaveBalancesColumns.remaining_perm)),
        manager_name: row.get(LeaveBalancesColumns.manager_name) || 'Aucun',
        service: row.get(LeaveBalancesColumns.service) || 'Non spécifié',
        hire_date: parseFrenchDate(row.get(LeaveBalancesColumns.hire_date)),
        last_anniversary_credited: parseFrenchDate(row.get(LeaveBalancesColumns.last_anniversary_credited)),
        last_monthly_credit: row.get(LeaveBalancesColumns.last_monthly_credit) || null,
      };

      const { error } = await supabase
        .from('leave_balances')
        .upsert(payload, { onConflict: 'employee_id' });

      if (error) {
        console.error(`❌ Failed to upsert balance for ${email}:`, error.message);
      } else {
        console.log(`✔️ Upserted balance for ${email} (${payload.employee_first_name} ${payload.employee_name})`);
      }
    }
  }

  // --- MIGRATION 2: Demandes_Conges -> leave_requests ---
  const requestsSheet = doc.sheetsByTitle['Demandes_Conges'];
  if (!requestsSheet) {
    console.error('Error: Sheet "Demandes_Conges" not found.');
  } else {
    console.log('\nMigrating Leave Requests (Demandes_Conges)...');
    await requestsSheet.loadHeaderRow();
    const rows = await requestsSheet.getRows();

    console.log(`Found ${rows.length} request rows to migrate.`);

    for (const row of rows) {
      const requestId = row.get(LeaveRequestsColumns.request_id);
      if (!requestId) {
        console.warn('⚠️ Skipping row missing ID Demande.');
        continue;
      }

      const payload = {
        request_id: requestId,
        employee_id: row.get(LeaveRequestsColumns.employee_id),
        employee_name: row.get(LeaveRequestsColumns.employee_name) || '',
        start_date: parseFrenchDate(row.get(LeaveRequestsColumns.start_date)),
        end_date: parseFrenchDate(row.get(LeaveRequestsColumns.end_date)),
        business_days: parseSheetFloat(row.get(LeaveRequestsColumns.business_days)),
        leave_type: row.get(LeaveRequestsColumns.leave_type) || '',
        status: row.get(LeaveRequestsColumns.status) || 'En attente',
        hr_comment: row.get(LeaveRequestsColumns.hr_comment) || '',
        created_at: row.get(LeaveRequestsColumns.created_at) ? new Date(row.get(LeaveRequestsColumns.created_at)).toISOString() : new Date().toISOString(),
        updated_at: row.get(LeaveRequestsColumns.updated_at) ? new Date(row.get(LeaveRequestsColumns.updated_at)).toISOString() : new Date().toISOString(),
      };

      const { error } = await supabase
        .from('leave_requests')
        .upsert(payload, { onConflict: 'request_id' });

      if (error) {
        console.error(`❌ Failed to upsert request ${requestId}:`, error.message);
      } else {
        console.log(`✔️ Upserted request ${requestId} for ${payload.employee_name}`);
      }
    }
  }

  console.log('\n--- Migration Finished! ---');
}

runMigration().catch(console.error);
