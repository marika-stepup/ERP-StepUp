'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient';

// Helper to check Madagascar public holidays (fixed and variable)
const isMadagascarHoliday = (dateStr) => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-indexed
  const d = date.getDate();

  // Fixed holidays
  if (m === 0 && d === 1) return true; // Jour de l'an
  if (m === 2 && d === 29) return true; // Commémoration du 29 mars 1947
  if (m === 4 && d === 1) return true; // Fête du travail
  if (m === 5 && d === 26) return true; // Fête nationale / Indépendance
  if (m === 7 && d === 15) return true; // Assomption
  if (m === 10 && d === 1) return true; // Toussaint
  if (m === 11 && d === 25) return true; // Noël

  // Variable holidays calculation (Easter, Ascension, Pentecost)
  // Meeus/Jones/Butcher Algorithm
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const dVal = Math.floor(b / 4);
  const eVal = b % 4;
  const fVal = Math.floor((b + 8) / 25);
  const gVal = Math.floor((b - fVal + 1) / 3);
  const hVal = (19 * a + b - dVal - gVal + 15) % 30;
  const iVal = Math.floor(c / 4);
  const kVal = c % 4;
  const lVal = (32 + 2 * eVal + 2 * iVal - hVal - kVal) % 7;
  const mVal = Math.floor((a + 11 * hVal + 22 * lVal) / 451);
  const easterMonth = Math.floor((hVal + lVal - 7 * mVal + 114) / 31);
  const easterDay = ((hVal + lVal - 7 * mVal + 114) % 31) + 1;

  const easterSunday = new Date(y, easterMonth - 1, easterDay);

  // Easter Monday (Easter + 1 day)
  const easterMonday = new Date(easterSunday);
  easterMonday.setDate(easterSunday.getDate() + 1);
  if (m === easterMonday.getMonth() && d === easterMonday.getDate()) return true;

  // Ascension Thursday (Easter + 39 days)
  const ascension = new Date(easterSunday);
  ascension.setDate(easterSunday.getDate() + 39);
  if (m === ascension.getMonth() && d === ascension.getDate()) return true;

  // Pentecost Monday (Easter + 50 days)
  const pentecost = new Date(easterSunday);
  pentecost.setDate(easterSunday.getDate() + 50);
  if (m === pentecost.getMonth() && d === pentecost.getDate()) return true;

  return false;
};

const formatDateStr = (str) => {
  if (!str) return '-';
  const parts = str.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return str;
};

