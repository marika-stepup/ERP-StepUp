import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet } from '../../../../lib/googleSheets';
import { LeaveBalancesColumns, LeaveRequestsColumns, SheetTabs, parseSheetFloat, parseDateFromFrench } from '../../../../lib/sheetsColumns';

export async function GET(req) {
  // 1. Authenticate user (all authenticated roles can fetch this for the global calendar)
  const auth = await verifyRole(req, ['employee', 'hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    // 2. Fetch the Leave_Balances sheet to map employee to service
    const balancesSheet = await getSheet(SheetTabs.balances);
    const balanceRows = await balancesSheet.getRows();
    const serviceMap = {};
    for (const row of balanceRows) {
      const empId = row.get(LeaveBalancesColumns.employee_id);
      const service = row.get(LeaveBalancesColumns.service) || 'Non spécifié';
      if (empId) {
        serviceMap[empId] = service;
      }
    }

    // 3. Fetch the Leave_Requests sheet
    const requestsSheet = await getSheet(SheetTabs.requests);
    const rows = await requestsSheet.getRows();

    // 4. Map and filter requests (only pending and approved ones)
    const requests = rows
      .map((row) => {
        const empId = row.get(LeaveRequestsColumns.employee_id);
        return {
          request_id: row.get(LeaveRequestsColumns.request_id),
          employee_id: empId,
          employee_name: row.get(LeaveRequestsColumns.employee_name),
          start_date: parseDateFromFrench(row.get(LeaveRequestsColumns.start_date)),
          end_date: parseDateFromFrench(row.get(LeaveRequestsColumns.end_date)),
          business_days: parseSheetFloat(row.get(LeaveRequestsColumns.business_days)),
          leave_type: row.get(LeaveRequestsColumns.leave_type),
          status: row.get(LeaveRequestsColumns.status),
          created_at: row.get(LeaveRequestsColumns.created_at),
          updated_at: row.get(LeaveRequestsColumns.updated_at),
          hr_comment: row.get(LeaveRequestsColumns.hr_comment),
          service: serviceMap[empId] || 'Non spécifié'
        };
      })
      .filter((req) => req.status === 'En attente' || req.status === 'Approuvé');

    return NextResponse.json({
      success: true,
      count: requests.length,
      requests
    });

  } catch (error) {
    console.error('Error fetching all leave requests for calendar:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération de tous les congés.' },
      { status: 500 }
    );
  }
}
