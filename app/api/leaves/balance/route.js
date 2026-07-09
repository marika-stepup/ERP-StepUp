import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns } from '../../../../lib/sheetsColumns';

export async function GET(req) {
  // 1. Authenticate user
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const user = auth.user;

  try {
    // 2. Fetch the Leave_Balances sheet
    const balancesSheet = await getSheet('Leave_Balances');
    const rows = await balancesSheet.getRows();

    // 3. Find the row for the logged-in user
    const balanceRow = rows.find(
      (row) => row.get(LeaveBalancesColumns.employee_id) === user.id || 
               row.get(LeaveBalancesColumns.employee_email)?.toLowerCase() === user.email.toLowerCase()
    );

    if (!balanceRow) {
      return NextResponse.json({
        employee_id: user.id,
        employee_name: user.user_metadata?.full_name || 'Utilisateur',
        employee_email: user.email,
        initial_balance: 25.0,
        taken_days: 0.0,
        remaining_balance: 25.0,
        initial_perm: 5.0,
        taken_perm: 0.0,
        remaining_perm: 5.0,
        warning: 'Initial balance row not seeded in Google Sheets yet.'
      });
    }

    return NextResponse.json({
      employee_id: balanceRow.get(LeaveBalancesColumns.employee_id),
      employee_name: balanceRow.get(LeaveBalancesColumns.employee_name),
      employee_email: balanceRow.get(LeaveBalancesColumns.employee_email),
      initial_balance: parseFloat(balanceRow.get(LeaveBalancesColumns.initial_balance) || 0),
      taken_days: parseFloat(balanceRow.get(LeaveBalancesColumns.taken_days) || 0),
      remaining_balance: parseFloat(balanceRow.get(LeaveBalancesColumns.remaining_balance) || 0),
      initial_perm: parseFloat(balanceRow.get(LeaveBalancesColumns.initial_perm) || 0),
      taken_perm: parseFloat(balanceRow.get(LeaveBalancesColumns.taken_perm) || 0),
      remaining_perm: parseFloat(balanceRow.get(LeaveBalancesColumns.remaining_perm) || 0)
    });

  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching balance.' },
      { status: 500 }
    );
  }
}
