import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncEmployeeBalance } from '../../../../lib/sheetsSync';

export async function POST(req) {
  // 1. Authenticate user as 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { email, name, firstName, role, manager_name, initial_balance, initial_perm, password, service, hire_date } = body;

    // Validation
    if (!email || !name || !firstName || !password) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : email, name, firstName, password.' },
        { status: 400 }
      );
    }

    if (password.trim().length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Check if email already exists in leave_balances
    const { data: existingMember, error: checkErr } = await supabase
      .from('leave_balances')
      .select('employee_id')
      .eq('employee_email', normalizedEmail)
      .maybeSingle();

    if (checkErr) {
      throw checkErr;
    }

    if (existingMember) {
      return NextResponse.json(
        { error: `Un membre avec l'e-mail "${email}" existe déjà dans le système.` },
        { status: 400 }
      );
    }

    // 3. Register user in Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: `${firstName} ${name}`,
          role: role || 'employee'
        }
      }
    });

    if (signUpError) {
      console.error('Supabase signup error:', signUpError);
      return NextResponse.json(
        { error: `Erreur d'enregistrement dans Supabase Auth : ${signUpError.message}` },
        { status: 400 }
      );
    }

    const employeeId = signUpData.user?.id;
    if (!employeeId) {
      return NextResponse.json(
        { error: "Impossible d'obtenir l'ID de l'utilisateur créé dans Supabase." },
        { status: 500 }
      );
    }

    const initialCP = parseFloat(initial_balance || 0);
    const initialPermissions = parseFloat(initial_perm || 0);
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // 4. Create row in leave_balances table in Supabase
    const { error: insertErr } = await supabase
      .from('leave_balances')
      .insert({
        employee_id: employeeId,
        employee_name: name,
        employee_first_name: firstName,
        employee_email: normalizedEmail,
        role: role || 'employee',
        initial_balance: initialCP,
        taken_days: 0,
        remaining_balance: initialCP,
        initial_perm: initialPermissions,
        taken_perm: 0,
        remaining_perm: initialPermissions,
        manager_name: manager_name || 'Aucun',
        service: service || 'Non spécifié',
        hire_date: hire_date || null,
        last_anniversary_credited: null,
        last_monthly_credit: currentMonthStr
      });

    if (insertErr) {
      // Clean up Auth user if DB insert fails
      await supabase.auth.admin.deleteUser(employeeId);
      throw insertErr;
    }

    // 5. Sync to Google Sheets (awaited for reliability)
    try {
      await syncEmployeeBalance(employeeId);
    } catch (syncErr) {
      console.error('[CreateMember] Sync to Google Sheets failed:', syncErr);
    }

    return NextResponse.json({
      message: 'Nouveau membre créé avec succès.',
      member: {
        employee_id: employeeId,
        employee_name: name,
        employee_first_name: firstName,
        employee_email: normalizedEmail,
        role: role || 'employee',
        manager_name: manager_name || 'Aucun',
        initial_balance: initialCP,
        initial_perm: initialPermissions,
        service: service || 'Non spécifié',
        hire_date: hire_date || ''
      }
    });

  } catch (error) {
    console.error('Error creating new member:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la création du nouveau membre.' },
      { status: 500 }
    );
  }
}
