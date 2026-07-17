import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex, autoCreditContractAnniversaries } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, SheetTabs, parseSheetFloat, parseDateFromFrench } from '../../../../lib/sheetsColumns';

export async function GET(req) {
  // 1. Authenticate user
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const user = auth.user;

  try {
    // Run automatic anniversary crediting with mutex to avoid race conditions
    await runWithMutex(async () => {
      await autoCreditContractAnniversaries();
    });

    // 2. Fetch the Leave_Balances sheet
    const balancesSheet = await getSheet(SheetTabs.balances);
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
        hire_date: '',
        warning: 'Ligne de solde initial non encore initialisée dans Google Sheets.'
      });
    }

    return NextResponse.json({
      employee_id: balanceRow.get(LeaveBalancesColumns.employee_id),
      employee_name: balanceRow.get(LeaveBalancesColumns.employee_name),
      employee_email: balanceRow.get(LeaveBalancesColumns.employee_email),
      initial_balance: parseSheetFloat(balanceRow.get(LeaveBalancesColumns.initial_balance)),
      taken_days: parseSheetFloat(balanceRow.get(LeaveBalancesColumns.taken_days)),
      remaining_balance: parseSheetFloat(balanceRow.get(LeaveBalancesColumns.remaining_balance)),
      initial_perm: parseSheetFloat(balanceRow.get(LeaveBalancesColumns.initial_perm)),
      taken_perm: parseSheetFloat(balanceRow.get(LeaveBalancesColumns.taken_perm)),
      remaining_perm: parseSheetFloat(balanceRow.get(LeaveBalancesColumns.remaining_perm)),
      hire_date: parseDateFromFrench(balanceRow.get(LeaveBalancesColumns.hire_date)) || ''
    });

  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération du solde.' },
      { status: 500 }
    );
  }
}
