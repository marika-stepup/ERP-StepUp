import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { getSupabaseAdmin } from './supabaseAuth.js';
import { runWithMutex, withRetry } from './googleSheets.js';

export const ProductionTabs = {
  clients: 'Clients',
  tasks: 'Tâches',
  timeLogs: 'Pointages'
};

export const ProductionClientsColumns = {
  id: 'ID Client',
  code: 'Code Client',
  name: 'Nom',
  period: 'Période Contrat',
  total_budget: 'Budget Total (Heures)',
  spent_hours: 'Temps Consommé (Heures)',
  progression: 'Progression (%)',
  start_date: 'Date Début',
  end_date: 'Date Fin',
  posts_facebook: 'Facebook Posts / mois',
  posts_instagram: 'Instagram Posts / mois',
  posts_linkedin: 'LinkedIn Posts / mois',
  posts_google: 'Google Posts / mois',
  newsletter_count: 'Newsletters / mois',
  blog_count: 'Blogs / mois',
  unquantifiable_tasks: 'Tâches Inquantifiables'
};

export const ProductionTasksColumns = {
  id: 'ID Tâche',
  client_id: 'ID Client',
  client_name: 'Client Nom',
  category: 'Catégorie',
  name: 'Nom Tâche',
  budget: 'Budget Tâche (Heures)',
  status: 'Statut',
  due_date: 'Date d\'échéance'
};

export const ProductionTimeLogsColumns = {
  id: 'ID Log',
  task_id: 'ID Tâche',
  task_name: 'Tâche Nom',
  employee_id: 'ID Employé',
  employee_name: 'Nom Collaborateur',
  duration_seconds: 'Durée (Secondes)',
  duration_formatted: 'Durée (Format HH:MM)',
  log_type: 'Type Log',
  logged_at: 'Date Enregistrement'
};

let cachedDoc = null;
let lastLoadTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

async function getDoc() {
  const now = Date.now();
  if (cachedDoc && (now - lastLoadTime < CACHE_DURATION)) {
    return cachedDoc;
  }

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
    throw new Error('Missing Google Sheets API environment variables.');
  }

  const serviceAccountAuth = new JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
  await withRetry(() => doc.loadInfo());
  
  cachedDoc = doc;
  lastLoadTime = now;
  return doc;
}

// Get or auto-create sheet
async function getSheet(title, headerColumns) {
  const doc = await getDoc();
  let sheet = doc.sheetsByTitle[title];
  
  if (!sheet) {
    // Check if there is a sheet named "Feuille 1" (default newly created sheet) and rename it if it is empty
    const defaultSheet = doc.sheetsByTitle['Feuille 1'];
    if (defaultSheet && Object.keys(doc.sheetsByTitle).length === 1) {
      await withRetry(() => defaultSheet.updateProperties({ title }));
      await withRetry(() => defaultSheet.setHeaderRow(headerColumns));
      sheet = defaultSheet;
      console.log(`[ProductionSheet] Renamed default "Feuille 1" to "${title}" and initialized headers.`);
    } else {
      sheet = await withRetry(() => doc.addSheet({
        title,
        headerValues: headerColumns
      }));
      console.log(`[ProductionSheet] Created missing sheet: "${title}"`);
    }
  } else {
    // Make sure header values are set if sheet exists but headers are empty
    try {
      await sheet.loadHeaderRow();
      if (!sheet.headerValues || sheet.headerValues.length === 0) {
        await withRetry(() => sheet.setHeaderRow(headerColumns));
      }
    } catch (e) {
      await withRetry(() => sheet.setHeaderRow(headerColumns));
    }
  }

  return sheet;
}

