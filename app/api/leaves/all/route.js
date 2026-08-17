import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';

export async function GET(req) {
  // 1. Authenticate user (all authenticated roles can fetch this for the global calendar)
  const auth = await verifyRole(req, ['employee', 'hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 2. Fetch all leave requests joined with employee service
    const { data: dbRequests, error: dbError } = await supabase
      .from('leave_requests')
      .select(`
        *,
        leave_balances (
          service
        )
      `)
      .order('created_at', { ascending: false });

    if (dbError) {
      throw dbError;
    }

    const requests = (dbRequests || []).map((req) => ({
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
      hr_comment: req.hr_comment || '',
      service: req.leave_balances?.service || 'Non spécifié'
    }));

    return NextResponse.json({
      success: true,
      count: requests.length,
      requests
    });

  } catch (error) {
    console.error('Error fetching all leave requests for calendar from Supabase:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération de tous les congés.' },
      { status: 500 }
    );
  }
}
