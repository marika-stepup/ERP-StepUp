import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { calculateBusinessDays } from '../../../../lib/utils';
import { LeaveBalancesColumns, LeaveRequestsColumns, SheetTabs, parseSheetFloat, formatSheetFloat, formatDateToFrench, parseDateFromFrench } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const employee = auth.user;

  try {
    const body = await req.json();
    const { request_id, start_date, end_date, leave_type } = body;

    if (!request_id || !start_date || !end_date || !leave_type) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
    }

    let businessDays;
    try {
      businessDays = calculateBusinessDays(start_date, end_date);
    } catch (dateErr) {
      return NextResponse.json({ error: dateErr.message }, { status: 400 });
    }

    if (businessDays <= 0) {
      return NextResponse.json({ error: 'La période ne contient aucun jour ouvré.' }, { status: 400 });
    }

    const result = await runWithMutex(async () => {
      // 1. Get request
      const requestsSheet = await getSheet(SheetTabs.requests);
      const requestRows = await requestsSheet.getRows();
      const targetRow = requestRows.find(row => row.get(LeaveRequestsColumns.request_id) === request_id);

      if (!targetRow) {
        return { error: 'Demande introuvable.', status: 404 };
      }

      // Check ownership
      if (targetRow.get(LeaveRequestsColumns.employee_id) !== employee.id) {
        return { error: 'Non autorisé à modifier cette demande.', status: 403 };
      }

      // Check status
      if (targetRow.get(LeaveRequestsColumns.status) !== 'En attente') {
        return { error: 'Seules les demandes en attente peuvent être modifiées.', status: 400 };
      }

      // 2. Check balance
      const balancesSheet = await getSheet(SheetTabs.balances);
      const balanceRows = await balancesSheet.getRows();
      const employeeBalanceRow = balanceRows.find(
        (row) => row.get(LeaveBalancesColumns.employee_id) === employee.id
      );

      if (!employeeBalanceRow) {
        return { error: 'Aucun solde trouvé pour cet employé.', status: 404 };
      }

      const isPermission = leave_type.toLowerCase().includes('perm');
      const balanceField = isPermission 
        ? LeaveBalancesColumns.remaining_perm 
        : LeaveBalancesColumns.remaining_balance;
      
      const remainingBalance = parseSheetFloat(employeeBalanceRow.get(balanceField));

      if (remainingBalance < businessDays) {
        return {
          error: `Solde insuffisant. Demandé : ${businessDays} j, Disponible : ${remainingBalance} j.`,
          status: 400
        };
      }

      // 3. Check overlap with other requests of the same employee
      const otherRequests = requestRows.filter(
        (row) => row.get(LeaveRequestsColumns.employee_id) === employee.id &&
                 row.get(LeaveRequestsColumns.request_id) !== request_id &&
                 row.get(LeaveRequestsColumns.status) !== 'Refusé'
      );

      const hasOverlap = otherRequests.some(row => {
        const existingStart = parseDateFromFrench(row.get(LeaveRequestsColumns.start_date));
        const existingEnd = parseDateFromFrench(row.get(LeaveRequestsColumns.end_date));
        return (start_date <= existingEnd) && (end_date >= existingStart);
      });

      if (hasOverlap) {
        return {
          error: 'Vous avez déjà une demande en attente ou approuvée sur cette période.',
          status: 400
        };
      }

      // 4. Update request row
      const nowStr = new Date().toISOString();
      targetRow.set(LeaveRequestsColumns.start_date, formatDateToFrench(start_date));
      targetRow.set(LeaveRequestsColumns.end_date, formatDateToFrench(end_date));
      targetRow.set(LeaveRequestsColumns.business_days, formatSheetFloat(businessDays));
      targetRow.set(LeaveRequestsColumns.leave_type, leave_type);
      targetRow.set(LeaveRequestsColumns.updated_at, nowStr);

      await targetRow.save();

      return { success: true };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ message: 'Demande modifiée avec succès.' });

  } catch (error) {
    console.error('Error updating leave request:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la modification.' },
      { status: 500 }
    );
  }
}