// Format seconds to text helper
function formatSecondsToHMText(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

/**
 * Syncs a production client row to Google Sheets
 */
export async function syncProductionClient(clientId) {
  try {
    const supabase = getSupabaseAdmin();
    
    // Fetch client details
    const { data: client, error: clientErr } = await supabase
      .from('production_clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle();

    if (clientErr || !client) {
      console.warn(`[ProductionSheet] Client ${clientId} not found in Supabase. Skipping sync.`);
      return;
    }

    // Fetch related tasks to recalculate progression
    const { data: tasks } = await supabase
      .from('production_tasks')
      .select('id')
      .eq('client_id', clientId);

    let totalSpentSeconds = 0;
    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      const { data: logs } = await supabase
        .from('production_time_logs')
        .select('duration_seconds')
        .in('task_id', taskIds)
        .eq('log_type', 'production');

      if (logs) {
        logs.forEach(log => {
          totalSpentSeconds += log.duration_seconds;
        });
      }
    }

    const totalSpentHours = totalSpentSeconds / 3600;
    const budgetHours = Number(client.total_budget_hours) || 0;
    const progression = budgetHours > 0 ? Math.round((totalSpentHours / budgetHours) * 100) : 0;

    await runWithMutex(async () => {
      const sheet = await getSheet(ProductionTabs.clients, Object.values(ProductionClientsColumns));
      const rows = await sheet.getRows();

      const existingRow = rows.find(
        (row) => row.get(ProductionClientsColumns.id) === clientId
      );

      const rowData = {
        [ProductionClientsColumns.id]: client.id,
        [ProductionClientsColumns.code]: client.code,
        [ProductionClientsColumns.name]: client.name,
        [ProductionClientsColumns.period]: client.contract_period,
        [ProductionClientsColumns.total_budget]: String(budgetHours).replace('.', ','),
        [ProductionClientsColumns.spent_hours]: String(Number(totalSpentHours.toFixed(2))).replace('.', ','),
        [ProductionClientsColumns.progression]: String(progression),
        [ProductionClientsColumns.start_date]: client.start_date || '',
        [ProductionClientsColumns.end_date]: client.end_date || '',
        [ProductionClientsColumns.posts_facebook]: String(client.posts_facebook || 0),
        [ProductionClientsColumns.posts_instagram]: String(client.posts_instagram || 0),
        [ProductionClientsColumns.posts_linkedin]: String(client.posts_linkedin || 0),
        [ProductionClientsColumns.posts_google]: String(client.posts_google || 0),
        [ProductionClientsColumns.newsletter_count]: String(client.newsletter_count || 0),
        [ProductionClientsColumns.blog_count]: String(client.blog_count || 0),
        [ProductionClientsColumns.unquantifiable_tasks]: client.unquantifiable_tasks || ''
      };

      if (existingRow) {
        for (const [key, val] of Object.entries(rowData)) {
          existingRow.set(key, val);
        }
        await withRetry(() => existingRow.save());
        console.log(`[ProductionSheet] Updated client row: ${client.name}`);
      } else {
        await withRetry(() => sheet.addRow(rowData));
        console.log(`[ProductionSheet] Added client row: ${client.name}`);
      }
    });
  } catch (err) {
    console.error(`[ProductionSheet] Error syncing client ${clientId}:`, err);
  }
}

/**
 * Syncs a production task row to Google Sheets
 */
export async function syncProductionTask(taskId) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: task, error: taskErr } = await supabase
      .from('production_tasks')
      .select('*, production_clients(name)')
      .eq('id', taskId)
      .maybeSingle();

    if (taskErr || !task) {
      console.warn(`[ProductionSheet] Task ${taskId} not found in Supabase. Skipping sync.`);
      return;
    }

    await runWithMutex(async () => {
      const sheet = await getSheet(ProductionTabs.tasks, Object.values(ProductionTasksColumns));
      const rows = await sheet.getRows();

      const existingRow = rows.find(
        (row) => row.get(ProductionTasksColumns.id) === taskId
      );

      const rowData = {
        [ProductionTasksColumns.id]: task.id,
        [ProductionTasksColumns.client_id]: task.client_id,
        [ProductionTasksColumns.client_name]: task.production_clients?.name || 'Inconnu',
        [ProductionTasksColumns.category]: task.category,
        [ProductionTasksColumns.name]: task.name,
        [ProductionTasksColumns.budget]: String(task.budget_hours).replace('.', ','),
        [ProductionTasksColumns.status]: task.status,
        [ProductionTasksColumns.due_date]: task.due_date || ''
      };

      if (existingRow) {
        for (const [key, val] of Object.entries(rowData)) {
          existingRow.set(key, val);
        }
        await withRetry(() => existingRow.save());
        console.log(`[ProductionSheet] Updated task row: ${task.name}`);
      } else {
        await withRetry(() => sheet.addRow(rowData));
        console.log(`[ProductionSheet] Added task row: ${task.name}`);
      }
    });

    // Sync client to update progression
    await syncProductionClient(task.client_id);
  } catch (err) {
    console.error(`[ProductionSheet] Error syncing task ${taskId}:`, err);
  }
}

/**
 * Syncs a production time log to Google Sheets
 */
