import { NextResponse } from 'next/server';
import { 
  syncEmployeeBalance, 
  syncLeaveRequest, 
  deleteEmployeeBalanceFromSheets, 
  deleteLeaveRequestFromSheets 
} from '../../../../lib/sheetsSync';

export async function POST(req) {
  // 1. Security Check for Webhook Secret (optional but highly recommended)
  const webhookSecret = process.env.WEBHOOK_SECRET;
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get('secret');
  const headerSecret = req.headers.get('x-webhook-secret');

  if (webhookSecret && querySecret !== webhookSecret && headerSecret !== webhookSecret) {
    console.warn('[Webhook] Unauthorized access attempt to sync-sheets.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const { type, table, record, old_record } = payload;

    console.log(`[Webhook] Received database event: ${type} on ${table}`);

    if (table === 'leave_balances') {
      const employeeId = type === 'DELETE' ? old_record?.employee_id : record?.employee_id;
      if (!employeeId) {
        return NextResponse.json({ error: 'Missing employee_id in payload' }, { status: 400 });
      }

      if (type === 'DELETE') {
        await deleteEmployeeBalanceFromSheets(employeeId);
      } else {
        await syncEmployeeBalance(employeeId);
      }

    } else if (table === 'leave_requests') {
      const requestId = type === 'DELETE' ? old_record?.request_id : record?.request_id;
      if (!requestId) {
        return NextResponse.json({ error: 'Missing request_id in payload' }, { status: 400 });
      }

      if (type === 'DELETE') {
        await deleteLeaveRequestFromSheets(requestId);
      } else {
        await syncLeaveRequest(requestId);
      }
    } else {
      console.warn(`[Webhook] Event ignored. Unsupported table: ${table}`);
    }

    return NextResponse.json({ success: true, message: 'Sync operation scheduled' });

  } catch (error) {
    console.error('[Webhook] Sync failed:', error);
    return NextResponse.json(
      { error: 'Internal server error during database sync webhook.' },
      { status: 500 }
    );
  }
}
