import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { calculateBusinessDays, generateUUID } from '../../../../lib/utils';

export async function POST(req) {
  // 1. Authenticate and verify role 'employee'
  const auth = await verifyRole(req, ['employee']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const employee = auth.user;

  try {
    const body = await req.json();
    const { start_date, end_date, leave_type } = body;

    // Validation of mandatory fields
    if (!start_date || !end_date || !leave_type) {
      return NextResponse.json(
        { error: 'Missing required fields: start_date, end_date, leave_type.' },
        { status: 400 }
      );
    }

    // 2. Calculate working days
    let businessDays;
    try {
      businessDays = calculateBusinessDays(start_date, end_date);
    } catch (dateErr) {
      return NextResponse.json({ error: dateErr.message }, { status: 400 });
    }

    if (businessDays <= 0) {
      return NextResponse.json(
        { error: 'Requested range does not contain any business days.' },
        { status: 400 }
      );
    }

    // Use mutex to prevent race conditions during balance checks and creations
    const result = await runWithMutex(async () => {
      // 3. Verify in Leave_Balances sheet that balance is sufficient
      const balancesSheet = await getSheet('Leave_Balances');
      const balanceRows = await balancesSheet.getRows();

      const employeeBalanceRow = balanceRows.find(
        (row) => row.get('employee_id') === employee.id
      );

      if (!employeeBalanceRow) {
        return {
          error: `No leave balance record found for employee ID: ${employee.id}. Please contact HR.`,
          status: 404
        };
      }

      const remainingBalance = parseFloat(employeeBalanceRow.get('remaining_balance') || 0);

      if (remainingBalance < businessDays) {
        return {
          error: `Insufficient leave balance. Requested: ${businessDays} days, Available: ${remainingBalance} days.`,
          status: 400
        };
      }

      // 4. Add new request row in Leave_Requests with status "Pending"
      const requestsSheet = await getSheet('Leave_Requests');
      const requestId = generateUUID();
      const nowStr = new Date().toISOString();

      await requestsSheet.addRow({
        request_id: requestId,
        employee_id: employee.id,
        employee_name: employee.name,
        start_date: start_date,
        end_date: end_date,
        business_days: businessDays.toString(),
        leave_type: leave_type,
        status: 'Pending',
        created_at: nowStr,
        updated_at: nowStr,
        hr_comment: ''
      });

      return {
        success: true,
        data: {
          request_id: requestId,
          employee_id: employee.id,
          employee_name: employee.name,
          start_date,
          end_date,
          business_days: businessDays,
          leave_type,
          status: 'Pending',
          created_at: nowStr
        }
      };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: 'Leave request submitted successfully.',
      request: result.data
    });

  } catch (error) {
    console.error('Error submitting leave request:', error);
    return NextResponse.json(
      { error: 'Internal server error while processing the leave request.' },
      { status: 500 }
    );
  }
}