export async function syncProductionTimeLog(logId) {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: log, error: logErr } = await supabase
      .from('production_time_logs')
      .select('*, production_tasks(name, client_id)')
      .eq('id', logId)
      .maybeSingle();

    if (logErr || !log) {
      console.warn(`[ProductionSheet] Time log ${logId} not found in Supabase. Skipping sync.`);
      return;
    }

    // Only sync completed time logs (where end_time is not null)
    if (log.end_time === null) {
      return;
    }

    await runWithMutex(async () => {
      const sheet = await getSheet(ProductionTabs.timeLogs, Object.values(ProductionTimeLogsColumns));
      const rows = await sheet.getRows();

      const existingRow = rows.find(
        (row) => row.get(ProductionTimeLogsColumns.id) === logId
      );

      const rowData = {
        [ProductionTimeLogsColumns.id]: log.id,
        [ProductionTimeLogsColumns.task_id]: log.task_id,
        [ProductionTimeLogsColumns.task_name]: log.production_tasks?.name || 'Inconnu',
        [ProductionTimeLogsColumns.employee_id]: log.employee_id,
        [ProductionTimeLogsColumns.employee_name]: log.employee_name,
        [ProductionTimeLogsColumns.duration_seconds]: String(log.duration_seconds),
        [ProductionTimeLogsColumns.duration_formatted]: formatSecondsToHMText(log.duration_seconds),
        [ProductionTimeLogsColumns.log_type]: log.log_type,
        [ProductionTimeLogsColumns.logged_at]: log.logged_at
      };

      if (existingRow) {
        for (const [key, val] of Object.entries(rowData)) {
          existingRow.set(key, val);
        }
        await withRetry(() => existingRow.save());
        console.log(`[ProductionSheet] Updated time log row: ${log.id}`);
      } else {
        await withRetry(() => sheet.addRow(rowData));
        console.log(`[ProductionSheet] Added time log row: ${log.id}`);
      }
    });

    // Sync task (which also syncs client) to keep totals up-to-date
    if (log.task_id) {
      await syncProductionTask(log.task_id);
    }
  } catch (err) {
    console.error(`[ProductionSheet] Error syncing time log ${logId}:`, err);
  }
}

/**
 * Deletes a client row from Google Sheets
 */
export async function deleteProductionClientFromSheets(clientId) {
  try {
    await runWithMutex(async () => {
      const sheet = await getSheet(ProductionTabs.clients, Object.values(ProductionClientsColumns));
      const rows = await sheet.getRows();

      const rowToDelete = rows.find(
        (row) => row.get(ProductionClientsColumns.id) === clientId
      );

      if (rowToDelete) {
        await withRetry(() => rowToDelete.delete());
        console.log(`[ProductionSheet] Deleted client from sheets: ${clientId}`);
      }
    });
  } catch (err) {
    console.error(`[ProductionSheet] Error deleting client ${clientId}:`, err);
  }
}

/**
 * Deletes a task row from Google Sheets
 */
export async function deleteProductionTaskFromSheets(taskId, clientId) {
  try {
    await runWithMutex(async () => {
      const sheet = await getSheet(ProductionTabs.tasks, Object.values(ProductionTasksColumns));
      const rows = await sheet.getRows();

      const rowToDelete = rows.find(
        (row) => row.get(ProductionTasksColumns.id) === taskId
      );

      if (rowToDelete) {
        await withRetry(() => rowToDelete.delete());
        console.log(`[ProductionSheet] Deleted task from sheets: ${taskId}`);
      }
    });

    if (clientId) {
      await syncProductionClient(clientId);
    }
  } catch (err) {
    console.error(`[ProductionSheet] Error deleting task ${taskId}:`, err);
  }
}

/**
 * Deletes a time log row from Google Sheets
 */
export async function deleteProductionTimeLogFromSheets(logId, taskId) {
  try {
    await runWithMutex(async () => {
      const sheet = await getSheet(ProductionTabs.timeLogs, Object.values(ProductionTimeLogsColumns));
      const rows = await sheet.getRows();

      const rowToDelete = rows.find(
        (row) => row.get(ProductionTimeLogsColumns.id) === logId
      );

      if (rowToDelete) {
        await withRetry(() => rowToDelete.delete());
        console.log(`[ProductionSheet] Deleted time log from sheets: ${logId}`);
      }
    });

    if (taskId) {
      await syncProductionTask(taskId);
    }
  } catch (err) {
    console.error(`[ProductionSheet] Error deleting time log ${logId}:`, err);
  }
}
