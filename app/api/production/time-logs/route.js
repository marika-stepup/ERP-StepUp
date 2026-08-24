import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncProductionTimeLog } from '../../../../lib/productionSheetsSync';

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

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'clientId est requis.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Fetch time logs joined with their tasks to make sure they belong to the client
    const { data: logs, error: logsErr } = await supabase
      .from('production_time_logs')
      .select(`
        id,
        task_id,
        employee_id,
        employee_name,
        duration_seconds,
        log_type,
        logged_at,
        created_at,
        production_tasks!inner(id, client_id, name, category)
      `)
      .eq('production_tasks.client_id', clientId)
      .order('logged_at', { ascending: false });

    if (logsErr) throw logsErr;

    // Map logs to flatten the task info
    const result = logs.map(log => ({
      id: log.id,
      task_id: log.task_id,
      task_name: log.production_tasks.name,
      task_category: log.production_tasks.category,
      employee_id: log.employee_id,
      employee_name: log.employee_name,
      duration_seconds: log.duration_seconds,
      log_type: log.log_type,
      logged_at: log.logged_at,
      created_at: log.created_at
    }));

    return NextResponse.json({ logs: result });
  } catch (error) {
    console.error('Error fetching production time logs:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération des temps passés.' },
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
    const { task_id, employee_id, employee_name, duration_seconds, log_type, logged_at } = body;

    if (!task_id || !employee_id || !employee_name || duration_seconds === undefined) {
      return NextResponse.json({ error: 'Champs requis manquants (task_id, employee_id, employee_name, duration_seconds).' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const insertData = {
      task_id,
      employee_id,
      employee_name,
      duration_seconds: Number(duration_seconds) || 0,
      log_type: log_type || 'production'
    };

    if (logged_at) {
      insertData.logged_at = logged_at;
    }

    const { data: newLog, error } = await supabase
      .from('production_time_logs')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Async sync to Google Sheets
    syncProductionTimeLog(newLog.id);

    // If task was 'Non démarré' and log_type is 'production', update status to 'En cours'
    if (log_type === 'production') {
      const { data: taskData } = await supabase
        .from('production_tasks')
        .select('status')
        .eq('id', task_id)
        .single();
      
      if (taskData && taskData.status === 'Non démarré') {
        await supabase
          .from('production_tasks')
          .update({ status: 'En cours' })
          .eq('id', task_id);
      }
    }

    return NextResponse.json({ log: newLog }, { status: 201 });
  } catch (error) {
    console.error('Error creating production time log:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la création du log de temps.' },
      { status: 500 }
    );
  }
}
