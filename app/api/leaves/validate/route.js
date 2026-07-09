import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';

export async function POST(req) {
  // 1. Authenticate and verify role 'hr'
  const auth = await verifyRole(req, ['hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const hrUser = auth.user;

  try {
    const body = await req.json();
    const { request_id, action, hr_comment } = body;

    // Validate inputs
    if (!request_id || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: request_id, action.' },
        { status: 400 }
      );
    }

    const normalizedAction = action.trim().toLowerCase();
    if (!['approuver', 'refuser', 'approve', 'reject'].includes(normalizedAction)) {
      return NextResponse.json(
        { error: "Invalid action. Use 'Approuver' or 'Refuser'." },
        { status: 400 }
      );
    }

    // Use mutex to serialize database changes and prevent race conditions
    const result = await runWithMutex(async () => {
      // 2. Find request in Leave_Requests
      const requestsSheet = await getSheet('Leave_Requests');
      const requestRows = await requestsSheet.getRows();

      const targetRequestRow = requestRows.find(
        (row) => row.get('request_id') === request_id
      );

      if (!targetRequestRow) {
        return {
          error: `Leave request with ID "${request_id}" not found.`,
          status: 404
        };
      }

      // Check if already processed
      const currentStatus = targetRequestRow.get('status');
      if (currentStatus !== 'Pending') {
        return {
          error: `This request has already been processed. Current status: ${currentStatus}.`,
          status: 400
        };
      }

      const employeeId = targetRequestRow.get('employee_id');
      const businessDays = parseFloat(targetRequestRow.get('business_days') || 0);
      const nowStr = new Date().toISOString();

      if (normalizedAction === 'approuver' || normalizedAction === 'approve') {
        // 3. Find employee balance row in Leave_Balances
        const balancesSheet = await getSheet('Leave_Balances');
        const balanceRows = await balancesSheet.getRows();

        const balanceRow = balanceRows.find(
          (row) => row.get('employee_id') === employeeId
        );

        if (!balanceRow) {
          return {
            error: `Leave balance record not found for employee ID: ${employeeId}. Cannot approve request.`,
            status: 404
          };
        }

        const initialBalance = parseFloat(balanceRow.get('initial_balance') || 0);
        const currentTaken = parseFloat(balanceRow.get('taken_days') || 0);
        const currentRemaining = parseFloat(balanceRow.get('remaining_balance') || 0);

        // Re-verify balance (double-spend protection in case of concurrent approvals)
        if (currentRemaining < businessDays) {
          return {
            error: `Cannot approve request. Employee only has ${currentRemaining} remaining days, requested ${businessDays} days.`,
            status: 400
          };
        }

        // Calculate updates
        const newTaken = currentTaken + businessDays;
        const newRemaining = initialBalance - newTaken;

        // Update Leave_Balances row
        balanceRow.set('taken_days', newTaken.toString());
        balanceRow.set('remaining_balance', newRemaining.toString());
        await balanceRow.save();

        // Update Leave_Requests status to "Approved"
        targetRequestRow.set('status', 'Approved');
        targetRequestRow.set('hr_comment', hr_comment || 'Approuvé');
        targetRequestRow.set('updated_at', nowStr);
        await targetRequestRow.save();

        return {
          success: true,
          status: 'Approved',
          data: {
            request_id,
            employee_id: employeeId,
            business_days: businessDays,
            new_taken_days: newTaken,
            new_remaining_balance: newRemaining
          }
        };

      } else {
        // Refuse request
        // Update Leave_Requests status to "Rejected"
        targetRequestRow.set('status', 'Rejected');
        targetRequestRow.set('hr_comment', hr_comment || 'Refusé');
        targetRequestRow.set('updated_at', nowStr);
        await targetRequestRow.save();

        return {
          success: true,
          status: 'Rejected',
          data: {
            request_id,
            employee_id: employeeId,
            business_days: businessDays
          }
        };
      }
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: `Leave request has been successfully ${result.status === 'Approved' ? 'approved' : 'rejected'}.`,
      data: result.data
    });

  } catch (error) {
    console.error('Error validating leave request:', error);
    return NextResponse.json(
      { error: 'Internal server error while validating the leave request.' },
      { status: 500 }
    );
  }
}
