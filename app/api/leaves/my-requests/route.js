import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet } from '../../../../lib/googleSheets';
import { LeaveRequestsColumns, SheetTabs } from '../../../../lib/sheetsColumns';

export async function GET(req) {
  // 1. Authenticate user
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const user = auth.user;

  try {
    // 2. Fetch Leave_Requests
    const requestsSheet = await getSheet(SheetTabs.requests);
    const rows = await requestsSheet.getRows();

    // 3. Filter by employee_id
    const userRequests = rows
      .filter((row) => row.get(LeaveRequestsColumns.employee_id) === user.id)
      .map((row) => ({
        request_id: row.get(LeaveRequestsColumns.request_id),
        start_date: row.get(LeaveRequestsColumns.start_date),
        end_date: row.get(LeaveRequestsColumns.end_date),
        business_days: parseFloat(row.get(LeaveRequestsColumns.business_days) || 0),
        leave_type: row.get(LeaveRequestsColumns.leave_type),
        status: row.get(LeaveRequestsColumns.status),
        created_at: row.get(LeaveRequestsColumns.created_at),
        updated_at: row.get(LeaveRequestsColumns.updated_at),
        hr_comment: row.get(LeaveRequestsColumns.hr_comment)
      }))
      // Sort by creation date descending
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return NextResponse.json({
      success: true,
      count: userRequests.length,
      requests: userRequests
    });

  } catch (error) {
    console.error('Error fetching user requests:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching requests.' },
      { status: 500 }
    );
  }
}
