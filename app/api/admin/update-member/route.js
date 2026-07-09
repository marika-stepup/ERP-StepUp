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
    const { employee_id, name, email, manager_name, initial_balance, initial_perm } = body;

    // Validation
    if (!employee_id || !name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: employee_id, name, email.' },
        { status: 400 }
      );
    }

    const initialCP = parseFloat(initial_balance || 0);
    const initialPermissions = parseFloat(initial_perm || 0);

    // Use mutex to prevent race conditions during updates
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

      // Check if the updated email conflicts with another user
      const emailConflict = rows.some(
        (row) => row.get(LeaveBalancesColumns.employee_id) !== employee_id && 
                 row.get(LeaveBalancesColumns.employee_email)?.toLowerCase() === email.toLowerCase()
      );

      if (emailConflict) {
        return {
          error: `Another member with email "${email}" already exists.`,
          status: 400
        };
      }

      const currentTakenCP = parseFloat(balanceRow.get(LeaveBalancesColumns.taken_days) || 0);
      const currentTakenPerm = parseFloat(balanceRow.get(LeaveBalancesColumns.taken_perm) || 0);

      const newRemainingCP = initialCP - currentTakenCP;
      const newRemainingPerm = initialPermissions - currentTakenPerm;

      // Update values using translated columns
      balanceRow.set(LeaveBalancesColumns.employee_name, name);
      balanceRow.set(LeaveBalancesColumns.employee_email, email.toLowerCase());
      balanceRow.set(LeaveBalancesColumns.manager_name, manager_name || 'Aucun');
      balanceRow.set(LeaveBalancesColumns.initial_balance, initialCP.toString());
      balanceRow.set(LeaveBalancesColumns.remaining_balance, newRemainingCP.toString());
      balanceRow.set(LeaveBalancesColumns.initial_perm, initialPermissions.toString());
      balanceRow.set(LeaveBalancesColumns.remaining_perm, newRemainingPerm.toString());

      await balanceRow.save();

      return {
        success: true,
        data: {
          employee_id,
          employee_name: name,
          employee_email: email.toLowerCase(),
          manager_name: manager_name || 'Aucun',
          initial_balance: initialCP,
          remaining_balance: newRemainingCP,
          initial_perm: initialPermissions,
          remaining_perm: newRemainingPerm
        }
      };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: 'Member updated successfully.',
      member: result.data
    });

  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Internal server error while updating member.' },
      { status: 500 }
    );
  }
}
