import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncTimeLog } from '../../../../lib/sheetsSync';

export async function POST(req) {
  // 1. Authenticate user as 'hr', 'manager', 'director' or 'employee' with 'Logistique' service
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
    const serviceName = (memberProfile?.service || '').toLowerCase().trim();
    if (!memberProfile || (serviceName !== 'logistique' && serviceName !== 'pointeur')) {
      return NextResponse.json({ error: 'Accès interdit. Service Logistique requis.' }, { status: 403 });
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

    // 5. Check if record already exists for today to support multiple in/out sessions
    const { data: existingLog } = await supabase
      .from('time_logs')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('date', date)
      .maybeSingle();

    let updatedEntries = [];
    let initialClockIn = finalClockIn;
    let finalStatus = status;

    if (existingLog) {
      initialClockIn = existingLog.clock_in || finalClockIn;
      finalStatus = existingLog.status || status;
      if (Array.isArray(existingLog.entries) && existingLog.entries.length > 0) {
        updatedEntries = [...existingLog.entries];
      } else if (existingLog.clock_in) {
        updatedEntries = [{ in: existingLog.clock_in, out: existingLog.clock_out || null }];
      }
      updatedEntries.push({ in: finalClockIn, out: null });
    } else {
      updatedEntries = [{ in: finalClockIn, out: null }];
    }

    const payloadWithEntries = {
      employee_id,
      employee_name: `${member.employee_first_name} ${member.employee_name}`,
      date,
      clock_in: initialClockIn,
      clock_out: null,
      entries: updatedEntries,
      scheduled_clock_in: scheduledClockIn,
      scheduled_clock_out: scheduledClockOut,
      status: finalStatus,
      updated_at: new Date().toISOString()
    };

    let upsertData = null;
    let { data, error: upsertErr } = await supabase
      .from('time_logs')
      .upsert(payloadWithEntries, { onConflict: 'employee_id,date' })
      .select()
      .single();

    if (upsertErr) {
      // Fallback if entries column does not exist yet in DB schema
      const { entries: _discard, ...payloadWithoutEntries } = payloadWithEntries;
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('time_logs')
        .upsert(payloadWithoutEntries, { onConflict: 'employee_id,date' })
        .select()
        .single();

      if (fallbackErr) throw fallbackErr;
      upsertData = { ...fallbackData, entries: updatedEntries };
    } else {
      upsertData = data;
    }

    // 6. Trigger Google Sheets sync in background
    syncTimeLog(employee_id, date).catch(syncErr => {
      console.error('[ClockIn] Background Sheet sync error:', syncErr);
    });

    return NextResponse.json({
      message: 'Pointage entrée enregistré avec succès.',
      log: upsertData
    });

  } catch (error) {
    console.error('Error clocking in:', error);
    return NextResponse.json(
      { error: "Erreur interne du serveur lors de l'enregistrement de l'entrée." },
      { status: 500 }
    );
  }
}
