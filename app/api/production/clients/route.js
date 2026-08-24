import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncProductionClient } from '../../../../lib/productionSheetsSync';

// Helper to verify service "Direction"
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

export async function GET(req) {
  const auth = await verifyRole(req, ['hr', 'manager', 'director', 'employee']);
  const serviceCheck = await checkDirectionService(auth);
  if (serviceCheck.error) {
    return NextResponse.json({ error: serviceCheck.error.message }, { status: serviceCheck.error.status });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Fetch clients
    const { data: clients, error: clientsErr } = await supabase
      .from('production_clients')
      .select('*')
      .order('name', { ascending: true });

    if (clientsErr) throw clientsErr;

    // 2. Fetch tasks
    const { data: tasks, error: tasksErr } = await supabase
      .from('production_tasks')
      .select('*')
      .order('created_at', { ascending: true });

    if (tasksErr) throw tasksErr;

    // 3. Fetch time logs
    const { data: logs, error: logsErr } = await supabase
      .from('production_time_logs')
      .select('*');

    if (logsErr) throw logsErr;

    // Group logs by task_id and sum production duration
    const taskTimeMap = {};
    const taskLogTypesMap = {}; // to store different logs per task if needed
    logs.forEach(log => {
      if (!taskTimeMap[log.task_id]) {
        taskTimeMap[log.task_id] = 0;
      }
      if (log.log_type === 'production') {
        taskTimeMap[log.task_id] += log.duration_seconds;
      }
    });

    // Group tasks by client_id
    const clientTasksMap = {};
    tasks.forEach(task => {
      if (!clientTasksMap[task.client_id]) {
        clientTasksMap[task.client_id] = [];
      }
      const timeSpentSeconds = taskTimeMap[task.id] || 0;
      clientTasksMap[task.client_id].push({
        ...task,
        time_spent_seconds: timeSpentSeconds
      });
    });

    // Assemble client objects with progression
    const result = clients.map(client => {
      const clientTasks = clientTasksMap[client.id] || [];
      
      // Calculate total production time spent on all tasks of this client
      let totalSpentSeconds = 0;
      clientTasks.forEach(t => {
        totalSpentSeconds += t.time_spent_seconds;
      });

      const totalSpentHours = totalSpentSeconds / 3600;
      const budgetHours = Number(client.total_budget_hours) || 0;
      const progression = budgetHours > 0 ? Math.round((totalSpentHours / budgetHours) * 100) : 0;

      return {
        ...client,
        tasks: clientTasks,
        total_spent_seconds: totalSpentSeconds,
        total_spent_hours: Number(totalSpentHours.toFixed(2)),
        progression_percent: Math.min(progression, 100) // Caps at 100% or allow over-budget? Better to show real percentage
      };
    });

    return NextResponse.json({ clients: result });
  } catch (error) {
    console.error('Error fetching production clients:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération des clients de production.' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const auth = await verifyRole(req, ['hr', 'manager', 'director', 'employee']);
  const serviceCheck = await checkDirectionService(auth);
  if (serviceCheck.error) {
    return NextResponse.json({ error: serviceCheck.error.message }, { status: serviceCheck.error.status });
  }

  try {
    const body = await req.json();
    const { name, code, contract_period, total_budget_hours } = body;

    if (!name || !code || !contract_period) {
      return NextResponse.json({ error: 'Champs requis manquants (name, code, contract_period).' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: newClient, error } = await supabase
      .from('production_clients')
      .insert({
        name,
        code,
        contract_period,
        total_budget_hours: Number(total_budget_hours) || 0
      })
      .select()
      .single();

    if (error) throw error;

    // Async sync to Google Sheets (non-blocking)
    syncProductionClient(newClient.id);

    return NextResponse.json({ client: newClient }, { status: 201 });
  } catch (error) {
    console.error('Error creating production client:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la création du client.' },
      { status: 500 }
    );
  }
}
