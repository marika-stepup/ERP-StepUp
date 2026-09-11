import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncProductionTask, deleteProductionTaskFromSheets } from '../../../../lib/productionSheetsSync';

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
    const { 
      client_id, 
      category, 
      name, 
      budget_hours, 
      due_date,
      assigned_to,
      assigned_to_name,
      is_recurring,
      recurring_frequency
    } = body;

    if (!client_id || !category || !name) {
      return NextResponse.json({ error: 'Champs requis manquants (client_id, category, name).' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const insertPayload = {
      client_id,
      category,
      name,
      budget_hours: Number(budget_hours) || 0,
      due_date: due_date || null,
      status: 'Non démarré'
    };

    if (assigned_to !== undefined && assigned_to !== '') {
      insertPayload.assigned_to = assigned_to;
    }
    if (assigned_to_name !== undefined && assigned_to_name !== '') {
      insertPayload.assigned_to_name = assigned_to_name;
    }
    if (is_recurring !== undefined) {
      insertPayload.is_recurring = !!is_recurring;
      insertPayload.recurring_frequency = recurring_frequency || 'monthly';
    }

    let newTask;
    let insertErr;

    const { data: resData, error: err1 } = await supabase
      .from('production_tasks')
      .insert(insertPayload)
      .select()
      .single();

    if (err1) {
      // Fallback in case columns are not yet present in database
      const { data: fallbackData, error: err2 } = await supabase
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
      
      if (err2) throw err2;
      newTask = fallbackData;
    } else {
      newTask = resData;
    }

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

export async function DELETE(req) {
  const auth = await verifyRole(req, ['hr', 'manager', 'director', 'employee']);
  const serviceCheck = await checkDirectionService(auth);
  if (serviceCheck.error) {
    return NextResponse.json({ error: serviceCheck.error.message }, { status: serviceCheck.error.status });
  }

  try {
    const body = await req.json();
    const { taskIds } = body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: 'taskIds (tableau non vide) requis.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch task client IDs to sync deletion with Google Sheets
    const { data: tasks } = await supabase
      .from('production_tasks')
      .select('id, client_id')
      .in('id', taskIds);

    // 2. Delete the tasks from Supabase
    const { error } = await supabase
      .from('production_tasks')
      .delete()
      .in('id', taskIds);

    if (error) throw error;

    // 3. Delete from Google Sheets
    if (tasks && tasks.length > 0) {
      tasks.forEach(t => {
        deleteProductionTaskFromSheets(t.id, t.client_id);
      });
    }

    return NextResponse.json({ success: true, count: taskIds.length });
  } catch (error) {
    console.error('Error batch deleting production tasks:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la suppression groupée.' },
      { status: 500 }
    );
  }
}
