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
    const { mutations } = body;

    if (!mutations || !Array.isArray(mutations) || mutations.length === 0) {
      return NextResponse.json(
        { error: 'Aucune mutation fournie.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const updatedMembers = [];

    for (const mutation of mutations) {
      const { type, employeeId, field, value } = mutation;

      if (type !== 'adjust-balance') {
        continue;
      }

      const normalizedField = field.toLowerCase();
      if (normalizedField !== 'cp' && normalizedField !== 'perm') {
        continue;
      }

      const numericValue = parseFloat(value);
      if (isNaN(numericValue) || numericValue < 0) {
        continue;
      }

      // Fetch member
      const { data: member, error: fetchErr } = await supabase
        .from('leave_balances')
        .select('*')
        .or(`employee_id.eq.${employeeId},employee_email.eq.${employeeId.toLowerCase().trim()}`)
        .maybeSingle();

      if (fetchErr || !member) {
        console.warn(`[BatchUpdate] Member ${employeeId} not found in Supabase.`);
        continue;
      }

      const targetEmpId = member.employee_id;

      if (normalizedField === 'cp') {
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
          console.error(`[BatchUpdate] Failed to update CP for ${targetEmpId}:`, updateErr.message);
          continue;
        }

        updatedMembers.push({
          employee_id: targetEmpId,
          employee_name: member.employee_name,
          employee_first_name: member.employee_first_name,
          type: 'cp',
          initial_balance: numericValue,
          remaining_balance: newRemaining
        });

      } else if (normalizedField === 'perm') {
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
          console.error(`[BatchUpdate] Failed to update Perm for ${targetEmpId}:`, updateErr.message);
          continue;
        }

        updatedMembers.push({
          employee_id: targetEmpId,
          employee_name: member.employee_name,
          employee_first_name: member.employee_first_name,
          type: 'perm',
          initial_perm: numericValue,
          remaining_perm: newRemaining
        });
      }

      // Sync this employee's balance to Sheets (awaited for sequence safety)
      try {
        await syncEmployeeBalance(targetEmpId);
      } catch (syncErr) {
        console.error(`[BatchUpdate] Sheets sync failed for ${targetEmpId}:`, syncErr);
      }
    }

    return NextResponse.json({
      message: 'Mises à jour appliquées en lot avec succès.',
      updatedMembers
    });

  } catch (error) {
    console.error('Error in batch-update route:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la mise à jour en lot.' },
      { status: 500 }
    );
  }
}
