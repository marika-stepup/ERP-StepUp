import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  // 1. Authenticate user as 'hr'
  const auth = await verifyRole(req, ['hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { employee_id } = body;

    // Validation
    if (!employee_id) {
      return NextResponse.json(
        { error: 'Missing required field: employee_id.' },
        { status: 400 }
      );
    }

    // Use mutex to prevent race conditions during deletion
    const result = await runWithMutex(async () => {
      const balancesSheet = await getSheet('Leave_Balances');
      const rows = await balancesSheet.getRows();

      const balanceRow = rows.find(
        (row) => row.get(LeaveBalancesColumns.employee_id) === employee_id
      );

      if (!balanceRow) {
        return {
          error: `Member with ID "${employee_id}" not found.`,
          status: 404
        };
      }

      const employeeName = balanceRow.get(LeaveBalancesColumns.employee_name);
      
      // Delete the row from the Google Sheet
      await balanceRow.delete();

      return {
        success: true,
        employee_name: employeeName
      };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: `Member "${result.employee_name}" has been successfully deleted.`
    });

  } catch (error) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { error: 'Internal server error while deleting member.' },
      { status: 500 }
    );
  }
}
