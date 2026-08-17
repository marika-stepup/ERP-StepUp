import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';

export async function GET(req) {
  // 1. Authenticate and verify role 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 2. Fetch pending requests from Supabase
    const { data: pendingRequests, error: dbError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'En attente')
      .order('created_at', { ascending: false });

    if (dbError) {
      throw dbError;
    }

    const requests = (pendingRequests || []).map((req) => ({
      request_id: req.request_id,
      employee_id: req.employee_id,
      employee_name: req.employee_name,
      start_date: req.start_date,
      end_date: req.end_date,
      business_days: Number(req.business_days || 0),
      leave_type: req.leave_type,
      status: req.status,
      created_at: req.created_at,
      updated_at: req.updated_at,
      hr_comment: req.hr_comment || ''
    }));

    return NextResponse.json({
      success: true,
      count: requests.length,
      requests
    });

  } catch (error) {
    console.error('Error fetching pending leave requests from Supabase:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération des demandes en attente.' },
      { status: 500 }
    );
  }
}
