import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, LeaveRequestsColumns, SheetTabs, parseSheetFloat, formatSheetFloat } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  // 1. Authenticate and verify role 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { request_id, action, hr_comment } = body;

    // Validate inputs
    if (!request_id || !action) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : request_id, action.' },
        { status: 400 }
      );
    }

    const normalizedAction = action.trim().toLowerCase();
    if (!['approuver', 'refuser', 'approve', 'reject'].includes(normalizedAction)) {
      return NextResponse.json(
        { error: "Action invalide. Utilisez 'Approuver' ou 'Refuser'." },
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
          error: `Demande de congés avec l'identifiant "${request_id}" introuvable.`,
          status: 404
        };
      }

      // Check if already processed
      const currentStatus = targetRequestRow.get(LeaveRequestsColumns.status);
      if (currentStatus !== 'En attente') {
        return {
          error: `Cette demande a déjà été traitée. Statut actuel : ${currentStatus}.`,
          status: 400
        };
      }

      const employeeId = targetRequestRow.get(LeaveRequestsColumns.employee_id);
      const businessDays = parseSheetFloat(targetRequestRow.get(LeaveRequestsColumns.business_days));
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
            error: `Aucun solde de congés trouvé pour l'identifiant employé : ${employeeId}. Impossible d'approuver la demande.`,
            status: 404
          };
        }

        // Determine column fields depending on CP or Permission type
        const isPermission = leaveType.toLowerCase().includes('perm');
        const initialCol = isPermission ? LeaveBalancesColumns.initial_perm : LeaveBalancesColumns.initial_balance;
        const takenCol = isPermission ? LeaveBalancesColumns.taken_perm : LeaveBalancesColumns.taken_days;
        const remainingCol = isPermission ? LeaveBalancesColumns.remaining_perm : LeaveBalancesColumns.remaining_balance;

        const initialBalanceValue = parseSheetFloat(balanceRow.get(initialCol));
        const currentTakenValue = parseSheetFloat(balanceRow.get(takenCol));
        const currentRemainingValue = parseSheetFloat(balanceRow.get(remainingCol));

        // Re-verify balance
        if (currentRemainingValue < businessDays) {
          return {
            error: `Impossible d'approuver la demande. L'employé dispose de seulement ${currentRemainingValue} jours restants, demandés ${businessDays} jours.`,
            status: 400
          };
        }

        // Calculate updates
        const newTaken = currentTakenValue + businessDays;
        const newRemaining = initialBalanceValue - newTaken;

        // Update Leave_Balances row
        balanceRow.set(takenCol, formatSheetFloat(newTaken));
        balanceRow.set(remainingCol, formatSheetFloat(newRemaining));
        await balanceRow.save();

        // Update Leave_Requests status to "Approuvé"
        targetRequestRow.set(LeaveRequestsColumns.status, 'Approuvé');
        targetRequestRow.set(LeaveRequestsColumns.hr_comment, hr_comment || 'Approuvé');
        targetRequestRow.set(LeaveRequestsColumns.updated_at, nowStr);
        await targetRequestRow.save();

        return {
          success: true,
          status: 'Approuvé',
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
        // Update Leave_Requests status to "Refusé"
        targetRequestRow.set(LeaveRequestsColumns.status, 'Refusé');
        targetRequestRow.set(LeaveRequestsColumns.hr_comment, hr_comment || 'Refusé');
        targetRequestRow.set(LeaveRequestsColumns.updated_at, nowStr);
        await targetRequestRow.save();

        return {
          success: true,
          status: 'Refusé',
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
      message: `La demande de congés a été ${result.status === 'Approuvé' ? 'approuvée' : 'refusée'} avec succès.`,
      data: result.data
    });

  } catch (error) {
    console.error('Error validating leave request:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la validation de la demande de congés.' },
      { status: 500 }
    );
  }
}
