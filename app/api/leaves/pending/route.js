import { NextResponse } from 'next/server';
import { verifyRole } from '../../../../lib/supabaseAuth';
import { getSheet } from '../../../../lib/googleSheets';

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
      .filter((row) => row.get('status') === 'Pending')
      .map((row) => ({
        request_id: row.get('request_id'),
        employee_id: row.get('employee_id'),
        employee_name: row.get('employee_name'),
        start_date: row.get('start_date'),
        end_date: row.get('end_date'),
        business_days: parseFloat(row.get('business_days') || 0),
        leave_type: row.get('leave_type'),
        status: row.get('status'),
        created_at: row.get('created_at'),
        updated_at: row.get('updated_at'),
        hr_comment: row.get('hr_comment')
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
