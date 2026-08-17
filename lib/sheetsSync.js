import { getSheet, runWithMutex, withRetry } from './googleSheets.js';
import { getSupabaseAdmin } from './supabaseAuth.js';
import { 
  SheetTabs, 
  LeaveBalancesColumns, 
  LeaveRequestsColumns, 
  TimeLogsColumns,
  formatSheetFloat, 
  formatDateToFrench,
  parseDateFromFrench
} from './sheetsColumns.js';

/**
 * Syncs a single employee's balance from Supabase to Google Sheets.
 * @param {string} employeeId - Supabase Auth User ID
 */
export async function syncEmployeeBalance(employeeId) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: member, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (error || !member) {
      console.warn(`[SyncSheets] Member ${employeeId} not found in Supabase. Skipping sync.`);
      return;
    }

    await runWithMutex(async () => {
      const balancesSheet = await getSheet(SheetTabs.balances);
      const rows = await balancesSheet.getRows();

      const balanceRow = rows.find(
        (row) => row.get(LeaveBalancesColumns.employee_id) === employeeId
      );

      const rowData = {
        [LeaveBalancesColumns.employee_id]: member.employee_id,
        [LeaveBalancesColumns.employee_name]: member.employee_name,
        [LeaveBalancesColumns.employee_first_name]: member.employee_first_name,
        [LeaveBalancesColumns.employee_email]: member.employee_email,
        [LeaveBalancesColumns.role]: member.role,
        [LeaveBalancesColumns.initial_balance]: formatSheetFloat(member.initial_balance),
        [LeaveBalancesColumns.taken_days]: formatSheetFloat(member.taken_days),
        [LeaveBalancesColumns.remaining_balance]: formatSheetFloat(member.remaining_balance),
        [LeaveBalancesColumns.initial_perm]: formatSheetFloat(member.initial_perm),
        [LeaveBalancesColumns.taken_perm]: formatSheetFloat(member.taken_perm),
        [LeaveBalancesColumns.remaining_perm]: formatSheetFloat(member.remaining_perm),
        [LeaveBalancesColumns.manager_name]: member.manager_name || 'Aucun',
        [LeaveBalancesColumns.service]: member.service || 'Non spécifié',
        [LeaveBalancesColumns.hire_date]: member.hire_date ? formatDateToFrench(member.hire_date) : '',
        [LeaveBalancesColumns.last_anniversary_credited]: member.last_anniversary_credited ? formatDateToFrench(member.last_anniversary_credited) : '',
        [LeaveBalancesColumns.last_monthly_credit]: member.last_monthly_credit || '',
      };

      if (balanceRow) {
        // Update existing row
        for (const [key, val] of Object.entries(rowData)) {
          balanceRow.set(key, val);
        }
        await withRetry(() => balanceRow.save());
        console.log(`[SyncSheets] Updated balance row in Google Sheets for ${member.employee_email}`);
      } else {
        // Add new row
        await withRetry(() => balancesSheet.addRow(rowData));
        console.log(`[SyncSheets] Added new balance row in Google Sheets for ${member.employee_email}`);
      }
    });
  } catch (err) {
    console.error(`[SyncSheets] Failed to sync balance for employee ${employeeId}:`, err);
  }
}

/**
 * Syncs a single leave request from Supabase to Google Sheets.
 * @param {string} requestId - UUID of the leave request
 */
export async function syncLeaveRequest(requestId) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: request, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('request_id', requestId)
      .single();

    if (error || !request) {
      console.warn(`[SyncSheets] Leave request ${requestId} not found in Supabase. Skipping sync.`);
      return;
    }

    await runWithMutex(async () => {
      const requestsSheet = await getSheet(SheetTabs.requests);
      const rows = await requestsSheet.getRows();

      const requestRow = rows.find(
        (row) => row.get(LeaveRequestsColumns.request_id) === requestId
      );

      const rowData = {
        [LeaveRequestsColumns.request_id]: request.request_id,
        [LeaveRequestsColumns.employee_id]: request.employee_id,
        [LeaveRequestsColumns.employee_name]: request.employee_name,
        [LeaveRequestsColumns.start_date]: formatDateToFrench(request.start_date),
        [LeaveRequestsColumns.end_date]: formatDateToFrench(request.end_date),
        [LeaveRequestsColumns.business_days]: formatSheetFloat(request.business_days),
        [LeaveRequestsColumns.leave_type]: request.leave_type,
        [LeaveRequestsColumns.status]: request.status,
        [LeaveRequestsColumns.created_at]: request.created_at,
        [LeaveRequestsColumns.updated_at]: request.updated_at,
        [LeaveRequestsColumns.hr_comment]: request.hr_comment || '',
      };

      if (requestRow) {
        // Update existing row
        for (const [key, val] of Object.entries(rowData)) {
          requestRow.set(key, val);
        }
        await withRetry(() => requestRow.save());
        console.log(`[SyncSheets] Updated request row in Google Sheets for ID ${requestId}`);
      } else {
        // Add new row
        await withRetry(() => requestsSheet.addRow(rowData));
        console.log(`[SyncSheets] Added new request row in Google Sheets for ID ${requestId}`);
      }
    });
  } catch (err) {
    console.error(`[SyncSheets] Failed to sync request ${requestId}:`, err);
  }
}

