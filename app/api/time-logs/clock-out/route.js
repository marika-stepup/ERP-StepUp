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
        { error: "Impossible de pointer le départ : aucun pointage d'arrivée enregistré aujourd'hui pour ce collaborateur." },
        { status: 400 }
      );
    }

    // 3. Determine actual clock-out time
    let finalClockOut = clock_out_time;
    if (!finalClockOut) {
      const d = new Date();
      finalClockOut = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // 4. Check if early departure
    let newStatus = log.status || 'Présent';
    if (log.scheduled_clock_out) {
      const [outH, outM] = finalClockOut.split(':').map(Number);
      const [schedOutH, schedOutM] = log.scheduled_clock_out.split(':').map(Number);
      
      if ((outH * 60 + outM) < (schedOutH * 60 + schedOutM)) {
        // If they were already late, we can mark "Retard + Départ ant." or just "Départ anticipé"
        newStatus = log.status === 'En retard' ? 'Retard & Départ ant.' : 'Départ anticipé';
      }
    }

    // 5. Update pointage row in Supabase
    const { data: updatedData, error: updateErr } = await supabase
      .from('time_logs')
      .update({
        clock_out: finalClockOut,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', log.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 6. Trigger Google Sheets sync in background
    syncTimeLog(employee_id, date).catch(syncErr => {
      console.error('[ClockOut] Background Sheet sync error:', syncErr);
    });

    return NextResponse.json({
      message: 'Pointage départ enregistré avec succès.',
      log: updatedData
    });

  } catch (error) {
    console.error('Error clocking out:', error);
    return NextResponse.json(
      { error: "Erreur interne du serveur lors de l'enregistrement du départ." },
      { status: 500 }
    );
  }
}
