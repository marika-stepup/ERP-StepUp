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
    const { employee_id, date, clock_out_time } = body;

    if (!employee_id || !date) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : employee_id, date.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 2. Fetch existing time log for the date
    const { data: log, error: logErr } = await supabase
      .from('time_logs')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('date', date)
      .maybeSingle();

    if (logErr) throw logErr;

    if (!log || !log.clock_in) {
      return NextResponse.json(
        { error: "Impossible de pointer la sortie : aucun pointage d'entrée enregistré aujourd'hui pour ce collaborateur." },
        { status: 400 }
      );
    }

    // 3. Determine actual clock-out time
    let finalClockOut = clock_out_time;
    if (!finalClockOut) {
      const d = new Date();
      finalClockOut = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // 4. Update sessions (entries array)
    let updatedEntries = Array.isArray(log.entries) ? [...log.entries] : [];
    if (updatedEntries.length === 0) {
      updatedEntries = [{ in: log.clock_in, out: finalClockOut }];
    } else {
      let closed = false;
      for (let i = updatedEntries.length - 1; i >= 0; i--) {
        if (!updatedEntries[i].out) {
          updatedEntries[i].out = finalClockOut;
          closed = true;
          break;
        }
      }
      if (!closed) {
        updatedEntries.push({ in: log.clock_in, out: finalClockOut });
      }
    }

    // 5. Check if early departure and handle active break
    let newStatus = log.status || 'Présent';
    if (log.scheduled_clock_out) {
      const [outH, outM] = finalClockOut.split(':').map(Number);
      const [schedOutH, schedOutM] = log.scheduled_clock_out.split(':').map(Number);
      
      if ((outH * 60 + outM) < (schedOutH * 60 + schedOutM)) {
        // If they were already late, we can mark "Retard + Départ ant." or just "Départ anticipé"
        newStatus = log.status === 'En retard' ? 'Retard & Départ ant.' : 'Départ anticipé';
      }
    }

    // Auto-close active break if employee was currently on break
    let updatedBreaks = Array.isArray(log.breaks) ? [...log.breaks] : [];
    let updatedBreakDuration = log.break_duration;
    let updatedBreakEnd = log.break_end;

    if (log.is_on_break) {
      for (let i = updatedBreaks.length - 1; i >= 0; i--) {
        if (!updatedBreaks[i].end) {
          updatedBreaks[i].end = finalClockOut;
          break;
        }
      }
      updatedBreakEnd = finalClockOut;

      // Calculate total break minutes
      let totalMins = 0;
      for (const b of updatedBreaks) {
        if (b.start && b.end) {
          const [sH, sM] = b.start.split(':').map(Number);
          const [eH, eM] = b.end.split(':').map(Number);
          const diff = (eH * 60 + eM) - (sH * 60 + sM);
          if (diff > 0) totalMins += diff;
        }
      }
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      updatedBreakDuration = `${hrs}h ${mins.toString().padStart(2, '0')}m`;
    }

    // 6. Update pointage row in Supabase
    const updatePayload = {
      clock_out: finalClockOut,
      entries: updatedEntries,
      status: newStatus,
      is_on_break: false,
      break_end: updatedBreakEnd,
      break_duration: updatedBreakDuration,
      breaks: updatedBreaks,
      updated_at: new Date().toISOString()
    };

    let updatedData = null;
    let { data, error: updateErr } = await supabase
      .from('time_logs')
      .update(updatePayload)
      .eq('id', log.id)
      .select()
      .single();

    if (updateErr) {
      // Fallback if entries column doesn't exist in DB schema yet
      const { entries: _discard, ...fallbackPayload } = updatePayload;
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('time_logs')
        .update(fallbackPayload)
        .eq('id', log.id)
        .select()
        .single();

      if (fallbackErr) throw fallbackErr;
      updatedData = { ...fallbackData, entries: updatedEntries };
    } else {
      updatedData = data;
    }

    // 7. Trigger Google Sheets sync in background
    syncTimeLog(employee_id, date).catch(syncErr => {
      console.error('[ClockOut] Background Sheet sync error:', syncErr);
    });

    return NextResponse.json({
      message: 'Pointage sortie enregistré avec succès.',
      log: updatedData
    });

  } catch (error) {
    console.error('Error clocking out:', error);
    return NextResponse.json(
      { error: "Erreur interne du serveur lors de l'enregistrement de la sortie." },
      { status: 500 }
    );
  }
}
