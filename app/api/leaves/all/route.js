import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';

export async function GET(req) {
  // 1. Authenticate user
  const auth = await verifyRole(req, ['employee', 'hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const supabase = getSupabaseAdmin();
  const isPrivileged = ['hr', 'manager', 'director'].includes(auth.user.role);

  // Check if caller is Pointeur (Pointers have no legitimate purpose to access full leave history)
  if (auth.user.role === 'employee') {
    const { data: userProfile } = await supabase
      .from('leave_balances')
      .select('service')
      .eq('employee_id', auth.user.id)
      .maybeSingle();

    if (userProfile?.service === 'Pointeur') {
      return NextResponse.json({ error: 'Accès interdit pour le service Pointeur (principe de minimisation RGPD).' }, { status: 403 });
    }
  }

  try {
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

    // 3. Data minimization: only expose hr_comment to HR/Managers/Directors or the requester themselves
    const requests = (dbRequests || []).map((reqItem) => {
      const isOwner = reqItem.employee_id === auth.user.id;
      const canSeeComments = isPrivileged || isOwner;

      return {
        request_id: reqItem.request_id,
        employee_id: reqItem.employee_id,
        employee_name: reqItem.employee_name,
        start_date: reqItem.start_date,
        end_date: reqItem.end_date,
        business_days: Number(reqItem.business_days || 0),
        leave_type: reqItem.leave_type,
        status: reqItem.status,
        created_at: reqItem.created_at,
        updated_at: reqItem.updated_at,
        hr_comment: canSeeComments ? (reqItem.hr_comment || '') : '',
        service: reqItem.leave_balances?.service || 'Non spécifié'
      };
    });

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
