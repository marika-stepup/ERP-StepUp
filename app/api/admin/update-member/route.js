import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';

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
        (row) => row.get('employee_id') === employee_id
      );

      if (!balanceRow) {
        return {
          error: `Member with ID "${employee_id}" not found.`,
          status: 404
        };
      }

      // Check if the updated email conflicts with another user
      const emailConflict = rows.some(
        (row) => row.get('employee_id') !== employee_id && 
                 row.get('employee_email')?.toLowerCase() === email.toLowerCase()
      );

      if (emailConflict) {
        return {
          error: `Another member with email "${email}" already exists.`,
          status: 400
        };
      }

      const currentTakenCP = parseFloat(balanceRow.get('taken_days') || 0);
      const currentTakenPerm = parseFloat(balanceRow.get('taken_perm') || 0);

      const newRemainingCP = initialCP - currentTakenCP;
      const newRemainingPerm = initialPermissions - currentTakenPerm;

      // Update values
      balanceRow.set('employee_name', name);
      balanceRow.set('employee_email', email.toLowerCase());
      balanceRow.set('manager_name', manager_name || 'Aucun');
      balanceRow.set('initial_balance', initialCP.toString());
      balanceRow.set('remaining_balance', newRemainingCP.toString());
      balanceRow.set('initial_perm', initialPermissions.toString());
      balanceRow.set('remaining_perm', newRemainingPerm.toString());

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
