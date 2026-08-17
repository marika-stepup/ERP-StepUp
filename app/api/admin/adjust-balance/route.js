import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncEmployeeBalance } from '../../../../lib/sheetsSync';
import { splitFullName } from '../../../../lib/utils';

export async function POST(req) {
  // 1. Authenticate user as 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await req.json();
    const { employee_id, type, value } = body;

    // Validation
    if (!employee_id || !type || value === undefined) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : employee_id, type, value.' },
        { status: 400 }
      );
    }

    const normalizedType = type.toLowerCase();
    if (normalizedType !== 'cp' && normalizedType !== 'perm') {
      return NextResponse.json(
        { error: "Type invalide. Utilisez 'cp' ou 'perm'." },
        { status: 400 }
      );
    }

    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || numericValue < 0) {
      return NextResponse.json(
        { error: 'La valeur doit être un nombre positif valide.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 2. Fetch target member from Supabase (by ID or email)
    const { data: member, error: fetchErr } = await supabase
      .from('leave_balances')
      .select('*')
      .or(`employee_id.eq.${employee_id},employee_email.eq.${employee_id.toLowerCase().trim()}`)
      .maybeSingle();

    if (fetchErr) {
      throw fetchErr;
    }

    if (!member) {
      return NextResponse.json(
        { error: `Membre avec l'identifiant ou l'e-mail "${employee_id}" introuvable.` },
        { status: 404 }
      );
    }

    const targetEmpId = member.employee_id;
    let name = member.employee_name || '';
    let firstName = member.employee_first_name || '';

    if (!firstName && name) {
      const split = splitFullName(name);
      firstName = split.firstName;
      name = split.lastName || name;
    }

    let resultData = {};

    if (normalizedType === 'cp') {
      const currentTaken = Number(member.taken_days || 0);
      const newRemaining = numericValue - currentTaken;

      const { error: updateErr } = await supabase
        .from('leave_balances')
        .update({
          initial_balance: numericValue,
          remaining_balance: newRemaining
        })
        .eq('employee_id', targetEmpId);

      if (updateErr) {
        throw updateErr;
      }

      resultData = {
        employee_id: targetEmpId,
        employee_name: name,
        employee_first_name: firstName,
        type: 'cp',
        initial_balance: numericValue,
        remaining_balance: newRemaining
      };
    } else {
      const currentTaken = Number(member.taken_perm || 0);
      const newRemaining = numericValue - currentTaken;

      const { error: updateErr } = await supabase
        .from('leave_balances')
        .update({
          initial_perm: numericValue,
          remaining_perm: newRemaining
        })
        .eq('employee_id', targetEmpId);

      if (updateErr) {
        throw updateErr;
      }

      resultData = {
        employee_id: targetEmpId,
        employee_name: name,
        employee_first_name: firstName,
        type: 'perm',
        initial_perm: numericValue,
        remaining_perm: newRemaining
      };
    }

    // 3. Sync update to Google Sheets (awaited for reliability)
    try {
      await syncEmployeeBalance(targetEmpId);
    } catch (syncErr) {
      console.error('[AdjustBalance] Sync to Google Sheets failed:', syncErr);
    }

    return NextResponse.json({
      message: 'Solde du membre ajusté avec succès.',
      balance: resultData
    });

  } catch (error) {
    console.error('Error adjusting balance:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de l\'ajustement du solde.' },
      { status: 500 }
    );
  }
}
