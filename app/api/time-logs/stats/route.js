import { NextResponse } from 'next/server';
import { verifyRole, getSupabaseAdmin } from '../../../../lib/supabaseAuth';

// Madagascar timezone offset helper (UTC+3)
const getLocalTodayStr = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const local = new Date(utc + (3600000 * 3));
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
};

export async function GET(req) {
  // 1. Authenticate user as 'hr' or 'admin' (Administrateur)
  const auth = await verifyRole(req, ['hr', 'admin']);
  if (auth.error) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);

    const todayStr = getLocalTodayStr();
    let startDateParam = searchParams.get('startDate');
    let endDateParam = searchParams.get('endDate');
    const serviceFilter = searchParams.get('service') || 'Tous';

    // Default dates: if not provided, default to last 7 days ending today
    if (!endDateParam) {
      endDateParam = todayStr;
    }
    if (!startDateParam) {
      const d = new Date();
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const local = new Date(utc + (3600000 * 3));
      local.setDate(local.getDate() - 6);
      startDateParam = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
    }

    // Safety checks & normalize dates
    if (startDateParam > endDateParam) {
      const temp = startDateParam;
      startDateParam = endDateParam;
      endDateParam = temp;
    }

    // 2. Fetch all members / employees
    let membersQuery = supabase
      .from('leave_balances')
      .select('*')
      .order('employee_first_name', { ascending: true });

    if (serviceFilter && serviceFilter !== 'Tous') {
      if (serviceFilter === 'Direction') {
        membersQuery = membersQuery.or('service.eq.Direction,service.eq.Directeur');
      } else {
        membersQuery = membersQuery.eq('service', serviceFilter);
      }
    }

    const { data: members, error: membersErr } = await membersQuery;
    if (membersErr) throw membersErr;

    const memberList = members || [];
    const totalMembersCount = memberList.length;
    const memberIdMap = new Map();
    memberList.forEach(m => memberIdMap.set(m.employee_id, m));

    // 3. Fetch time logs within the date range
    const { data: rangeLogs, error: logsErr } = await supabase
      .from('time_logs')
      .select('*')
      .gte('date', startDateParam)
      .lte('date', endDateParam);

    if (logsErr) throw logsErr;

    // Filter logs by selected service members if a service filter is applied
    const filteredLogs = (rangeLogs || []).filter(log => {
      if (serviceFilter === 'Tous') return true;
      return memberIdMap.has(log.employee_id);
    });

    // Fetch production pause time logs in range
    let prodPauseLogs = [];
    try {
      const { data: pLogs } = await supabase
        .from('production_time_logs')
        .select('id, employee_id, duration_seconds, log_type, logged_at, start_time')
        .gte('logged_at', `${startDateParam}T00:00:00.000Z`)
        .lte('logged_at', `${endDateParam}T23:59:59.999Z`);
      
      prodPauseLogs = (pLogs || []).filter(log => {
        const isPauseType = log.log_type?.startsWith('pause') || log.log_type?.startsWith('interruption:pause');
        if (!isPauseType) return false;
        if (serviceFilter === 'Tous') return true;
        return memberIdMap.has(log.employee_id);
      });
    } catch (e) {
      console.warn('Could not fetch production pause logs:', e);
    }

    // 4. Fetch approved leave requests overlapping the date range
    let leaveQuery = supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'Approuvé')
      .lte('start_date', endDateParam)
      .gte('end_date', startDateParam);

    const { data: approvedLeaves, error: leavesErr } = await leaveQuery;
    if (leavesErr) throw leavesErr;

    const filteredLeaves = (approvedLeaves || []).filter(req => {
      if (serviceFilter === 'Tous') return true;
      return memberIdMap.has(req.employee_id);
    });

    // 5. Generate list of dates in the range
    const dayNamesAbbr = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const dateList = [];
    
    // Parse start and end date safely
    const [startYear, startMonth, startDay] = startDateParam.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDateParam.split('-').map(Number);
    
    const currDate = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
    const stopDate = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);

    // Limit range to max 366 days
    let loopCount = 0;
    while (currDate <= stopDate && loopCount < 366) {
      const y = currDate.getFullYear();
      const m = String(currDate.getMonth() + 1).padStart(2, '0');
      const d = String(currDate.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;
      const dayOfWeek = currDate.getDay();
      
      dateList.push({
        date: dateKey,
        label: `${dayNamesAbbr[dayOfWeek]} ${d}/${m}`,
        dayName: dayNamesAbbr[dayOfWeek],
        dayNum: d,
        monthNum: m,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      });

      currDate.setDate(currDate.getDate() + 1);
      loopCount++;
    }

    // 6. Aggregate day-by-day metrics
    const dayLogsMap = {};
    dateList.forEach(item => {
      dayLogsMap[item.date] = {
        present: 0,
        late: 0,
        punctual: 0,
        clock_out: 0,
        on_leave: 0,
        absent: 0,
        // Pauses
        pauseMinutes: 0,
        pauseCount: 0,
        pauseTypes: { dejeuner: 0, autre: 0 },
        // Flux entrées/sorties
        entriesCount: 0,
        exitsCount: 0,
        totalPassages: 0,
        multiPassageEmployees: 0
      };
    });

    // Populate time logs and pauses/flux into days
    filteredLogs.forEach(log => {
      if (dayLogsMap[log.date]) {
        if (log.clock_in) {
          dayLogsMap[log.date].present++;
          if (log.status === 'En retard' || log.status === 'Retard & Départ ant.') {
            dayLogsMap[log.date].late++;
          } else {
            dayLogsMap[log.date].punctual++;
          }
        }
        if (log.clock_out) {
          dayLogsMap[log.date].clock_out++;
        }

        // Flux entrées / sorties
        let entriesArr = [];
        if (Array.isArray(log.entries)) {
          entriesArr = log.entries;
        } else if (typeof log.entries === 'string') {
          try { entriesArr = JSON.parse(log.entries); } catch (e) { entriesArr = []; }
        }

        if (entriesArr && entriesArr.length > 0) {
          const inCount = entriesArr.filter(e => e && e.in).length;
          const outCount = entriesArr.filter(e => e && e.out).length;
          dayLogsMap[log.date].entriesCount += inCount;
          dayLogsMap[log.date].exitsCount += outCount;
          if (inCount > 1) {
            dayLogsMap[log.date].multiPassageEmployees++;
          }
        } else {
          if (log.clock_in) dayLogsMap[log.date].entriesCount++;
          if (log.clock_out) dayLogsMap[log.date].exitsCount++;
        }

        // Breaks / Pauses from attendance time_logs
        let breaksArr = [];
        if (Array.isArray(log.breaks)) {
          breaksArr = log.breaks;
        } else if (typeof log.breaks === 'string') {
          try { breaksArr = JSON.parse(log.breaks); } catch (e) { breaksArr = []; }
        }

        if (breaksArr && breaksArr.length > 0) {
          breaksArr.forEach(brk => {
            if (!brk) return;
            let durMin = 0;
            if (brk.duration) {
              durMin = Number(brk.duration) || 0;
            } else if (brk.start && brk.end) {
              const [sh, sm] = brk.start.split(':').map(Number);
              const [eh, em] = brk.end.split(':').map(Number);
              durMin = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
            }
            if (durMin > 0) {
              const bType = brk.type && brk.type.includes('dej') ? 'dejeuner' : 'autre';
              dayLogsMap[log.date].pauseMinutes += durMin;
              dayLogsMap[log.date].pauseCount++;
              dayLogsMap[log.date].pauseTypes[bType] = (dayLogsMap[log.date].pauseTypes[bType] || 0) + durMin;
            }
          });
        }
      }
    });

    // Populate pauses from production_time_logs
    prodPauseLogs.forEach(log => {
      const dStr = log.logged_at ? log.logged_at.slice(0, 10) : (log.start_time ? log.start_time.slice(0, 10) : '');
      if (dayLogsMap[dStr]) {
        const durMin = Math.round((log.duration_seconds || 0) / 60);
        if (durMin > 0) {
          const lType = log.log_type || '';
          const category = lType.includes('dejeuner') ? 'dejeuner' : 'autre';
          dayLogsMap[dStr].pauseMinutes += durMin;
          dayLogsMap[dStr].pauseCount++;
          dayLogsMap[dStr].pauseTypes[category] = (dayLogsMap[dStr].pauseTypes[category] || 0) + durMin;
        }
      }
    });

    // Check approved leaves for each day
    dateList.forEach(item => {
      let leaveCountOnDay = 0;
      filteredLeaves.forEach(req => {
        if (item.date >= req.start_date && item.date <= req.end_date) {
          leaveCountOnDay++;
        }
      });
      dayLogsMap[item.date].on_leave = leaveCountOnDay;
      const nonPresent = Math.max(0, totalMembersCount - dayLogsMap[item.date].present);
      dayLogsMap[item.date].absent = nonPresent;
      dayLogsMap[item.date].totalPassages = dayLogsMap[item.date].entriesCount + dayLogsMap[item.date].exitsCount;
    });

    // 7. Overall Summary Stats for the period
    let totalClockIns = 0;
    let totalLate = 0;
    let totalPunctual = 0;
    let totalClockOuts = 0;
    let totalLeaveDays = 0;
    const leaveBreakdown = {};

    let totalPauseMinutes = 0;
    let totalPauseCount = 0;
    const pauseBreakdown = { dejeuner: 0, autre: 0 };

    let totalFluxEntries = 0;
    let totalFluxExits = 0;
    let totalMultiPassages = 0;

    dateList.forEach(item => {
      const dayStats = dayLogsMap[item.date];
      totalPauseMinutes += dayStats.pauseMinutes;
      totalPauseCount += dayStats.pauseCount;
      pauseBreakdown.dejeuner += dayStats.pauseTypes.dejeuner;
      pauseBreakdown.autre += dayStats.pauseTypes.autre;

      totalFluxEntries += dayStats.entriesCount;
      totalFluxExits += dayStats.exitsCount;
      totalMultiPassages += dayStats.multiPassageEmployees;
    });

    filteredLogs.forEach(log => {
      if (log.clock_in) {
        totalClockIns++;
        if (log.status === 'En retard' || log.status === 'Retard & Départ ant.') {
          totalLate++;
        } else {
          totalPunctual++;
        }
      }
      if (log.clock_out) {
        totalClockOuts++;
      }
    });

    filteredLeaves.forEach(req => {
      const days = parseFloat(req.business_days || 0);
      totalLeaveDays += days;
      const type = req.leave_type || 'Autre';
      leaveBreakdown[type] = (leaveBreakdown[type] || 0) + days;
    });

    const overallPunctualityRate = totalClockIns > 0 
      ? Math.round((totalPunctual / totalClockIns) * 100) 
      : 100;

    // Working days count
    const workingDaysCount = dateList.filter(d => !d.isWeekend).length || 1;
    const avgPresentPerWorkingDay = workingDaysCount > 0 
      ? (totalClockIns / workingDaysCount).toFixed(1) 
      : '0';

    // 8. Service Breakdown
    const serviceStatsMap = {};
    memberList.forEach(m => {
      const svc = (m.service === 'Directeur' ? 'Direction' : m.service) || 'Non spécifié';
      if (!serviceStatsMap[svc]) {
        serviceStatsMap[svc] = {
          service: svc,
          employeesCount: 0,
          totalClockIns: 0,
          punctualCount: 0,
          lateCount: 0,
          clockOutCount: 0,
          leaveDays: 0,
          punctualityRate: 100
        };
      }
      serviceStatsMap[svc].employeesCount++;
    });

    filteredLogs.forEach(log => {
      const member = memberIdMap.get(log.employee_id);
      if (member) {
        const svc = (member.service === 'Directeur' ? 'Direction' : member.service) || 'Non spécifié';
        if (serviceStatsMap[svc] && log.clock_in) {
          serviceStatsMap[svc].totalClockIns++;
          if (log.status === 'En retard' || log.status === 'Retard & Départ ant.') {
            serviceStatsMap[svc].lateCount++;
          } else {
            serviceStatsMap[svc].punctualCount++;
          }
          if (log.clock_out) {
            serviceStatsMap[svc].clockOutCount++;
          }
        }
      }
    });

    filteredLeaves.forEach(req => {
      const member = memberIdMap.get(req.employee_id);
      if (member) {
        const svc = (member.service === 'Directeur' ? 'Direction' : member.service) || 'Non spécifié';
        if (serviceStatsMap[svc]) {
          serviceStatsMap[svc].leaveDays += parseFloat(req.business_days || 0);
        }
      }
    });

    const byService = Object.values(serviceStatsMap).map(s => ({
      ...s,
      punctualityRate: s.totalClockIns > 0 ? Math.round((s.punctualCount / s.totalClockIns) * 100) : 100,
      leaveDays: parseFloat(s.leaveDays.toFixed(1))
    })).sort((a, b) => b.employeesCount - a.employeesCount);

    // 9. Employee Breakdown
    const employeeStatsMap = {};
    memberList.forEach(m => {
      employeeStatsMap[m.employee_id] = {
        employee_id: m.employee_id,
        employee_name: m.employee_name,
        employee_first_name: m.employee_first_name,
        service: (m.service === 'Directeur' ? 'Direction' : m.service) || 'Non spécifié',
        role: m.role,
        remaining_balance: m.remaining_balance || 0,
        remaining_perm: m.remaining_perm || 0,
        presentDays: 0,
        punctualDays: 0,
        lateDays: 0,
        clockOutCount: 0,
        leaveDays: 0,
        punctualityRate: 100
      };
    });

    filteredLogs.forEach(log => {
      const emp = employeeStatsMap[log.employee_id];
      if (emp && log.clock_in) {
        emp.presentDays++;
        if (log.status === 'En retard' || log.status === 'Retard & Départ ant.') {
          emp.lateDays++;
        } else {
          emp.punctualDays++;
        }
        if (log.clock_out) {
          emp.clockOutCount++;
        }
      }
    });

    filteredLeaves.forEach(req => {
      const emp = employeeStatsMap[req.employee_id];
      if (emp) {
        emp.leaveDays += parseFloat(req.business_days || 0);
      }
    });

    const byEmployee = Object.values(employeeStatsMap).map(e => ({
      ...e,
      punctualityRate: e.presentDays > 0 ? Math.round((e.punctualDays / e.presentDays) * 100) : 100,
      leaveDays: parseFloat(e.leaveDays.toFixed(1))
    })).sort((a, b) => (a.employee_first_name || '').localeCompare(b.employee_first_name || ''));

    // 10. Format Chart Data
    const chartData = dateList.map(item => {
      const stats = dayLogsMap[item.date];
      return {
        date: item.date,
        label: item.label,
        dayName: item.dayName,
        dayNum: item.dayNum,
        isWeekend: item.isWeekend,
        present: stats.present,
        late: stats.late,
        punctual: stats.punctual,
        clock_out: stats.clock_out,
        on_leave: stats.on_leave,
        absent: stats.absent
      };
    });

    // 11. Format Pauses Chart Data
    const pauseChartData = dateList.map(item => {
      const stats = dayLogsMap[item.date];
      return {
        date: item.date,
        label: item.label,
        dayName: item.dayName,
        dayNum: item.dayNum,
        isWeekend: item.isWeekend,
        dejeuner: stats.pauseTypes.dejeuner,
        autre: stats.pauseTypes.autre,
        totalMinutes: stats.pauseMinutes,
        count: stats.pauseCount
      };
    });

    // 12. Format Flux Entrées/Sorties Chart Data
    const fluxChartData = dateList.map(item => {
      const stats = dayLogsMap[item.date];
      return {
        date: item.date,
        label: item.label,
        dayName: item.dayName,
        dayNum: item.dayNum,
        isWeekend: item.isWeekend,
        entries: stats.entriesCount,
        exits: stats.exitsCount,
        totalPassages: stats.totalPassages,
        multiPassages: stats.multiPassageEmployees
      };
    });

    // 13. Today's snapshot stats
    const todayStats = dayLogsMap[todayStr] || {
      present: 0,
      late: 0,
      punctual: 0,
      clock_out: 0,
      absent: totalMembersCount
    };

    return NextResponse.json({
      period: {
        startDate: startDateParam,
        endDate: endDateParam,
        daysCount: dateList.length,
        workingDaysCount
      },
      summary: {
        totalEmployees: totalMembersCount,
        totalClockIns,
        totalPunctual,
        totalLate,
        totalClockOuts,
        punctualityRate: overallPunctualityRate,
        totalLeaveDays: parseFloat(totalLeaveDays.toFixed(1)),
        avgPresentPerDay: avgPresentPerWorkingDay
      },
      pauses: {
        summary: {
          totalMinutes: totalPauseMinutes,
          totalHours: (totalPauseMinutes / 60).toFixed(1),
          avgMinutesPerDay: workingDaysCount > 0 ? Math.round(totalPauseMinutes / workingDaysCount) : 0,
          totalCount: totalPauseCount,
          breakdown: pauseBreakdown
        },
        chartData: pauseChartData
      },
      flux: {
        summary: {
          totalEntries: totalFluxEntries,
          totalExits: totalFluxExits,
          totalPassages: totalFluxEntries + totalFluxExits,
          avgPassagesPerDay: workingDaysCount > 0 ? ((totalFluxEntries + totalFluxExits) / workingDaysCount).toFixed(1) : '0',
          totalMultiPassages
        },
        chartData: fluxChartData
      },
      today: {
        date: todayStr,
        total: totalMembersCount,
        present: todayStats.present,
        late: todayStats.late,
        punctual: todayStats.punctual,
        absent: todayStats.absent,
        clocked_out: todayStats.clock_out,
        punctuality_rate: todayStats.present > 0 ? Math.round((todayStats.punctual / todayStats.present) * 100) : 100
      },
      chartData,
      byService,
      byEmployee,
      leaveBreakdown
    });

  } catch (error) {
    console.error('Error fetching time stats:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors du calcul des statistiques.' },
      { status: 500 }
    );
  }
}
