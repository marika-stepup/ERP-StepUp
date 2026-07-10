import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, LeaveRequestsColumns, SheetTabs } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  // 1. Authenticate and verify role 'hr'
  const auth = await verifyRole(req, ['hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

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
      const requestsSheet = await getSheet(SheetTabs.requests);
      const requestRows = await requestsSheet.getRows();

      const targetRequestRow = requestRows.find(
        (row) => row.get(LeaveRequestsColumns.request_id) === request_id
      );

      if (!targetRequestRow) {
        return {
          error: `Leave request with ID "${request_id}" not found.`,
          status: 404
        };
      }

      // Check if already processed
      const currentStatus = targetRequestRow.get(LeaveRequestsColumns.status);
      if (currentStatus !== 'Pending') {
        return {
          error: `This request has already been processed. Current status: ${currentStatus}.`,
          status: 400
        };
      }

      const employeeId = targetRequestRow.get(LeaveRequestsColumns.employee_id);
      const businessDays = parseFloat(targetRequestRow.get(LeaveRequestsColumns.business_days) || 0);
      const leaveType = targetRequestRow.get(LeaveRequestsColumns.leave_type) || '';
      const nowStr = new Date().toISOString();

      if (normalizedAction === 'approuver' || normalizedAction === 'approve') {
        // 3. Find employee balance row in Leave_Balances
        const balancesSheet = await getSheet(SheetTabs.balances);
        const balanceRows = await balancesSheet.getRows();

        const balanceRow = balanceRows.find(
          (row) => row.get(LeaveBalancesColumns.employee_id) === employeeId
        );

        if (!balanceRow) {
          return {
            error: `Leave balance record not found for employee ID: ${employeeId}. Cannot approve request.`,
            status: 404
          };
        }

        // Determine column fields depending on CP or Permission type
        const isPermission = leaveType.toLowerCase().includes('perm');
        const initialCol = isPermission ? LeaveBalancesColumns.initial_perm : LeaveBalancesColumns.initial_balance;
        const takenCol = isPermission ? LeaveBalancesColumns.taken_perm : LeaveBalancesColumns.taken_days;
        const remainingCol = isPermission ? LeaveBalancesColumns.remaining_perm : LeaveBalancesColumns.remaining_balance;

        const initialBalanceValue = parseFloat(balanceRow.get(initialCol) || 0);
        const currentTakenValue = parseFloat(balanceRow.get(takenCol) || 0);
        const currentRemainingValue = parseFloat(balanceRow.get(remainingCol) || 0);

        // Re-verify balance
        if (currentRemainingValue < businessDays) {
          return {
            error: `Cannot approve request. Employee only has ${currentRemainingValue} remaining days, requested ${businessDays} days.`,
            status: 400
          };
        }

        // Calculate updates
        const newTaken = currentTakenValue + businessDays;
        const newRemaining = initialBalanceValue - newTaken;

        // Update Leave_Balances row
        balanceRow.set(takenCol, newTaken.toString());
        balanceRow.set(remainingCol, newRemaining.toString());
        await balanceRow.save();

        // Update Leave_Requests status to "Approved"
        targetRequestRow.set(LeaveRequestsColumns.status, 'Approved');
        targetRequestRow.set(LeaveRequestsColumns.hr_comment, hr_comment || 'Approuvé');
        targetRequestRow.set(LeaveRequestsColumns.updated_at, nowStr);
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
        targetRequestRow.set(LeaveRequestsColumns.status, 'Rejected');
        targetRequestRow.set(LeaveRequestsColumns.hr_comment, hr_comment || 'Refusé');
        targetRequestRow.set(LeaveRequestsColumns.updated_at, nowStr);
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
