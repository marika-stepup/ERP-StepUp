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
    const { employee_id, name, firstName, email, role, manager_name, initial_balance, initial_perm, service, hire_date } = body;

    // Validation
    if (!employee_id || !name || !firstName || !email) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : employee_id, name, firstName, email.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Fetch current member details
    const { data: member, error: fetchErr } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employee_id)
      .maybeSingle();

    if (fetchErr) {
      throw fetchErr;
    }

    if (!member) {
      return NextResponse.json(
        { error: `Membre avec l'identifiant "${employee_id}" introuvable.` },
        { status: 404 }
      );
    }

    // 3. Check if email conflicts with another user
    const { data: emailConflict, error: conflictErr } = await supabase
      .from('leave_balances')
      .select('employee_id')
      .eq('employee_email', normalizedEmail)
      .neq('employee_id', employee_id)
      .maybeSingle();

    if (conflictErr) {
      throw conflictErr;
    }

    if (emailConflict) {
      return NextResponse.json(
        { error: `Un autre membre avec l'e-mail "${email}" existe déjà.` },
        { status: 400 }
      );
    }

    const initialCP = parseFloat(initial_balance || 0);
    const initialPermissions = parseFloat(initial_perm || 0);

    const currentTakenCP = Number(member.taken_days || 0);
    const currentTakenPerm = Number(member.taken_perm || 0);

    const newRemainingCP = initialCP - currentTakenCP;
    const newRemainingPerm = initialPermissions - currentTakenPerm;

    // 4. Check if hire date changes to reset anniversary credited date
    let lastAnniversary = member.last_anniversary_credited;
    if (member.hire_date !== (hire_date || null)) {
      lastAnniversary = null;
    }

    // 5. Update member values in Supabase
    const { error: updateErr } = await supabase
      .from('leave_balances')
      .update({
        employee_name: name,
        employee_first_name: firstName,
        employee_email: normalizedEmail,
        role: role || 'employee',
        manager_name: manager_name || 'Aucun',
        service: service || 'Non spécifié',
        initial_balance: initialCP,
        remaining_balance: newRemainingCP,
        initial_perm: initialPermissions,
        remaining_perm: newRemainingPerm,
        hire_date: hire_date || null,
        last_anniversary_credited: lastAnniversary
      })
      .eq('employee_id', employee_id);

    if (updateErr) {
      throw updateErr;
    }

    // Update role in Supabase Auth user metadata as well
    const { error: authUpdateErr } = await supabase.auth.admin.updateUserById(employee_id, {
      user_metadata: {
        full_name: `${firstName} ${name}`,
        role: role || 'employee'
      }
    });

    if (authUpdateErr) {
      console.warn('[UpdateMember] Failed to update Supabase Auth metadata:', authUpdateErr.message);
    }

    // 6. Sync changes to Google Sheets (awaited for reliability)
    try {
      await syncEmployeeBalance(employee_id);
    } catch (syncErr) {
      console.error('[UpdateMember] Sync to Google Sheets failed:', syncErr);
    }

    return NextResponse.json({
      message: 'Membre mis à jour avec succès.',
      member: {
        employee_id,
        employee_name: name,
        employee_first_name: firstName,
        employee_email: normalizedEmail,
        role: role || 'employee',
        manager_name: manager_name || 'Aucun',
        initial_balance: initialCP,
        remaining_balance: newRemainingCP,
        initial_perm: initialPermissions,
        remaining_perm: newRemainingPerm,
        service: service || 'Non spécifié',
        hire_date: hire_date || ''
      }
    });

  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la mise à jour du membre.' },
      { status: 500 }
    );
  }
}
