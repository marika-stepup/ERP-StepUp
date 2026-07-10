import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, SheetTabs } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  // 1. Authenticate user as 'hr'
  const auth = await verifyRole(req, ['hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { employee_id, type, value } = body;

    // Validation
    if (!employee_id || !type || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: employee_id, type, value.' },
        { status: 400 }
      );
    }

    const normalizedType = type.toLowerCase();
    if (normalizedType !== 'cp' && normalizedType !== 'perm') {
      return NextResponse.json(
        { error: "Invalid type. Use 'cp' or 'perm'." },
        { status: 400 }
      );
    }

    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue < 0) {
      return NextResponse.json(
        { error: 'Value must be a valid non-negative number.' },
        { status: 400 }
      );
    }

    // Use mutex to serialize changes and prevent race conditions
    const result = await runWithMutex(async () => {
      const balancesSheet = await getSheet(SheetTabs.balances);
      const rows = await balancesSheet.getRows();

      const balanceRow = rows.find(
        (row) => row.get(LeaveBalancesColumns.employee_id) === employee_id || 
                 row.get(LeaveBalancesColumns.employee_email)?.toLowerCase() === employee_id.toLowerCase()
      );

      if (!balanceRow) {
        return {
          error: `Member with ID or Email "${employee_id}" not found.`,
          status: 404
        };
      }

      if (normalizedType === 'cp') {
        const currentTaken = parseFloat(balanceRow.get(LeaveBalancesColumns.taken_days) || 0);
        const newRemaining = numericValue - currentTaken;

        balanceRow.set(LeaveBalancesColumns.initial_balance, numericValue.toString());
        balanceRow.set(LeaveBalancesColumns.remaining_balance, newRemaining.toString());
        await balanceRow.save();

        return {
          success: true,
          data: {
            employee_id: balanceRow.get(LeaveBalancesColumns.employee_id),
            employee_name: balanceRow.get(LeaveBalancesColumns.employee_name),
            type: 'cp',
            initial_balance: numericValue,
            remaining_balance: newRemaining
          }
        };
      } else {
        const currentTaken = parseFloat(balanceRow.get(LeaveBalancesColumns.taken_perm) || 0);
        const newRemaining = numericValue - currentTaken;

        balanceRow.set(LeaveBalancesColumns.initial_perm, numericValue.toString());
        balanceRow.set(LeaveBalancesColumns.remaining_perm, newRemaining.toString());
        await balanceRow.save();

        return {
          success: true,
          data: {
            employee_id: balanceRow.get(LeaveBalancesColumns.employee_id),
            employee_name: balanceRow.get(LeaveBalancesColumns.employee_name),
            type: 'perm',
            initial_perm: numericValue,
            remaining_perm: newRemaining
          }
        };
      }
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: 'Member balance adjusted successfully.',
      balance: result.data
    });

  } catch (error) {
    console.error('Error adjusting balance:', error);
    return NextResponse.json(
      { error: 'Internal server error while adjusting balance.' },
      { status: 500 }
    );
  }
}
