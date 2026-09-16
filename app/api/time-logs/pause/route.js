import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';
import { syncTimeLog } from '../../../../lib/sheetsSync';

// Helper to calculate total break minutes from breaks array
export function calculateTotalBreakMinutes(breaks) {
  if (!Array.isArray(breaks)) return 0;
  let totalMins = 0;
  for (const b of breaks) {
    if (b.start && b.end) {
      const [sH, sM] = b.start.split(':').map(Number);
      const [eH, eM] = b.end.split(':').map(Number);
      const diff = (eH * 60 + eM) - (sH * 60 + sM);
      if (diff > 0) {
        totalMins += diff;
      }
    }
  }
  return totalMins;
}

// Helper to format minutes as "Xh YYm"
export function formatMinutesToHM(minutes) {
  const safeMins = Math.max(0, minutes || 0);
  const hrs = Math.floor(safeMins / 60);
  const mins = safeMins % 60;
  return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
}

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
    const { employee_id, date, action, time } = body;

    if (!employee_id || !date) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants : employee_id, date.' },
        { status: 400 }
      );
    }

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
        { error: "Impossible d'enregistrer une pause : aucun pointage d'arrivée enregistré aujourd'hui pour ce collaborateur." },
        { status: 400 }
      );
    }

    if (log.clock_out) {
      return NextResponse.json(
        { error: "Impossible de modifier la pause : ce collaborateur a déjà pointé sa sortie pour aujourd'hui." },
        { status: 400 }
      );
    }

    // 3. Compute Madagascar local time (UTC+3) if not supplied
    let finalTime = time;
    if (!finalTime) {
      const d = new Date();
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const localTime = new Date(utc + (3600000 * 3));
      finalTime = `${String(localTime.getHours()).padStart(2, '0')}:${String(localTime.getMinutes()).padStart(2, '0')}`;
    }

    // 4. Determine whether we are starting a break or returning from a break
    const currentlyOnBreak = Boolean(log.is_on_break);
    let isStartingBreak = !currentlyOnBreak;
    if (action === 'start') isStartingBreak = true;
    else if (action === 'end') isStartingBreak = false;

    // Parse existing breaks list
    let existingBreaks = [];
    if (Array.isArray(log.breaks)) {
      existingBreaks = [...log.breaks];
    } else if (typeof log.breaks === 'string') {
      try {
        existingBreaks = JSON.parse(log.breaks);
      } catch (e) {
        existingBreaks = [];
      }
    }

    let updatedBreaks = [...existingBreaks];
    let updateFields = {};

    if (isStartingBreak) {
      // Start a new break session
      updatedBreaks.push({
        start: finalTime,
        end: null
      });

      updateFields = {
        break_start: finalTime,
        breaks: updatedBreaks,
        is_on_break: true,
        updated_at: new Date().toISOString()
      };
    } else {
      // Returning from break
      let closedLastBreak = false;
      for (let i = updatedBreaks.length - 1; i >= 0; i--) {
        if (!updatedBreaks[i].end) {
          updatedBreaks[i].end = finalTime;
          closedLastBreak = true;
          break;
        }
      }

      if (!closedLastBreak) {
        updatedBreaks.push({
          start: log.break_start || finalTime,
          end: finalTime
        });
      }

      const totalMinutes = calculateTotalBreakMinutes(updatedBreaks);
      const formattedDuration = formatMinutesToHM(totalMinutes);

      updateFields = {
        break_end: finalTime,
        break_duration: formattedDuration,
        breaks: updatedBreaks,
        is_on_break: false,
        updated_at: new Date().toISOString()
      };
    }

    // 5. Update pointage in Supabase
    const { data: updatedData, error: updateErr } = await supabase
      .from('time_logs')
      .update(updateFields)
      .eq('id', log.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 6. Trigger Google Sheets sync in background
    syncTimeLog(employee_id, date).catch(syncErr => {
      console.error('[Pause] Background Sheet sync error:', syncErr);
    });

    return NextResponse.json({
      message: isStartingBreak ? 'Pause débutée avec succès.' : 'Retour de pause enregistré avec succès.',
      is_on_break: isStartingBreak,
      log: updatedData
    });

  } catch (error) {
    console.error('Error handling pause:', error);
    return NextResponse.json(
      { error: "Erreur interne du serveur lors de l'enregistrement de la pause." },
      { status: 500 }
    );
  }
}
