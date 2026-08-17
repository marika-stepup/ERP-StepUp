import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../lib/supabaseAuth';

export async function GET(req) {
  // 1. Authenticate user as 'hr', 'manager', 'director' or 'employee' with 'Pointeur' service
  const auth = await verifyRole(req, ['hr', 'manager', 'director', 'employee']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  const supabase = getSupabaseAdmin();
  if (auth.user.role === 'employee') {
    const { data: memberProfile } = await supabase
      .from('leave_balances')
      .select('service')
      .eq('employee_id', auth.user.id)
      .single();
    if (!memberProfile || memberProfile.service !== 'Pointeur') {
      return NextResponse.json({ error: 'Accès interdit. Service Pointeur requis.' }, { status: 403 });
    }
  }

  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date'); // YYYY-MM-DD
    
    // Default to today in UTC+3 (local time for Madagascar)
    let targetDate = dateStr;
    if (!targetDate) {
      const d = new Date();
      // Adjust to UTC+3
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const localTime = new Date(utc + (3600000 * 3));
      targetDate = `${localTime.getFullYear()}-${String(localTime.getMonth() + 1).padStart(2, '0')}-${String(localTime.getDate()).padStart(2, '0')}`;
    }

    const supabase = getSupabaseAdmin();

    // 2. Fetch all active employees
    const { data: members, error: membersErr } = await supabase
      .from('leave_balances')
      .select('*')
      .order('employee_name', { ascending: true });

    if (membersErr) throw membersErr;

    // 3. Fetch time logs for the target date
    const { data: logs, error: logsErr } = await supabase
      .from('time_logs')
      .select('*')
      .eq('date', targetDate);

    if (logsErr) throw logsErr;

    // Map logs to members
    const logsMap = {};
    if (logs) {
      logs.forEach(log => {
        logsMap[log.employee_id] = log;
      });
    }

    const result = members.map(member => {
      const log = logsMap[member.employee_id] || null;
      return {
        employee_id: member.employee_id,
        employee_name: member.employee_name,
        employee_first_name: member.employee_first_name,
        employee_email: member.employee_email,
        service: member.service,
        role: member.role,
        work_schedule: member.work_schedule || null,
        time_log: log
      };
    });

    return NextResponse.json({
      date: targetDate,
      employees: result
    });

  } catch (error) {
    console.error('Error fetching time logs:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la récupération des pointages.' },
      { status: 500 }
    );
  }
}
