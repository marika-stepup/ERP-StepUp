import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet } from '../../../../lib/googleSheets';

export async function GET(req) {
  // 1. Authenticate user (either employee or hr can view their own balance)
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
    const balanceRow = rows.find((row) => row.get('employee_id') === user.id);

    if (!balanceRow) {
      // If no row exists, we return a default mock balance or notify them
      return NextResponse.json({
        employee_id: user.id,
        employee_name: user.name,
        employee_email: user.email,
        initial_balance: 25.0,
        taken_days: 0.0,
        remaining_balance: 25.0,
        warning: 'Initial balance row not seeded in Google Sheets yet.'
      });
    }

    return NextResponse.json({
      employee_id: balanceRow.get('employee_id'),
      employee_name: balanceRow.get('employee_name'),
      employee_email: balanceRow.get('employee_email'),
      initial_balance: parseFloat(balanceRow.get('initial_balance') || 0),
      taken_days: parseFloat(balanceRow.get('taken_days') || 0),
      remaining_balance: parseFloat(balanceRow.get('remaining_balance') || 0)
    });

  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching balance.' },
      { status: 500 }
    );
  }
}
