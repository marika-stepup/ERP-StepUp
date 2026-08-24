import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncProductionTask } from '../../../../lib/productionSheetsSync';

async function checkDirectionService(authResult) {
  if (authResult.error) return { error: authResult.error };
  
  const supabase = getSupabaseAdmin();
  const { data: memberProfile, error } = await supabase
    .from('leave_balances')
    .select('service')
    .eq('employee_id', authResult.user.id)
    .maybeSingle();

  if (error || !memberProfile || (memberProfile.service !== 'Direction' && memberProfile.service !== 'Directeur')) {
    return { error: { status: 403, message: 'Accès interdit. Réservé au service Direction.' } };
  }
  
  return { user: authResult.user, profile: memberProfile };
}

export async function POST(req) {
  const auth = await verifyRole(req, ['hr', 'manager', 'director', 'employee']);
  const serviceCheck = await checkDirectionService(auth);
  if (serviceCheck.error) {
    return NextResponse.json({ error: serviceCheck.error.message }, { status: serviceCheck.error.status });
  }

  try {
    const body = await req.json();
    const { client_id, category, name, budget_hours, due_date } = body;

    if (!client_id || !category || !name) {
      return NextResponse.json({ error: 'Champs requis manquants (client_id, category, name).' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: newTask, error } = await supabase
      .from('production_tasks')
      .insert({
        client_id,
        category,
        name,
        budget_hours: Number(budget_hours) || 0,
        due_date: due_date || null,
        status: 'Non démarré'
      })
      .select()
      .single();

    if (error) throw error;

    // Async sync to Google Sheets
    syncProductionTask(newTask.id);

    return NextResponse.json({ task: newTask }, { status: 201 });
  } catch (error) {
    console.error('Error creating production task:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la création de la tâche.' },
      { status: 500 }
    );
  }
}
