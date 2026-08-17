import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncTimeLog } from '../../../../lib/sheetsSync';

export async function POST(req) {
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
    const body = await req.json();
    const { employee_id, date, clock_in_time } = body;

    if (!employee_id || !date) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : employee_id, date.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 2. Fetch employee profile and name
    const { data: member, error: memberErr } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employee_id)
      .single();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: 'Collaborateur introuvable.' },
        { status: 404 }
      );
    }

    // 3. Determine scheduled clock-in for the day
    // Day of week code (Sun, Mon, Tue, etc.)
    const dateObj = new Date(date);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = days[dateObj.getDay()];

    const schedule = member.work_schedule || {};
    const defaultSchedule = schedule.default || { arrival: '08:00', departure: '17:00' };
    const daySchedule = schedule[dayOfWeek] || defaultSchedule;
    
    const scheduledClockIn = daySchedule.arrival || '08:00';
    const scheduledClockOut = daySchedule.departure || '17:00';

    // 4. Calculate actual clock-in time and status (late vs present)
    let finalClockIn = clock_in_time;
    if (!finalClockIn) {
      const d = new Date();
      finalClockIn = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // Compare times: e.g. "08:15" vs "08:00"
    const [inH, inM] = finalClockIn.split(':').map(Number);
    const [schedH, schedM] = scheduledClockIn.split(':').map(Number);
    
    let status = 'Présent';
    if ((inH * 60 + inM) > (schedH * 60 + schedM)) {
      status = 'En retard';
    }

    // 5. Upsert pointage row in Supabase
    const { data: upsertData, error: upsertErr } = await supabase
      .from('time_logs')
      .upsert({
        employee_id,
        employee_name: `${member.employee_first_name} ${member.employee_name}`,
        date,
        clock_in: finalClockIn,
        scheduled_clock_in: scheduledClockIn,
        scheduled_clock_out: scheduledClockOut,
        status,
        updated_at: new Date().toISOString()
      }, { onConflict: 'employee_id,date' })
      .select()
      .single();

    if (upsertErr) throw upsertErr;

    // 6. Trigger Google Sheets sync in background
    syncTimeLog(employee_id, date).catch(syncErr => {
      console.error('[ClockIn] Background Sheet sync error:', syncErr);
    });

    return NextResponse.json({
      message: 'Pointage arrivée enregistré avec succès.',
      log: upsertData
    });

  } catch (error) {
    console.error('Error clocking in:', error);
    return NextResponse.json(
      { error: "Erreur interne du serveur lors de l'enregistrement de l'arrivée." },
      { status: 500 }
    );
  }
}
