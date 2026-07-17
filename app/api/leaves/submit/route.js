import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet, runWithMutex } from '../../../../lib/googleSheets';
import { calculateBusinessDays, generateUUID } from '../../../../lib/utils';
import { LeaveBalancesColumns, LeaveRequestsColumns, SheetTabs, parseSheetFloat, formatSheetFloat, formatDateToFrench } from '../../../../lib/sheetsColumns';

export async function POST(req) {
  // 1. Authenticate and verify role 'employee' (which includes HR users acting as employees)
  const auth = await verifyRole(req, ['employee', 'hr']);
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
        { error: 'Champs obligatoires manquants : start_date, end_date, leave_type.' },
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
        { error: 'La période demandée ne contient aucun jour ouvré.' },
        { status: 400 }
      );
    }

    // Use mutex to prevent race conditions during balance checks and creations
    const result = await runWithMutex(async () => {
      // 3. Verify in Leave_Balances sheet that balance is sufficient
      const balancesSheet = await getSheet(SheetTabs.balances);
      const balanceRows = await balancesSheet.getRows();

      const employeeBalanceRow = balanceRows.find(
        (row) => row.get(LeaveBalancesColumns.employee_id) === employee.id ||
                 row.get(LeaveBalancesColumns.employee_email)?.toLowerCase() === employee.email.toLowerCase()
      );

      if (!employeeBalanceRow) {
        return {
          error: `Aucun solde de congés trouvé pour l'employé : ${employee.email}. Veuillez contacter les RH.`,
          status: 404
        };
      }

      // Check balance depending on leave type (Permission vs normal CP/RTT)
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

      // 3.5 Check for duplicate / overlapping requests
      const requestsSheet = await getSheet(SheetTabs.requests);
      const requestRows = await requestsSheet.getRows();
      const employeeRequests = requestRows.filter(
        (row) => row.get(LeaveRequestsColumns.employee_id) === employee.id &&
                 row.get(LeaveRequestsColumns.status) !== 'Refusé'
      );

      const newStart = start_date;
      const newEnd = end_date;

      const hasOverlap = employeeRequests.some(row => {
        const existingStart = parseDateFromFrench(row.get(LeaveRequestsColumns.start_date));
        const existingEnd = parseDateFromFrench(row.get(LeaveRequestsColumns.end_date));
        return (newStart <= existingEnd) && (newEnd >= existingStart);
      });

      if (hasOverlap) {
        return {
          error: 'Vous avez déjà une demande en attente ou approuvée sur cette période.',
          status: 400
        };
      }

      // 4. Add new request row in Leave_Requests with status "Pending"
      const requestId = generateUUID();
      const nowStr = new Date().toISOString();

      await requestsSheet.addRow({
        [LeaveRequestsColumns.request_id]: requestId,
        [LeaveRequestsColumns.employee_id]: employee.id,
        [LeaveRequestsColumns.employee_name]: employeeBalanceRow.get(LeaveBalancesColumns.employee_name) || employee.name || 'Utilisateur',
        [LeaveRequestsColumns.start_date]: formatDateToFrench(start_date),
        [LeaveRequestsColumns.end_date]: formatDateToFrench(end_date),
        [LeaveRequestsColumns.business_days]: formatSheetFloat(businessDays),
        [LeaveRequestsColumns.leave_type]: leave_type,
        [LeaveRequestsColumns.status]: 'En attente',
        [LeaveRequestsColumns.created_at]: nowStr,
        [LeaveRequestsColumns.updated_at]: nowStr,
        [LeaveRequestsColumns.hr_comment]: ''
      });

      return {
        success: true,
        data: {
          request_id: requestId,
          employee_id: employee.id,
          employee_name: employeeBalanceRow.get(LeaveBalancesColumns.employee_name) || employee.name,
          start_date,
          end_date,
          business_days: businessDays,
          leave_type,
          status: 'En attente',
          created_at: nowStr
        }
      };
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      message: 'Demande de congés soumise avec succès.',
      request: result.data
    });

  } catch (error) {
    console.error('Error submitting leave request:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la soumission de la demande de congés.' },
      { status: 500 }
    );
  }
}
