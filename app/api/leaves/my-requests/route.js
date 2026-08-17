import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';

export async function GET(req) {
  // 1. Authenticate user
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const user = auth.user;

  try {
    const supabase = getSupabaseAdmin();

    // 2. Fetch requests from Supabase
    const { data: dbRequests, error: dbError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false });

    if (dbError) {
      throw dbError;
    }

    const requests = (dbRequests || []).map((req) => ({
      request_id: req.request_id,
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
    console.error('Error fetching user requests from Supabase:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération des demandes.' },
      { status: 500 }
    );
  }
}
