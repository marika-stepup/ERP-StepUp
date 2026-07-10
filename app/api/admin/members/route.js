import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns } from '../../../../lib/sheetsColumns';

export async function GET(req) {
  // 1. Authenticate user as 'hr'
  const auth = await verifyRole(req, ['hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    // 2. Fetch the Leave_Balances sheet
    const balancesSheet = await getSheet('Leave_Balances');
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
      initial_balance: parseFloat(row.get(LeaveBalancesColumns.initial_balance) || 0),
      taken_days: parseFloat(row.get(LeaveBalancesColumns.taken_days) || 0),
      remaining_balance: parseFloat(row.get(LeaveBalancesColumns.remaining_balance) || 0),
      // Permissions support
      initial_perm: parseFloat(row.get(LeaveBalancesColumns.initial_perm) || 0),
      taken_perm: parseFloat(row.get(LeaveBalancesColumns.taken_perm) || 0),
      remaining_perm: parseFloat(row.get(LeaveBalancesColumns.remaining_perm) || 0),
      // Hierarchy manager
      manager_name: row.get(LeaveBalancesColumns.manager_name) || 'Aucun'
    }));

    return NextResponse.json({
      success: true,
      count: members.length,
      members
    });

  } catch (error) {
    console.error('Error fetching members list:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching members list.' },
      { status: 500 }
    );
  }
}
