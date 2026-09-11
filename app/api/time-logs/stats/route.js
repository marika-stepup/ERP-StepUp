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
  // 1. Authenticate user as 'hr', 'manager' or 'director'
  const auth = await verifyRole(req, ['hr', 'manager', 'director', 'employee']);
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
        absent: 0
      };
    });

    // Populate time logs into days
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
    });

    // 7. Overall Summary Stats for the period
    let totalClockIns = 0;
    let totalLate = 0;
    let totalPunctual = 0;
    let totalClockOuts = 0;
    let totalLeaveDays = 0;
    const leaveBreakdown = {};

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

    // 11. Today's snapshot stats (for quick indicators)
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
