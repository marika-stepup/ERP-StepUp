import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { splitFullName } from '../../../../lib/utils';

export async function GET(req) {
  // 1. Authenticate user (all authenticated roles can fetch member balances for the global dashboard)
  const auth = await verifyRole(req, ['employee', 'manager', 'director', 'hr']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 2. Fetch the leave balances from Supabase
    const { data: balances, error: dbError } = await supabase
      .from('leave_balances')
      .select('*')
      .order('employee_name', { ascending: true });

    if (dbError) {
      throw dbError;
    }

    // Filter out potential config rows (usually not present in Supabase)
    const employeeBalances = (balances || []).filter(member => {
      const id = member.employee_id;
      return id && !id.startsWith('SYSTEM_');
    });

    // 3. Map to JSON response
    const members = employeeBalances.map((row) => {
      let name = row.employee_name || '';
      let firstName = row.employee_first_name || '';

      if (!firstName && name) {
        const split = splitFullName(name);
        firstName = split.firstName;
        name = split.lastName || name;
      }

      return {
        employee_id: row.employee_id,
        employee_name: name,
        employee_first_name: firstName,
        employee_email: row.employee_email,
        role: row.role || 'employee',
        initial_balance: Number(row.initial_balance || 0),
        taken_days: Number(row.taken_days || 0),
        remaining_balance: Number(row.remaining_balance || 0),
        initial_perm: Number(row.initial_perm || 0),
        taken_perm: Number(row.taken_perm || 0),
        remaining_perm: Number(row.remaining_perm || 0),
        manager_name: row.manager_name || 'Aucun',
        service: row.service || 'Non spécifié',
        hire_date: row.hire_date || ''
      };
    });

    return NextResponse.json({
      success: true,
      count: members.length,
      members
    });

  } catch (error) {
    console.error('Error fetching members list from Supabase:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération de la liste des membres.' },
      { status: 500 }
    );
  }
}
