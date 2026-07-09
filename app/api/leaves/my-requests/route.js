import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet } from '../../../../lib/googleSheets';

export async function GET(req) {
  // 1. Authenticate user
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const user = auth.user;

  try {
    // 2. Fetch Leave_Requests
    const requestsSheet = await getSheet('Leave_Requests');
    const rows = await requestsSheet.getRows();

    // 3. Filter by employee_id
    const userRequests = rows
      .filter((row) => row.get('employee_id') === user.id)
      .map((row) => ({
        request_id: row.get('request_id'),
        start_date: row.get('start_date'),
        end_date: row.get('end_date'),
        business_days: parseFloat(row.get('business_days') || 0),
        leave_type: row.get('leave_type'),
        status: row.get('status'),
        created_at: row.get('created_at'),
        updated_at: row.get('updated_at'),
        hr_comment: row.get('hr_comment')
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