/**
 * Deletes a leave request row from Google Sheets.
 * @param {string} requestId - UUID of the leave request to delete
 */
export async function deleteLeaveRequestFromSheets(requestId) {
  try {
    await runWithMutex(async () => {
      const requestsSheet = await getSheet(SheetTabs.requests);
      const rows = await requestsSheet.getRows();

      const requestRow = rows.find(
        (row) => row.get(LeaveRequestsColumns.request_id) === requestId
      );

      if (requestRow) {
        await withRetry(() => requestRow.delete());
        console.log(`[SyncSheets] Deleted request row from Google Sheets for ID ${requestId}`);
      }
    });
  } catch (err) {
    console.error(`[SyncSheets] Failed to delete request ${requestId} from Sheets:`, err);
  }
}

/**
 * Deletes a member's balance row from Google Sheets.
 * @param {string} employeeId - UUID of the employee to delete
 */
export async function deleteEmployeeBalanceFromSheets(employeeId) {
  try {
    await runWithMutex(async () => {
      const balancesSheet = await getSheet(SheetTabs.balances);
      const rows = await balancesSheet.getRows();

      const balanceRow = rows.find(
        (row) => row.get(LeaveBalancesColumns.employee_id) === employeeId
      );

      if (balanceRow) {
        await withRetry(() => balanceRow.delete());
        console.log(`[SyncSheets] Deleted balance row from Google Sheets for Employee ID ${employeeId}`);
      }
    });
  } catch (err) {
    console.error(`[SyncSheets] Failed to delete balance for ${employeeId} from Sheets:`, err);
  }
}

/**
 * Syncs a time log row (clock-in/clock-out) from Supabase to Google Sheets.
 * @param {string} employeeId - UUID of the employee
 * @param {string} date - Date in YYYY-MM-DD format
 */
export async function syncTimeLog(employeeId, date) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: log, error } = await supabase
      .from('time_logs')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle();

    if (error) {
      console.error(`[SyncSheets] Error fetching time log for ${employeeId} on ${date}:`, error);
      return;
    }

    if (!log) {
      console.warn(`[SyncSheets] Time log not found in Supabase for ${employeeId} on ${date}. Skipping sync.`);
      return;
    }

    await runWithMutex(async () => {
      const timeLogsSheet = await getSheet(SheetTabs.timeLogs);
      const rows = await timeLogsSheet.getRows();

      const logRow = rows.find(
        (row) => row.get(TimeLogsColumns.employee_id) === employeeId && 
                 parseDateFromFrench(row.get(TimeLogsColumns.date)) === date
      );

      // Compute total hours worked
      let totalHoursStr = '';
      if (log.clock_in && log.clock_out) {
        const [inH, inM] = log.clock_in.split(':').map(Number);
        const [outH, outM] = log.clock_out.split(':').map(Number);
        const diffMs = (outH * 60 + outM) - (inH * 60 + inM);
        if (diffMs > 0) {
          const hrs = Math.floor(diffMs / 60);
          const mins = diffMs % 60;
          totalHoursStr = `${hrs}h ${mins.toString().padStart(2, '0')}m`;
        }
      }

      const rowData = {
        [TimeLogsColumns.log_id]: log.id,
        [TimeLogsColumns.employee_id]: log.employee_id,
        [TimeLogsColumns.date]: formatDateToFrench(log.date),
        [TimeLogsColumns.clock_in]: log.clock_in ? log.clock_in.substring(0, 5) : '',
        [TimeLogsColumns.clock_out]: log.clock_out ? log.clock_out.substring(0, 5) : '',
        [TimeLogsColumns.break_duration]: '0h 00m',
        [TimeLogsColumns.total_hours]: totalHoursStr,
        [TimeLogsColumns.status]: log.status || 'Présent',
        [TimeLogsColumns.created_at]: formatDateToFrench(log.created_at.split('T')[0])
      };

      if (logRow) {
        // Update existing row
        for (const [key, val] of Object.entries(rowData)) {
          logRow.set(key, val);
        }
        await withRetry(() => logRow.save());
        console.log(`[SyncSheets] Updated time log row in Google Sheets for ${log.employee_name} on ${date}`);
      } else {
        // Add new row
        await withRetry(() => timeLogsSheet.addRow(rowData));
        console.log(`[SyncSheets] Added new time log row in Google Sheets for ${log.employee_name} on ${date}`);
      }
    });
  } catch (err) {
    console.error(`[SyncSheets] Failed to sync time log for ${employeeId} on ${date}:`, err);
  }
}
