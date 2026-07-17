import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex, autoCreditContractAnniversaries } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, SheetTabs, parseSheetFloat, parseDateFromFrench } from '../../../../lib/sheetsColumns';

export async function GET(req) {
  // 1. Authenticate user (all authenticated roles can fetch member balances for the global dashboard)
  const auth = await verifyRole(req, ['employee', 'manager', 'director', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    // Run automatic anniversary crediting with mutex to avoid race conditions
    await runWithMutex(async () => {
      await autoCreditContractAnniversaries();
    });

    // 2. Fetch the Leave_Balances sheet
    const balancesSheet = await getSheet(SheetTabs.balances);
    const rows = await balancesSheet.getRows();

    // 3. Map sheet rows to JSON response
    const members = rows.map((row) => ({
      employee_id: row.get(LeaveBalancesColumns.employee_id),
      employee_name: row.get(LeaveBalancesColumns.employee_name),
      employee_email: row.get(LeaveBalancesColumns.employee_email),
      role: row.get(LeaveBalancesColumns.role) || (
        row.get(LeaveBalancesColumns.employee_email)?.toLowerCase().includes('hr@') ? 'hr' :
        row.get(LeaveBalancesColumns.employee_email)?.toLowerCase().includes('manager@') ? 'manager' :
        row.get(LeaveBalancesColumns.employee_email)?.toLowerCase().includes('director@') ? 'director' :
        row.get(LeaveBalancesColumns.employee_email)?.toLowerCase().includes('directeur@') ? 'director' : 'employee'
      ),
      initial_balance: parseSheetFloat(row.get(LeaveBalancesColumns.initial_balance)),
      taken_days: parseSheetFloat(row.get(LeaveBalancesColumns.taken_days)),
      remaining_balance: parseSheetFloat(row.get(LeaveBalancesColumns.remaining_balance)),
      // Permissions support
      initial_perm: parseSheetFloat(row.get(LeaveBalancesColumns.initial_perm)),
      taken_perm: parseSheetFloat(row.get(LeaveBalancesColumns.taken_perm)),
      remaining_perm: parseSheetFloat(row.get(LeaveBalancesColumns.remaining_perm)),
      // Hierarchy manager
      manager_name: row.get(LeaveBalancesColumns.manager_name) || 'Aucun',
      service: row.get(LeaveBalancesColumns.service) || 'Non spécifié',
      // Hire date
      hire_date: parseDateFromFrench(row.get(LeaveBalancesColumns.hire_date)) || ''
    }));

    return NextResponse.json({
      success: true,
      count: members.length,
      members
    });

  } catch (error) {
    console.error('Error fetching members list:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération de la liste des membres.' },
      { status: 500 }
    );
  }
}
