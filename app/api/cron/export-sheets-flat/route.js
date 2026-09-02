export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { withRetry } from '../../../../lib/googleSheets';

export async function GET(req) {
  // Strict Security Check for CRON Secret (mandatory)
  const cronSecret = process.env.CRON_SECRET;
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const authHeader = req.headers.get('authorization');
  
  const isAuthorized = !!cronSecret && (
    secret === cronSecret || authHeader === `Bearer ${cronSecret}`
  );

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Non autorisé : secret CRON manquant ou invalide.' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Query flat time logs with client/task details joined
    const { data: logs, error: dbErr } = await supabase
      .from('production_time_logs')
      .select(`
        id,
        logged_at,
        employee_name,
        duration_seconds,
        log_type,
        is_billable,
        production_tasks (
          name,
          category,
          production_clients (
            name,
            code
          )
        )
      `)
      .order('logged_at', { ascending: false });

    if (dbErr) throw dbErr;

    // Filter to only export completed time logs (where duration_seconds > 0)
    const completedLogs = (logs || []).filter(log => log.duration_seconds > 0);

    // Google Sheets Config
    const spreadsheetId = process.env.GOOGLE_SHEET_PRODUCTION_ID || process.env.GOOGLE_SHEET_ID;
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey) {
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!spreadsheetId || !email || !privateKey) {
      return NextResponse.json({ error: 'Missing Google Sheets configuration.' }, { status: 500 });
    }

    const serviceAccountAuth = new JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    await withRetry(() => doc.loadInfo());

    const tabName = 'Reporting_Pivot';
    let sheet = doc.sheetsByTitle[tabName];

    const headers = [
      'ID Log',
      'Date',
      'Collaborateur',
      'Code Client',
      'Client',
      'Livrable (Catégorie)',
      'Sous-Tâche',
      'Durée (Minutes)',
      'Durée (Heures)',
      'Facturable (Oui/Non)',
      'Type Log'
    ];

    if (!sheet) {
      sheet = await withRetry(() => doc.addSheet({
        title: tabName,
        headerValues: headers
      }));
    } else {
      await withRetry(() => sheet.clear());
      await withRetry(() => sheet.setHeaderRow(headers));
    }

    // Format rows for pivot table
    const rowsToAdd = completedLogs.map(log => {
      const minutes = Number((log.duration_seconds / 60).toFixed(2));
      const hours = Number((log.duration_seconds / 3600).toFixed(2));
      
      const task = log.production_tasks || {};
      const client = task.production_clients || {};
      const dateStr = new Date(log.logged_at).toLocaleDateString('fr-FR');

      return {
        'ID Log': log.id,
        'Date': dateStr,
        'Collaborateur': log.employee_name,
        'Code Client': client.code || 'N/A',
        'Client': client.name || 'N/A',
        'Livrable (Catégorie)': task.category || 'N/A',
        'Sous-Tâche': task.name || 'N/A',
        'Durée (Minutes)': String(minutes).replace('.', ','),
        'Durée (Heures)': String(hours).replace('.', ','),
        'Facturable (Oui/Non)': log.is_billable !== false ? 'Oui' : 'Non',
        'Type Log': log.log_type
      };
    });

    // Write in batches of 500 rows to prevent API rate limiting
    const chunkSize = 500;
    for (let i = 0; i < rowsToAdd.length; i += chunkSize) {
      const chunk = rowsToAdd.slice(i, i + chunkSize);
      await withRetry(() => sheet.addRows(chunk));
    }

    return NextResponse.json({ 
      success: true, 
      rowsExported: rowsToAdd.length 
    });

  } catch (error) {
    console.error('Error executing flat sheets cron export:', error);
    return NextResponse.json({ 
      error: 'Erreur interne du serveur lors de la synchronisation à plat.' 
    }, { status: 500 });
  }
}
