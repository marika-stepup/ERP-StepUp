import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, SheetTabs, parseSheetFloat, formatSheetFloat, formatDateToFrench } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  // 1. Authenticate user as 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { employee_id, name, email, role, manager_name, initial_balance, initial_perm, service, hire_date } = body;

    // Validation
    if (!employee_id || !name || !email) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : employee_id, name, email.' },
        { status: 400 }
      );
    }

    const initialCP = parseFloat(initial_balance || 0);
    const initialPermissions = parseFloat(initial_perm || 0);

    // Use mutex to prevent race conditions during updates
    const result = await runWithMutex(async () => {
      const balancesSheet = await getSheet(SheetTabs.balances);
      const rows = await balancesSheet.getRows();

      const balanceRow = rows.find(
        (row) => row.get(LeaveBalancesColumns.employee_id) === employee_id
      );

      if (!balanceRow) {
        return {
          error: `Membre avec l'identifiant "${employee_id}" introuvable.`,
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
          error: `Un autre membre avec l'e-mail "${email}" existe déjà.`,
          status: 400
        };
      }

      const currentTakenCP = parseSheetFloat(balanceRow.get(LeaveBalancesColumns.taken_days));
      const currentTakenPerm = parseSheetFloat(balanceRow.get(LeaveBalancesColumns.taken_perm));

      const newRemainingCP = initialCP - currentTakenCP;
      const newRemainingPerm = initialPermissions - currentTakenPerm;

      // Update values using translated columns
      balanceRow.set(LeaveBalancesColumns.employee_name, name);
      balanceRow.set(LeaveBalancesColumns.employee_email, email.toLowerCase());
      balanceRow.set(LeaveBalancesColumns.role, role || 'employee');
      balanceRow.set(LeaveBalancesColumns.manager_name, manager_name || 'Aucun');
      balanceRow.set(LeaveBalancesColumns.service, service || 'Non spécifié');
      balanceRow.set(LeaveBalancesColumns.initial_balance, formatSheetFloat(initialCP));
      balanceRow.set(LeaveBalancesColumns.remaining_balance, formatSheetFloat(newRemainingCP));
      balanceRow.set(LeaveBalancesColumns.initial_perm, formatSheetFloat(initialPermissions));
      balanceRow.set(LeaveBalancesColumns.remaining_perm, formatSheetFloat(newRemainingPerm));
      balanceRow.set(LeaveBalancesColumns.hire_date, hire_date ? formatDateToFrench(hire_date) : '');

      await balanceRow.save();

      return {
        success: true,
        data: {
          employee_id,
          employee_name: name,
          employee_email: email.toLowerCase(),
          role: role || 'employee',
          manager_name: manager_name || 'Aucun',
          initial_balance: initialCP,
          remaining_balance: newRemainingCP,
          initial_perm: initialPermissions,
          remaining_perm: newRemainingPerm,
          service: service || 'Non spécifié',
          hire_date: hire_date || ''
        }
      };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: 'Membre mis à jour avec succès.',
      member: result.data
    });

  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la mise à jour du membre.' },
      { status: 500 }
    );
  }
}