export default function Page() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');

  // Navigation
  const [activeTab, setActiveTab] = useState('mySpace'); // 'mySpace', 'globalDashboard', 'adminRH'

  // Dark/Light Mode state
  const [darkMode, setDarkMode] = useState(false);

  // Business Data States
  const [balance, setBalance] = useState({
    initial_balance: 0, taken_days: 0, remaining_balance: 0,
    initial_perm: 0, taken_perm: 0, remaining_perm: 0
  });
  const [myRequests, setMyRequests] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  // Form States (Submit Leave)
  const [leaveType, setLeaveType] = useState('CP'); // 'CP' or 'Permission'
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('17:00');
  const [daysRequested, setDaysRequested] = useState('');
  const [reason, setReason] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form States (Add/Edit Member)
  const [editingMember, setEditingMember] = useState(null); // When set, we are in Edit Modal
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [showNewMemberPassword, setShowNewMemberPassword] = useState(false);
  const [newMemberService, setNewMemberService] = useState('Direction');
  const [newMemberRole, setNewMemberRole] = useState('employee');
  const [newMemberManager, setNewMemberManager] = useState('Aucun');
  const [newMemberCP, setNewMemberCP] = useState('25');
  const [newMemberPerm, setNewMemberPerm] = useState('5');
  const [newMemberHireDate, setNewMemberHireDate] = useState('');
  const [memberError, setMemberError] = useState(null);
  const [memberSuccess, setMemberSuccess] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [allRequests, setAllRequests] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  const getTodayDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(getTodayDateString());

  // Adjustments & HR Actions
  const [hrComments, setHrComments] = useState({});
  const [hrError, setHrError] = useState(null);
  const [hrSuccess, setHrSuccess] = useState(null);
  const [adjustingId, setAdjustingId] = useState(null);

  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Helper to trigger custom confirm modal
  const triggerConfirm = (title, message, onConfirm) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Calendar navigation & logic helpers
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  let firstDayOfWeek = firstDay.getDay();
  firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const calendarGridDays = [];

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const d = new Date(year, month - 1, dayNum);
    calendarGridDays.push({
      dayNum,
      isCurrentMonth: false,
      dateString: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
      isWeekend: d.getDay() === 0 || d.getDay() === 6
    });
  }

  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i);
    calendarGridDays.push({
      dayNum: i,
      isCurrentMonth: true,
      dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      isWeekend: d.getDay() === 0 || d.getDay() === 6
    });
  }

  const remaining = 42 - calendarGridDays.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    calendarGridDays.push({
      dayNum: i,
      isCurrentMonth: false,
      dateString: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      isWeekend: d.getDay() === 0 || d.getDay() === 6
    });
  }

  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

  const monthRequests = allRequests.filter(req => req.start_date <= monthEnd && req.end_date >= monthStart);

  // Generate days in month array for Gantt chart
  const daysInMonthArray = [];
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i);
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayNames = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
    const dayNameAbbr = dayNames[dayOfWeek];
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

    daysInMonthArray.push({
      dayNum: i,
      dateString,
      isWeekend,
      dayNameAbbr
    });
  }

  // Calculate conflicts per day and service for Gantt chart
  const dayServiceConflicts = {};
  daysInMonthArray.forEach(day => {
    const dayReqs = allRequests.filter(req =>
      day.dateString >= req.start_date && day.dateString <= req.end_date
    );
    const svcGroups = {};
    dayReqs.forEach(req => {
      const svc = req.service || 'Non spécifié';
      if (!svcGroups[svc]) svcGroups[svc] = [];
      svcGroups[svc].push(req.employee_id);
    });
    Object.keys(svcGroups).forEach(svc => {
      const uniqueEmployees = [...new Set(svcGroups[svc])];
      if (uniqueEmployees.length > 1) {
        dayServiceConflicts[`${day.dateString}-${svc}`] = true;
      }
    });
  });

  const getMonthOverlaps = () => {
    const byService = {};
    monthRequests.forEach(req => {
      const svc = req.service || 'Non spécifié';
      if (!byService[svc]) byService[svc] = [];
      byService[svc].push(req);
    });

    const overlapsList = [];
    Object.keys(byService).forEach(svc => {
      const reqs = byService[svc];
      for (let i = 0; i < reqs.length; i++) {
        for (let j = i + 1; j < reqs.length; j++) {
          const r1 = reqs[i];
          const r2 = reqs[j];
          if (r1.employee_id === r2.employee_id) continue;
          const oStart = r1.start_date > r2.start_date ? r1.start_date : r2.start_date;
          const oEnd = r1.end_date < r2.end_date ? r1.end_date : r2.end_date;
          if (oStart <= oEnd) {
            const isDup = overlapsList.some(o =>
              (o.r1.request_id === r1.request_id && o.r2.request_id === r2.request_id) ||
              (o.r1.request_id === r2.request_id && o.r2.request_id === r1.request_id)
            );
            if (!isDup) {
              overlapsList.push({ service: svc, r1, r2, start: oStart, end: oEnd });
            }
          }
        }
      }
    });
    return overlapsList;
  };

  const activeMonthOverlaps = getMonthOverlaps();

  // 1. Initial Session Check & Dark Mode check
  useEffect(() => {
    // Check local storage for dark mode
    const storedMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(storedMode);
    if (storedMode) {
      document.body.classList.add('dark');
    }

    const checkUser = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
          setUser(session.user);
          setToken(session.access_token);
        } else {
          window.location.href = '/login';
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        setToken(session.access_token);
      } else {
        window.location.href = '/login';
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Toggle Dark Mode function
  const toggleDarkMode = () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    localStorage.setItem('darkMode', nextMode.toString());
    if (nextMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  };

  const userRole = user?.app_metadata?.role || user?.user_metadata?.role || 'employee';

  // 2. Fetch all required data dynamically based on active tab and role
  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      // 2a. Fetch personal balance
      const balanceRes = await fetch('/api/leaves/balance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalance(balanceData);
      }

      // 2b. Fetch personal requests
      const myRequestsRes = await fetch('/api/leaves/my-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (myRequestsRes.ok) {
        const myRequestsData = await myRequestsRes.json();
        setMyRequests(myRequestsData.requests || []);
      }

      // 2c. Fetch global members list (accessible to all roles for the global dashboard)
      const membersRes = await fetch('/api/admin/members', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setAllMembers(membersData.members || []);
      }

      // Fetch all leave requests for the calendar (accessible to all roles)
      const allRequestsRes = await fetch('/api/leaves/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (allRequestsRes.ok) {
        const allRequestsData = await allRequestsRes.json();
        setAllRequests(allRequestsData.requests || []);
      }

      // 2d. Fetch pending requests if authorized (HR, Manager, Director)
      if (userRole === 'hr' || userRole === 'manager' || userRole === 'director') {
        const pendingRes = await fetch('/api/leaves/pending', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          setPendingRequests(pendingData.requests || []);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchDashboardData();
    }
  }, [user, token, userRole]);

  // 3. Submit Leave Request
  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    setSubmitting(true);

    try {
      const res = await fetch('/api/leaves/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          reason: reason
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Erreur lors de la soumission de la demande.');
      } else {
        setSubmitSuccess(true);
        setStartDate('');
        setEndDate('');
        setDaysRequested('');
        setReason('');
        fetchDashboardData();
      }
    } catch (err) {
      setSubmitError('Une erreur réseau est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Create new member (HR Admin)
  const handleCreateMember = async (e) => {
    e.preventDefault();
    setMemberError(null);
    setMemberSuccess(false);
    setMemberLoading(true);

    try {
      const res = await fetch('/api/admin/create-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newMemberEmail,
          name: newMemberName,
          role: newMemberRole,
          manager_name: newMemberManager,
          initial_balance: parseFloat(newMemberCP || 0),
          initial_perm: parseFloat(newMemberPerm || 0),
          password: newMemberPassword,
          service: newMemberService,
          hire_date: newMemberHireDate
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setMemberError(data.error || 'Erreur lors de la création du membre.');
      } else {
        setMemberSuccess(true);
        setNewMemberName('');
        setNewMemberEmail('');
        setNewMemberPassword('');
        setShowNewMemberPassword(false);
        setNewMemberCP('25');
        setNewMemberPerm('5');
        setNewMemberHireDate('');
        setNewMemberManager('Aucun');
        setNewMemberService('Direction');
        fetchDashboardData();
      }
    } catch (err) {
      setMemberError('Une erreur réseau est survenue.');
    } finally {
      setMemberLoading(false);
    }
  };

  // 5. Start Edit Mode for a Member (Opens Modal)
  const startEditMember = (m) => {
    setEditingMember(m);
    setNewMemberName(m.employee_name);
    setNewMemberEmail(m.employee_email);
    setNewMemberRole(m.role || 'employee');
    setNewMemberManager(m.manager_name || 'Aucun');
    setNewMemberCP(m.initial_balance.toString());
    setNewMemberPerm((m.initial_perm || 5).toString());
    setNewMemberService(m.service || 'Non spécifié');
    setNewMemberHireDate(m.hire_date || '');

    // Clear alerts
    setMemberError(null);
    setMemberSuccess(false);
  };

  // 6. Cancel Edit Mode
  const cancelEditMember = () => {
    setEditingMember(null);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberRole('employee');
    setNewMemberManager('Aucun');
    setNewMemberCP('25');
    setNewMemberPerm('5');
    setNewMemberService('Direction');
    setNewMemberHireDate('');
  };

  // 7. Update Member Details (HR Admin)
  const handleUpdateMember = async (e) => {
    e.preventDefault();
    setMemberError(null);
    setMemberSuccess(false);
    setMemberLoading(true);

    try {
      const res = await fetch('/api/admin/update-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          employee_id: editingMember.employee_id,
          name: newMemberName,
          email: newMemberEmail,
          role: newMemberRole,
          manager_name: newMemberManager,
          initial_balance: parseFloat(newMemberCP || 0),
          initial_perm: parseFloat(newMemberPerm || 0),
          service: newMemberService,
          hire_date: newMemberHireDate
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setMemberError(data.error || 'Erreur lors de la mise à jour du membre.');
      } else {
        setMemberSuccess(true);
        cancelEditMember();
        fetchDashboardData();
      }
    } catch (err) {
      setMemberError('Une erreur réseau est survenue.');
    } finally {
      setMemberLoading(false);
    }
  };

  // 8. Delete Member (HR Admin)
  const handleDeleteMember = async (employeeId) => {
    triggerConfirm(
      'Supprimer ce membre',
      'Voulez-vous vraiment supprimer ce membre ainsi que tous ses soldes ? Cette action est irréversible.',
      async () => {
        setHrError(null);
        setHrSuccess(null);

        try {
          const res = await fetch('/api/admin/delete-member', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ employee_id: employeeId })
          });

          const data = await res.json();
          if (!res.ok) {
            setHrError(data.error || 'Erreur lors de la suppression.');
          } else {
            setHrSuccess(data.message);
            fetchDashboardData();
          }
        } catch (err) {
          setHrError('Une erreur réseau est survenue.');
        }
      }
    );
  };

  // 9. Adjust Balance Quick Input (HR Admin Table)
  const handleAdjustBalance = async (employeeId, type, value) => {
    setAdjustingId(employeeId);
    setHrError(null);
    setHrSuccess(null);

    try {
      const res = await fetch('/api/admin/adjust-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          employee_id: employeeId,
          type,
          value: parseFloat(value || 0)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setHrError(data.error || 'Erreur lors de l\'ajustement du solde.');
      } else {
        setHrSuccess(`Solde mis à jour pour ${data.balance?.employee_name}.`);
        fetchDashboardData();
      }
    } catch (err) {
      setHrError('Une erreur réseau est survenue.');
    } finally {
      setAdjustingId(null);
    }
  };

  // 10. Credit +2.5j CP to all members
  const handleCreditAll = async () => {
    triggerConfirm(
      'Créditer les collaborateurs',
      'Voulez-vous vraiment créditer de +2.5j de CP TOUS les collaborateurs du système ?',
      async () => {
        setHrError(null);
        setHrSuccess(null);

        try {
          const res = await fetch('/api/admin/credit-all', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });

          const data = await res.json();
          if (!res.ok) {
            setHrError(data.error || 'Erreur lors du crédit global.');
          } else {
            setHrSuccess(data.message);
            fetchDashboardData();
          }
        } catch (err) {
          setHrError('Une erreur réseau est survenue.');
        }
      }
    );
  };

  // 11. Approve/Reject Leave Request
  const handleValidateLeave = async (requestId, action) => {
    const actionLabel = action === 'Approuver' ? 'accepter' : 'refuser';
    triggerConfirm(
      `${action} la demande`,
      `Voulez-vous vraiment ${actionLabel} cette demande de congé ?`,
      async () => {
        setHrError(null);
        setHrSuccess(null);
        const comment = hrComments[requestId] || '';

        try {
          const res = await fetch('/api/leaves/validate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              request_id: requestId,
              action: action,
              hr_comment: comment
            })
          });

          const data = await res.json();
          if (!res.ok) {
            setHrError(data.error || 'Erreur lors de la validation.');
          } else {
            setHrSuccess(`La demande a été ${action === 'Approuver' ? 'approuvée' : 'refusée'} avec succès.`);
            setHrComments(prev => {
              const updated = { ...prev };
              delete updated[requestId];
              return updated;
            });
            fetchDashboardData();
          }
        } catch (err) {
          setHrError('Une erreur réseau est survenue.');
        }
      }
    );
  };

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    sessionStorage.removeItem('supabase_token');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="card" style={{ marginTop: '5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/Logo Step Up.png" alt="Step Hub" style={{ height: '40px', marginBottom: '1.5rem' }} />
        <h1>Chargement de l'espace...</h1>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* --- TOP HEADER NAVIGATION BAR --- */}
      <header className="app-header">
        <div className="logo-container">
          <img src="/Logo Step Up.png" alt="Step Hub Logo" className="logo-img" />
          <span className="logo-text">Step Hub</span>
        </div>

        {/* KPI badge in header */}
        {(userRole === 'hr' || userRole === 'manager' || userRole === 'director') && pendingRequests.length > 0 && (
          <div
            onClick={() => setActiveTab('adminRH')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--warning-bg)',
              color: 'var(--warning-color)',
              border: '1px solid var(--warning-border)',
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              marginLeft: 'auto',
              marginRight: '1.5rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            }}
            className="kpi-badge-hover"
            title="Gérer les demandes de congé en attente"
          >
            <span className="kpi-pulse-icon">⏳</span>
            <span>{pendingRequests.length} en attente</span>
          </div>
        )}

        <div className="session-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: (userRole === 'hr' || userRole === 'manager' || userRole === 'director') && pendingRequests.length > 0 ? '0' : 'auto' }}>
          <span><strong>{balance.employee_name || user?.email}</strong></span>
          <span className={`badge-role ${userRole === 'hr' ? 'hr' : userRole === 'manager' ? 'manager' : userRole === 'director' ? 'director' : 'employee'}`} style={{ marginLeft: '0.25rem' }}>
            {userRole === 'hr' ? 'Administrateur' : userRole === 'manager' ? 'Manager' : userRole === 'director' ? 'Directeur' : 'Collaborateur'}
          </span>

          {/* Dark Mode Switcher Icon */}
          <button
            onClick={toggleDarkMode}
            className="logout-btn-header"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.45rem',
              marginLeft: '0.75rem',
              borderRadius: '50%',
              width: '32px',
              height: '32px'
            }}
            title={darkMode ? "Mode Clair" : "Mode Sombre"}
          >
            {darkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M4.93 4.93l1.414 1.414M16.24 16.24l1.414 1.414M3 12h2.25m13.5 0H21M5.757 18.243l-1.414-1.414M19.636 5.636l-1.414 1.414m-5.456 6.364a9 9 0 11-12.728 0 9 9 0 0112.728 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>

          {/* Logout Icon Button */}
          <button
            onClick={handleLogout}
            className="logout-btn-header"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.45rem',
              borderRadius: '50%',
              width: '32px',
              height: '32px'
            }}
            title="Se déconnecter"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
      </header>

      <div className="app-container">
        {/* --- TABS SELECTOR --- */}
        <div className="nav-tabs">
          <button
            className={`tab-button ${activeTab === 'mySpace' ? 'active' : ''}`}
            onClick={() => setActiveTab('mySpace')}
          >
            Mon espace
          </button>
          <button
            className={`tab-button ${activeTab === 'globalDashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('globalDashboard')}
          >
            Tableau de bord global
          </button>
          {(userRole === 'hr' || userRole === 'manager' || userRole === 'director') && (
            <button
              className={`tab-button ${activeTab === 'adminRH' ? 'active' : ''}`}
              onClick={() => setActiveTab('adminRH')}
            >
              Administration RH
            </button>
          )}
        </div>

        {/* ==================================================== */}
        {/* 1. TAB CONTENT: MON ESPACE                          */}
        {/* ==================================================== */}
        {activeTab === 'mySpace' && (
          <div className="split-layout">
            {/* Sidebar with Balance & Request Form */}
            <div className="sidebar">
              <div className="panel">
                <h2 className="panel-title">📋 Mes soldes restants</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="balance-card-mini cp">
                    <span className="balance-card-title">Congés payés</span>
                    <span className="balance-card-value">
                      {balance.remaining_balance} <span>jours</span>
                    </span>
                  </div>
                  <div className="balance-card-mini perm">
                    <span className="balance-card-title">Permissions</span>
                    <span className="balance-card-value">
                      {balance.remaining_perm} <span>jours</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h2 className="panel-title">➕ Déposer une demande</h2>

                {submitError && <div className="error-message">{submitError}</div>}
                {submitSuccess && <div className="success-message">Votre demande a été soumise.</div>}

                <form onSubmit={handleSubmitLeave} style={{ padding: 0, border: 'none', background: 'none' }}>
                  <div className="form-group">
                    <label>Type de congé</label>
                    <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                      <option value="CP">Congé Payé</option>
                      <option value="RTT">RTT</option>
                      <option value="Maladie">Congé Maladie</option>
                      <option value="Permission">Permission Spéciale</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date Début</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Heure Début</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date Fin</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Heure Fin</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Nombre de jours déduits (facultatif)</label>
                    <input
                      type="number"
                      placeholder="Ex: 1 ou 2.5"
                      step="0.5"
                      value={daysRequested}
                      onChange={(e) => setDaysRequested(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Motif / Justification</label>
                    <textarea
                      placeholder="Raison..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn-accent" disabled={submitting}>
                    {submitting ? 'Envoi...' : 'Soumettre la demande'}
                  </button>
                </form>
              </div>
            </div>

            {/* Main Content with request history */}
            <div className="main-content">
              <div className="panel">
                <h2 className="panel-title">🕒 Suivi de mes demandes</h2>

                {myRequests.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    Aucune demande enregistrée.
                  </p>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Dates</th>
                          <th>Durée</th>
                          <th>Demandé le</th>
                          <th>Traité le</th>
                          <th>Statut</th>
                          <th>Commentaire RH</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myRequests.map((req) => (
                          <tr key={req.request_id}>
                            <td>
                              <strong style={{ color: 'var(--brand-orange)' }}>{req.leave_type}</strong>
                            </td>
                            <td>
                              Du {req.start_date}<br />
                              Au {req.end_date}
                            </td>
                            <td><strong>{req.business_days} j</strong></td>
                            <td>
                              {req.created_at ? new Date(req.created_at).toLocaleDateString('fr-FR') : '-'}
                            </td>
                            <td>
                              {req.status !== 'En attente' && req.updated_at ? new Date(req.updated_at).toLocaleDateString('fr-FR') : '-'}
                            </td>
                            <td>
                              <span className={`status-badge ${req.status === 'En attente' ? 'status-pending' :
                                req.status === 'Approuvé' ? 'status-approved' : 'status-rejected'
                                }`}>
                                {req.status === 'En attente' ? 'En attente' :
                                  req.status === 'Approuvé' ? 'Approuvé' : 'Refusé'}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              {req.hr_comment || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 2. TAB CONTENT: GLOBAL DASHBOARD                     */}
        {/* ==================================================== */}
        {activeTab === 'globalDashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* KPIs grids */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <span className="kpi-val">{allMembers.length || 2}</span>
                <span className="kpi-lbl">Total Collaborateurs</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-val">
                  {allMembers.reduce((sum, m) => sum + parseFloat(m.remaining_balance || 0), 0).toFixed(1)}j
                </span>
                <span className="kpi-lbl">Soldes CP Cumulés</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-val">0</span>
                <span className="kpi-lbl">Salariés Absents ce jour</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-val">{pendingRequests.length}</span>
                <span className="kpi-lbl">Demandes en attente</span>
              </div>
            </div>



            {/* Calendrier des départs & Superpositions en format Gantt */}
            <div className="panel">
              <h2 className="panel-title">📅 Calendrier des départs & Superpositions</h2>
              <p className="panel-subtitle">Visualisation mensuelle sous forme de planning Gantt et détection des conflits par service.</p>

              <div className="gantt-container">
                {/* Gantt Header Nav */}
                <div className="gantt-header">
                  <span className="gantt-month-title">
                    {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </span>
                  <div className="gantt-nav-buttons">
                    <button type="button" className="gantt-nav-btn" onClick={handlePrevMonth} title="Mois précédent">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <button type="button" className="gantt-nav-btn" onClick={handleNextMonth} title="Mois suivant">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Legend */}
                <div className="gantt-legend">
                  <div className="gantt-legend-item">
                    <span className="gantt-legend-box approved"></span>
                    <span>Approuvé (CP / Perm)</span>
                  </div>
                  <div className="gantt-legend-item">
                    <span className="gantt-legend-box pending"></span>
                    <span>En attente</span>
                  </div>
                  <div className="gantt-legend-item">
                    <span className="gantt-legend-box overlap"></span>
                    <span>Superposition de Service</span>
                  </div>
                  <div className="gantt-legend-item">
                    <span className="gantt-legend-box weekend"></span>
                    <span>Week-end</span>
                  </div>
                  <div className="gantt-legend-item">
                    <span className="gantt-legend-box holiday" style={{ backgroundColor: '#ffe4e6' }}></span>
                    <span>Jour Férié</span>
                  </div>
                </div>

                {/* Scrollable Timeline Grid */}
                <div className="gantt-scroll-wrapper">
                  <table className="gantt-table">
                    <thead>
                      <tr>
                        <th colSpan={daysInMonthArray.length + 4} style={{
                          background: '#15803d', // Green background like Excel screenshot
                          color: '#ffffff',
                          fontSize: '1rem',
                          fontWeight: '700',
                          padding: '0.6rem',
                          textAlign: 'center',
                          textTransform: 'capitalize'
                        }}>
                          {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                        </th>
                      </tr>
                      <tr>
                        <th className="gantt-col-name" style={{ backgroundColor: 'var(--background-light)' }}>Collaborateur</th>
                        <th className="gantt-col-service" style={{ backgroundColor: 'var(--background-light)' }}>Service</th>
                        {daysInMonthArray.map(day => {
                          const isHoliday = isMadagascarHoliday(day.dateString);
                          return (
                            <th key={day.dayNum} className="gantt-day-th" style={{
                              backgroundColor: day.isWeekend ? 'var(--border-light)' : isHoliday ? '#ffe4e6' : 'transparent'
                            }}>
                              <span className="gantt-day-num">{day.dayNum}</span>
                              <span className="gantt-day-name">{day.dayNameAbbr}</span>
                            </th>
                          );
                        })}
                        <th className="gantt-col-balance" style={{ backgroundColor: 'var(--background-light)' }}>Solde CP</th>
                        <th className="gantt-col-balance" style={{ backgroundColor: 'var(--background-light)' }}>Solde Perm.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allMembers.length === 0 ? (
                        <tr>
                          <td colSpan={daysInMonthArray.length + 4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            Aucun collaborateur trouvé.
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          const servicesOrder = [
                            'Direction',
                            'Admin',
                            'Team leader',
                            'Web',
                            'Graphiste',
                            'SEO',
                            'SEA & Data analyst',
                            'Marketing de croissance',
                            'Community management'
                          ];

                          const sortedMembers = [...allMembers].sort((a, b) => {
                            const serviceA = a.service === 'Directeur' ? 'Direction' : a.service;
                            const serviceB = b.service === 'Directeur' ? 'Direction' : b.service;
                            const indexA = servicesOrder.indexOf(serviceA);
                            const indexB = servicesOrder.indexOf(serviceB);

                            if (indexA !== -1 && indexB !== -1) {
                              return indexA - indexB;
                            }
                            if (indexA !== -1) return -1;
                            if (indexB !== -1) return 1;
                            return a.employee_name.localeCompare(b.employee_name);
                          });

                          return sortedMembers.map(m => {
                            const employeeReqs = allRequests.filter(req => req.employee_id === m.employee_id);

                            return (
                              <tr key={m.employee_id}>
                                <td className="gantt-col-name">
                                  <div className="gantt-collaborator-name-wrapper">
                                    <span>{m.employee_name}</span>
                                    <span className="gantt-collaborator-email">{m.employee_email}</span>
                                  </div>
                                </td>
                                <td className="gantt-col-service">
                                  {(m.service === 'Directeur' ? 'Direction' : m.service) || 'Non spécifié'}
                                </td>
                                {daysInMonthArray.map(day => {
                                  const isWeekend = day.isWeekend;
                                  const isHoliday = isMadagascarHoliday(day.dateString);

                                  // Find if employee has a leave request covering this day
                                  const activeReq = employeeReqs.find(req =>
                                    day.dateString >= req.start_date && day.dateString <= req.end_date
                                  );

                                  let cellClass = 'gantt-cell';
                                  let cellText = '';
                                  let cellTitle = '';

                                  if (isWeekend) {
                                    cellClass += ' weekend';
                                  } else if (isHoliday) {
                                    cellClass += ' holiday';
                                    cellTitle = 'Jour Férié';
                                  } else if (activeReq) {
                                    if (activeReq.status === 'Approuvé') {
                                      cellClass += ' status-approved';
                                      cellText = '1';
                                    } else {
                                      cellClass += ' status-pending';
                                      cellText = '1';
                                    }

                                    // Check if service conflict/overlap exists on this day
                                    const svc = m.service || 'Non spécifié';
                                    if (dayServiceConflicts[`${day.dateString}-${svc}`]) {
                                      cellClass += ' overlap';
                                      cellTitle = `⚠️ Attention : Superposition dans le service ${svc} !\n`;
                                    }

                                    cellTitle += `${m.employee_name} - ${activeReq.leave_type} (${activeReq.status})`;
                                  }

                                  return (
                                    <td
                                      key={day.dayNum}
                                      className={cellClass}
                                      title={cellTitle}
                                    >
                                      {cellText}
                                    </td>
                                  );
                                })}
                                <td className="gantt-col-balance" style={{ textAlign: 'center' }}>
                                  <strong style={{ color: 'var(--brand-orange)' }}>{m.remaining_balance}j</strong>
                                </td>
                                <td className="gantt-col-balance" style={{ textAlign: 'center' }}>
                                  <strong>{m.remaining_perm}j</strong>
                                </td>
                              </tr>
                            );
                          })
                        })()
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Overlaps alert cards */}
                {activeMonthOverlaps.length > 0 && (
                  <div className="gantt-alerts-card">
                    <h3 className="gantt-alerts-title">
                      ⚠️ Alertes Superpositions de Service ({currentDate.toLocaleDateString('fr-FR', { month: 'long' })})
                    </h3>
                    <div className="gantt-alerts-list">
                      {activeMonthOverlaps.map((overlap, idx) => (
                        <div key={idx} className="gantt-alert-item">
                          <div>
                            <span className="gantt-alert-badge">{overlap.service}</span>{' '}
                            <strong>{overlap.r1.employee_name}</strong> et{' '}
                            <strong>{overlap.r2.employee_name}</strong> ont des congés superposés.
                          </div>
                          <div>
                            Période commune : du <strong>{new Date(overlap.start).toLocaleDateString('fr-FR')}</strong> au <strong>{new Date(overlap.end).toLocaleDateString('fr-FR')}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 3. TAB CONTENT: ADMINISTRATION RH                    */}
        {/* ==================================================== */}
        {activeTab === 'adminRH' && (userRole === 'hr' || userRole === 'manager' || userRole === 'director') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Header Actions Alerts */}
            {hrError && <div className="error-message">{hrError}</div>}
            {hrSuccess && <div className="success-message">{hrSuccess}</div>}

            {/* Validation Panel */}
            <div className="panel" style={{ borderTop: '4px solid var(--brand-orange)' }}>
              <h2 className="panel-title">🛡️ Suivi et Validation Finale RH</h2>
              <p className="panel-subtitle">Valider ou refuser les demandes de congé de l'entreprise.</p>

              {pendingRequests.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>
                  Aucun dossier validé par le N+1 en attente de traitement RH.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {pendingRequests.map((req) => (
                    <div key={req.request_id} className="validation-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <strong style={{ fontSize: '1.1rem' }}>{req.employee_name}</strong>
                          <span className="badge-role employee" style={{ marginLeft: '0.5rem' }}>Collaborateur</span>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Type: <strong>{req.leave_type}</strong> | Jours demandés: <strong>{req.business_days} j</strong>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                            Demande soumise le : <strong>{req.created_at ? new Date(req.created_at).toLocaleDateString('fr-FR') : '-'}</strong>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>Période de congé :</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Du {req.start_date} au {req.end_date}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Commentaire de validation..."
                          style={{ flexGrow: 1 }}
                          value={hrComments[req.request_id] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHrComments(prev => ({ ...prev, [req.request_id]: val }));
                          }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn-small btn-approve"
                            onClick={() => handleValidateLeave(req.request_id, 'Approuver')}
                          >
                            Accepter
                          </button>
                          <button
                            className="btn-small btn-reject"
                            onClick={() => handleValidateLeave(req.request_id, 'Refuser')}
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Historique des décisions validation */}
              <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--brand-navy)' }}>📜 Historique des congés approuvés</h3>
                <p className="panel-subtitle" style={{ marginBottom: '1.25rem' }}>Historique global des demandes déjà traitées par les RH.</p>

                {allRequests.filter(req => req.status === 'Approuvé').length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Aucune demande approuvée pour le moment.</p>
                ) : (
                  <div className="table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Collaborateur</th>
                          <th>Type</th>
                          <th>Dates</th>
                          <th>Durée</th>
                          <th>Demandé le</th>
                          <th>Validé le</th>
                          <th>Commentaire RH</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allRequests.filter(req => req.status === 'Approuvé').map((req) => (
                          <tr key={req.request_id}>
                            <td><strong>{req.employee_name}</strong></td>
                            <td><strong style={{ color: 'var(--brand-orange)' }}>{req.leave_type}</strong></td>
                            <td>Du {formatDateStr(req.start_date)} au {formatDateStr(req.end_date)}</td>
                            <td><strong>{req.business_days} j</strong></td>
                            <td>{req.created_at ? new Date(req.created_at).toLocaleDateString('fr-FR') : '-'}</td>
                            <td>{req.updated_at ? new Date(req.updated_at).toLocaleDateString('fr-FR') : '-'}</td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{req.hr_comment || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Split creation form & adjustment table */}
            <div className="split-layout">
              {/* Add user form */}
              <div className="sidebar" style={{ width: '350px' }}>
                <div className="panel">
                  <h2 className="panel-title">👤 Ajouter un Membre</h2>

                  {memberError && <div className="error-message">{memberError}</div>}
                  {memberSuccess && <div className="success-message">Données enregistrées avec succès.</div>}

                  <form onSubmit={handleCreateMember} style={{ padding: 0, border: 'none', background: 'none' }}>
                    <div className="form-group">
                      <label>Nom Complet</label>
                      <input
                        type="text"
                        placeholder="Ex: Rakotoarisoa Dany"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        required
                        disabled={memberLoading}
                      />
                    </div>

                    <div className="form-group">
                      <label>Adresse Email</label>
                      <input
                        type="email"
                        placeholder="votre@mail.com"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        required
                        disabled={memberLoading}
                      />
                    </div>

                    <div className="form-group">
                      <label>Service / Département</label>
                      <select
                        value={newMemberService}
                        onChange={(e) => setNewMemberService(e.target.value)}
                        disabled={memberLoading}
                        required
                      >
                        <option value="Direction">Direction</option>
                        <option value="Admin">Admin</option>
                        <option value="Team leader">Team leader</option>
                        <option value="Web">Web</option>
                        <option value="Graphiste">Graphiste</option>
                        <option value="SEO">SEO</option>
                        <option value="SEA & Data analyst">SEA & Data analyst</option>
                        <option value="Marketing de croissance">Marketing de croissance</option>
                        <option value="Community management">Community management</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Mot de passe d'accès</label>
                      <div className="password-input-wrapper">
                        <input
                          type={showNewMemberPassword ? 'text' : 'password'}
                          placeholder="•••••••• (min 6 caractères)"
                          value={newMemberPassword}
                          onChange={(e) => setNewMemberPassword(e.target.value)}
                          required
                          disabled={memberLoading}
                          minLength={6}
                          style={{ paddingRight: '2.75rem' }}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowNewMemberPassword(!showNewMemberPassword)}
                          disabled={memberLoading}
                          aria-label={showNewMemberPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        >
                          {showNewMemberPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.815 7.815 3 3m-3-3-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Rôle dans le système</label>
                      <select value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)}>
                        <option value="employee">Collaborateur</option>
                        <option value="hr">Administrateur</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Responsable Hiérarchique N+1</label>
                      <select value={newMemberManager} onChange={(e) => setNewMemberManager(e.target.value)}>
                        <option value="Aucun">Aucun (Directeur / RH)</option>
                        {allMembers.map(m => (
                          <option key={m.employee_id} value={m.employee_name}>{m.employee_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Date d'embauche</label>
                      <input
                        type="date"
                        value={newMemberHireDate}
                        onChange={(e) => setNewMemberHireDate(e.target.value)}
                        required
                        disabled={memberLoading}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Solde Initial CP</label>
                        <input
                          type="number"
                          value={newMemberCP}
                          onChange={(e) => setNewMemberCP(e.target.value)}
                          disabled={memberLoading}
                        />
                      </div>
                      <div className="form-group">
                        <label>Solde Initial Perm.</label>
                        <input
                          type="number"
                          value={newMemberPerm}
                          onChange={(e) => setNewMemberPerm(e.target.value)}
                          disabled={memberLoading}
                        />
                      </div>
                    </div>

                    <button type="submit" className="btn-accent" disabled={memberLoading}>
                      {memberLoading ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Adjust balances table */}
              <div className="main-content">
                <div className="panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 className="panel-title" style={{ marginBottom: 0 }}>⚙️ Configuration des équipes & Droits</h2>
                    <button
                      onClick={handleCreditAll}
                      className="btn-secondary btn-small"
                      style={{ color: 'var(--brand-orange)', borderColor: 'var(--brand-orange)', background: '#fff7ed' }}
                    >
                      📅 Créditer +2.5j CP (Début de mois)
                    </button>
                  </div>

                  <div className="table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                          <th>Membre</th>
                          <th>Service</th>
                          <th>Rôle</th>
                          <th>N+1 (Manager)</th>
                          <th>Date d'embauche</th>
                          <th>Ajuster CP</th>
                          <th>Ajuster Perm.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allMembers.map((m) => (
                          <tr key={m.employee_id}>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                                <button
                                  className="btn-icon-edit"
                                  onClick={() => startEditMember(m)}
                                  title="Modifier"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '0.35rem',
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.082a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                  </svg>
                                </button>
                                <button
                                  className="btn-icon-delete"
                                  onClick={() => handleDeleteMember(m.employee_id)}
                                  title="Supprimer"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--error-color)',
                                    cursor: 'pointer',
                                    padding: '0.35rem',
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                            <td>
                              <strong>{m.employee_name}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.employee_email}</div>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                                {(m.service === 'Directeur' ? 'Direction' : m.service) || 'Non spécifié'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge-role ${m.role === 'hr' ? 'hr' : m.role === 'manager' ? 'manager' : m.role === 'director' ? 'director' : 'employee'}`}>
                                {m.role === 'hr' ? 'Administrateur' : m.role === 'manager' ? 'Manager' : m.role === 'director' ? 'Directeur' : 'Collaborateur'}
                              </span>
                            </td>
                            <td>{m.manager_name || 'Aucun'}</td>
                            <td style={{ fontSize: '0.85rem' }}>
                              {m.hire_date ? new Date(m.hire_date).toLocaleDateString('fr-FR') : '-'}
                            </td>
                            <td>
                              <input
                                type="number"
                                className="adjust-input"
                                defaultValue={m.initial_balance}
                                onBlur={(e) => handleAdjustBalance(m.employee_id, 'cp', e.target.value)}
                                disabled={adjustingId === m.employee_id}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="adjust-input"
                                defaultValue={m.initial_perm}
                                onBlur={(e) => handleAdjustBalance(m.employee_id, 'perm', e.target.value)}
                                disabled={adjustingId === m.employee_id}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 4. MODAL: EDIT MEMBER POPUP                         */}
      {/* ==================================================== */}
      {editingMember && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2 className="modal-title">📝 Modifier le Membre</h2>
            <p className="modal-message" style={{ marginBottom: '1.25rem' }}>
              Mettez à jour les informations et soldes initiaux pour <strong>{editingMember.employee_name}</strong>.
            </p>

            {memberError && <div className="error-message">{memberError}</div>}

            <form onSubmit={handleUpdateMember} style={{ padding: 0, border: 'none', background: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Nom Complet</label>
                <input
                  type="text"
                  placeholder="Jean Dupont"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  required
                  disabled={memberLoading}
                />
              </div>

              <div className="form-group">
                <label>Adresse Email</label>
                <input
                  type="email"
                  placeholder="jean.dupont@entreprise.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  required
                  disabled={memberLoading}
                />
              </div>

              <div className="form-group">
                <label>Service / Département</label>
                <select
                  value={newMemberService}
                  onChange={(e) => setNewMemberService(e.target.value)}
                  disabled={memberLoading}
                  required
                >
                  <option value="Direction">Direction</option>
                  <option value="Admin">Admin</option>
                  <option value="Team leader">Team leader</option>
                  <option value="Web">Web</option>
                  <option value="Graphiste">Graphiste</option>
                  <option value="SEO">SEO</option>
                  <option value="SEA & Data analyst">SEA & Data analyst</option>
                  <option value="Marketing de croissance">Marketing de croissance</option>
                  <option value="Community management">Community management</option>
                </select>
              </div>

              <div className="form-group">
                <label>Rôle dans le système</label>
                <select value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)} disabled={memberLoading}>
                  <option value="employee">Collaborateur</option>
                  <option value="hr">Administrateur</option>
                </select>
              </div>

              <div className="form-group">
                <label>Responsable Hiérarchique N+1</label>
                <select value={newMemberManager} onChange={(e) => setNewMemberManager(e.target.value)} disabled={memberLoading}>
                  <option value="Aucun">Aucun (Directeur / RH)</option>
                  {allMembers.filter(m => m.employee_id !== editingMember?.employee_id).map(m => (
                    <option key={m.employee_id} value={m.employee_name}>{m.employee_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Date d'embauche</label>
                <input
                  type="date"
                  value={newMemberHireDate}
                  onChange={(e) => setNewMemberHireDate(e.target.value)}
                  required
                  disabled={memberLoading}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Solde Initial CP</label>
                  <input
                    type="number"
                    value={newMemberCP}
                    onChange={(e) => setNewMemberCP(e.target.value)}
                    disabled={memberLoading}
                  />
                </div>
                <div className="form-group">
                  <label>Solde Initial Perm.</label>
                  <input
                    type="number"
                    value={newMemberPerm}
                    onChange={(e) => setNewMemberPerm(e.target.value)}
                    disabled={memberLoading}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn-accent" style={{ minWidth: '110px' }} disabled={memberLoading}>
                  {memberLoading ? 'Envoi...' : 'Sauvegarder'}
                </button>
                <button type="button" className="btn-secondary" onClick={cancelEditMember} disabled={memberLoading}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. MODAL: CUSTOM CONFIRM POPUP                      */}
      {/* ==================================================== */}
      {confirmModal.isOpen && (
        <div className="modal-backdrop" style={{ zIndex: 110 }}>
          <div className="modal-content modal-content-small">
            <h2 className="modal-title">🛡️ {confirmModal.title}</h2>
            <p className="modal-message" style={{ marginBottom: '1.5rem' }}>{confirmModal.message}</p>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-accent"
                onClick={confirmModal.onConfirm}
              >
                Confirmer
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
