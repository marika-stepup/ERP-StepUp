import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet } from '../../../../lib/googleSheets';
import { LeaveRequestsColumns } from '../../../../lib/sheetsColumns';

export async function GET(req) {
  // 1. Authenticate and verify role 'hr'
  const auth = await verifyRole(req, ['hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    // 2. Fetch the Leave_Requests sheet
    const requestsSheet = await getSheet('Leave_Requests');
    const rows = await requestsSheet.getRows();

    // 3. Filter rows with status "Pending"
    const pendingRequests = rows
      .filter((row) => row.get(LeaveRequestsColumns.status) === 'Pending')
      .map((row) => ({
        request_id: row.get(LeaveRequestsColumns.request_id),
        employee_id: row.get(LeaveRequestsColumns.employee_id),
        employee_name: row.get(LeaveRequestsColumns.employee_name),
        start_date: row.get(LeaveRequestsColumns.start_date),
        end_date: row.get(LeaveRequestsColumns.end_date),
        business_days: parseFloat(row.get(LeaveRequestsColumns.business_days) || 0),
        leave_type: row.get(LeaveRequestsColumns.leave_type),
        status: row.get(LeaveRequestsColumns.status),
        created_at: row.get(LeaveRequestsColumns.created_at),
        updated_at: row.get(LeaveRequestsColumns.updated_at),
        hr_comment: row.get(LeaveRequestsColumns.hr_comment)
      }));

    return NextResponse.json({
      success: true,
      count: pendingRequests.length,
      requests: pendingRequests
    });

  } catch (error) {
    console.error('Error fetching pending leave requests:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching pending leave requests.' },
      { status: 500 }
    );
  }
}
