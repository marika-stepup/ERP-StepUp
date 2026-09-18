import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { splitFullName } from '../../../../lib/utils';
import { checkAndCreditAnniversaries } from '../../../../lib/anniversaryService';

export async function GET(req) {
  // 1. Authenticate user
  const auth = await verifyRole(req, ['employee', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }
  const user = auth.user;

  try {
    // 2. Automatically check and credit contract anniversary if due
    await checkAndCreditAnniversaries(user.id);

    const supabase = getSupabaseAdmin();

    // 3. Fetch the updated leave balance from Supabase
    const { data: balance, error: dbError } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', user.id)
      .maybeSingle();

    if (dbError) {
      throw dbError;
    }

    // 3. Fallback if not initialized in database
    if (!balance) {
      const splitUser = splitFullName(user.name || 'Utilisateur');
      return NextResponse.json({
        employee_id: user.id,
        employee_name: splitUser.lastName || 'Utilisateur',
        employee_first_name: splitUser.firstName || 'Utilisateur',
        employee_email: user.email,
        initial_balance: 25.0,
        taken_days: 0.0,
        remaining_balance: 25.0,
        initial_perm: 5.0,
        taken_perm: 0.0,
        remaining_perm: 5.0,
        hire_date: '',
        warning: 'Ligne de solde initial non encore initialisée dans la base de données Supabase.'
      });
    }

    return NextResponse.json({
      employee_id: balance.employee_id,
      employee_name: balance.employee_name,
      employee_first_name: balance.employee_first_name,
      employee_email: balance.employee_email,
      initial_balance: Number(balance.initial_balance || 0),
      taken_days: Number(balance.taken_days || 0),
      remaining_balance: Number(balance.remaining_balance || 0),
      initial_perm: Number(balance.initial_perm || 0),
      taken_perm: Number(balance.taken_perm || 0),
      remaining_perm: Number(balance.remaining_perm || 0),
      hire_date: balance.hire_date || '',
      service: balance.service || 'Non spécifié'
    });

  } catch (error) {
    console.error('Error fetching balance from Supabase:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération du solde.' },
      { status: 500 }
    );
  }
}
