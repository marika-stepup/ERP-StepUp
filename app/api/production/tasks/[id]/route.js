import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../../lib/supabaseAuth';
import { syncProductionTask, deleteProductionTaskFromSheets } from '../../../../../lib/productionSheetsSync';

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

export async function PATCH(req, { params }) {
  const auth = await verifyRole(req, ['hr', 'manager', 'director', 'employee']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const { id } = params;

  try {
    const body = await req.json();
    const { category, name, budget_hours, status, due_date, assigned_to, assigned_to_name, is_recurring, recurring_frequency } = body;

    const supabase = getSupabaseAdmin();

    const updates = {};
    if (category !== undefined) updates.category = category;
    if (name !== undefined) updates.name = name;
    if (budget_hours !== undefined) updates.budget_hours = Number(budget_hours) || 0;
    if (status !== undefined) updates.status = status;
    if (due_date !== undefined) updates.due_date = due_date || null;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
    if (assigned_to_name !== undefined) updates.assigned_to_name = assigned_to_name || null;
    if (is_recurring !== undefined) updates.is_recurring = !!is_recurring;
    if (recurring_frequency !== undefined) updates.recurring_frequency = recurring_frequency || 'monthly';

    const { data: updatedTask, error } = await supabase
      .from('production_tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Async sync to Google Sheets
    syncProductionTask(updatedTask.id);

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error updating production task:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la mise à jour de la tâche.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  const auth = await verifyRole(req, ['hr', 'manager', 'director', 'employee']);
  const serviceCheck = await checkDirectionService(auth);
  if (serviceCheck.error) {
    return NextResponse.json({ error: serviceCheck.error.message }, { status: serviceCheck.error.status });
  }

  const { id } = params;

  try {
    const supabase = getSupabaseAdmin();

    // Fetch the task client_id before deleting
    const { data: task } = await supabase
      .from('production_tasks')
      .select('client_id')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('production_tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Async delete from Google Sheets and update client totals
    if (task) {
      deleteProductionTaskFromSheets(id, task.client_id);
    } else {
      deleteProductionTaskFromSheets(id);
    }

    return NextResponse.json({ message: 'Tâche supprimée avec succès.' });
  } catch (error) {
    console.error('Error deleting production task:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la suppression de la tâche.' },
      { status: 500 }
    );
  }
}
