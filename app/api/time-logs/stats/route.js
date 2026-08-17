import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';

export async function GET(req) {
  // 1. Authenticate user as 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Madagascar timezone offset helper (UTC+3)
    const getLocalTodayStr = () => {
      const d = new Date();
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const local = new Date(utc + (3600000 * 3));
      return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
    };

    const todayStr = getLocalTodayStr();

    // 2. Get total employees count
    const { count: totalEmployees, error: countErr } = await supabase
      .from('leave_balances')
      .select('*', { count: 'exact', head: true });

    if (countErr) throw countErr;

    const totalCount = totalEmployees || 0;

    // 3. Get today's stats
    const { data: todayLogs, error: todayLogsErr } = await supabase
      .from('time_logs')
      .select('*')
      .eq('date', todayStr);

    if (todayLogsErr) throw todayLogsErr;

    let presentToday = 0;
    let lateToday = 0;
    let clockOutToday = 0;

    if (todayLogs) {
      todayLogs.forEach(log => {
        if (log.clock_in) presentToday++;
        if (log.status === 'En retard' || log.status === 'Retard & Départ ant.') lateToday++;
        if (log.clock_out) clockOutToday++;
      });
    }

    const absentToday = Math.max(0, totalCount - presentToday);
    const punctualityRate = presentToday > 0 ? Math.round(((presentToday - lateToday) / presentToday) * 100) : 100;

    // 4. Calculate historical attendance for the last 7 days
    const pastDays = [];
    const dateLabels = [];
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const local = new Date(utc + (3600000 * 3));
      local.setDate(local.getDate() - i);
      
      const dateKey = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
      pastDays.push(dateKey);
      dateLabels.push({
        date: dateKey,
        label: `${dayNames[local.getDay()]} ${local.getDate()}`
      });
    }

    const minDate = pastDays[0];
    const maxDate = pastDays[pastDays.length - 1];

    const { data: rangeLogs, error: rangeErr } = await supabase
      .from('time_logs')
      .select('*')
      .gte('date', minDate)
      .lte('date', maxDate);

    if (rangeErr) throw rangeErr;

    const rangeMap = {};
    pastDays.forEach(day => {
      rangeMap[day] = { present: 0, late: 0, absent: totalCount };
    });

    if (rangeLogs) {
      rangeLogs.forEach(log => {
        if (rangeMap[log.date]) {
          if (log.clock_in) {
            rangeMap[log.date].present++;
            rangeMap[log.date].absent = Math.max(0, rangeMap[log.date].absent - 1);
          }
          if (log.status === 'En retard' || log.status === 'Retard & Départ ant.') {
            rangeMap[log.date].late++;
          }
        }
      });
    }

    const chartData = dateLabels.map(item => {
      const stats = rangeMap[item.date];
      return {
        date: item.date,
        label: item.label,
        present: stats.present,
        late: stats.late,
        absent: stats.absent
      };
    });

    return NextResponse.json({
      today: {
        date: todayStr,
        total: totalCount,
        present: presentToday,
        late: lateToday,
        absent: absentToday,
        clocked_out: clockOutToday,
        punctuality_rate: punctualityRate
      },
      chartData
    });

  } catch (error) {
    console.error('Error fetching time stats:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors du calcul des statistiques.' },
      { status: 500 }
    );
  }
}
