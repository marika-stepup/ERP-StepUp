import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, LeaveRequestsColumns, SheetTabs, parseSheetFloat, formatSheetFloat } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const employee = auth.user;

  try {
    const body = await req.json();
    const { request_id } = body;

    if (!request_id) {
      return NextResponse.json({ error: 'Identifiant de demande manquant.' }, { status: 400 });
    }

    const result = await runWithMutex(async () => {
      const requestsSheet = await getSheet(SheetTabs.requests);
      const rows = await requestsSheet.getRows();
      const targetRow = rows.find(row => row.get(LeaveRequestsColumns.request_id) === request_id);

      if (!targetRow) {
        return { error: 'Demande introuvable.', status: 404 };
      }

      // Check ownership & admin permission
      const isOwner = targetRow.get(LeaveRequestsColumns.employee_id) === employee.id;
      const isAdmin = employee.role === 'hr';

      if (!isOwner && !isAdmin) {
        return { error: 'Non autorisé à supprimer cette demande.', status: 403 };
      }

      // Check status permission
      const requestStatus = targetRow.get(LeaveRequestsColumns.status);
      if (requestStatus !== 'En attente' && !isAdmin) {
        return { error: 'Seules les demandes en attente peuvent être supprimées.', status: 400 };
      }

      // If the request was approved and is deleted by admin, restore employee balance
      if (requestStatus === 'Approuvé') {
        const leaveType = targetRow.get(LeaveRequestsColumns.leave_type) || '';
        const isNoDeduct = leaveType.toLowerCase().includes('sans solde') || 
                           leaveType.toLowerCase().includes('rattraper') || 
                           leaveType.toLowerCase().includes('maladie');

        if (!isNoDeduct) {
          const employeeId = targetRow.get(LeaveRequestsColumns.employee_id);
          const businessDays = parseSheetFloat(targetRow.get(LeaveRequestsColumns.business_days));

          const balancesSheet = await getSheet(SheetTabs.balances);
          const balanceRows = await balancesSheet.getRows();
          const balanceRow = balanceRows.find(
            (row) => row.get(LeaveBalancesColumns.employee_id) === employeeId
          );

          if (!balanceRow) {
            return { error: `Aucun solde de congés trouvé pour l'employé lors de la suppression.`, status: 404 };
          }

          const isPermission = leaveType.toLowerCase().includes('perm');
          const initialCol = isPermission ? LeaveBalancesColumns.initial_perm : LeaveBalancesColumns.initial_balance;
          const takenCol = isPermission ? LeaveBalancesColumns.taken_perm : LeaveBalancesColumns.taken_days;
          const remainingCol = isPermission ? LeaveBalancesColumns.remaining_perm : LeaveBalancesColumns.remaining_balance;

          const initialBalanceValue = parseSheetFloat(balanceRow.get(initialCol));
          const currentTakenValue = parseSheetFloat(balanceRow.get(takenCol));

          const newTaken = currentTakenValue - businessDays;
          const newRemaining = initialBalanceValue - newTaken;

          balanceRow.set(takenCol, formatSheetFloat(newTaken));
          balanceRow.set(remainingCol, formatSheetFloat(newRemaining));
          await balanceRow.save();
        }
      }

      // Delete row
      await targetRow.delete();
      return { success: true };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ message: 'Demande supprimée avec succès.' });

  } catch (error) {
    console.error('Error deleting leave request:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la suppression.' },
      { status: 500 }
    );
  }
}
