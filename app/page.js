'use client';

import { useEffect, useState, useRef } from 'react';
import { supabaseClient } from '../lib/supabaseClient';
import { splitFullName, isMadagascarHoliday, calculateBusinessDays } from '../lib/utils';
import { SyncQueueManager } from '../lib/syncQueue';
import {
  Clock,
  Download,
  Sun,
  Moon,
  LogOut,
  ClipboardList,
  PlusCircle,
  History,
  AlertTriangle,
  Search,
  UserPlus,
  XCircle,
  Timer,
  LogIn,
  Edit,
  ShieldAlert,
  Smartphone,
  ChevronDown
} from 'lucide-react';

const formatDateStr = (str) => {
  if (!str) return '-';
  const parts = str.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return str;
};

const getTodayDateString = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const local = new Date(utc + (3600000 * 3)); // Madagascar UTC+3
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
};

export default function Page() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');

  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const syncQueueRef = useRef(null);
  const lastLoadedDateRef = useRef(null);

  useEffect(() => {
    syncQueueRef.current = new SyncQueueManager({
      getToken: () => tokenRef.current,
      debounceMs: 3000,
      maxBatchSize: 10,
      onSyncStart: () => {
        console.log('[Sync] Synchronisation en cours...');
      },
      onSyncSuccess: (result) => {
        console.log('[Sync] Synchronisation réussie !', result);
      },
      onSyncError: (error) => {
        console.error('[Sync] Erreur de synchronisation :', error);
      },
      onRollback: (failedMutations) => {
        console.warn('[Sync] Échec de synchronisation (Rollback) :', failedMutations);
        setAllMembers(prevMembers => {
          const updated = [...prevMembers];
          for (const m of failedMutations) {
            const index = updated.findIndex(u => u.employee_id === m.employeeId);
            if (index !== -1) {
              const fieldKey = m.field === 'cp' ? 'initial_balance' : 'initial_perm';
              const remainingKey = m.field === 'cp' ? 'remaining_balance' : 'remaining_perm';
              const takenKey = m.field === 'cp' ? 'taken_days' : 'taken_perm';
              const takenVal = parseFloat(updated[index][takenKey] || 0);
              const oldInitialVal = parseFloat(m.oldValue || 0);

              updated[index] = {
                ...updated[index],
                [fieldKey]: oldInitialVal,
                [remainingKey]: oldInitialVal - takenVal
              };
            }
          }
          return updated;
        });

        // Rollback current user's balance
        for (const m of failedMutations) {
          if (m.employeeId === userRef.current?.id) {
            setBalance(prevBalance => {
              const fieldKey = m.field === 'cp' ? 'initial_balance' : 'initial_perm';
              const remainingKey = m.field === 'cp' ? 'remaining_balance' : 'remaining_perm';
              const takenKey = m.field === 'cp' ? 'taken_days' : 'taken_perm';
              const takenVal = parseFloat(prevBalance[takenKey] || 0);
              const oldInitialVal = parseFloat(m.oldValue || 0);

              return {
                ...prevBalance,
                [fieldKey]: oldInitialVal,
                [remainingKey]: oldInitialVal - takenVal
              };
            });
          }
        }
      }
    });
  }, []);

  // Navigation
  const [activeTab, setActiveTab] = useState('mySpace'); // 'mySpace', 'globalDashboard', 'adminRH'
  const [ganttServiceFilter, setGanttServiceFilter] = useState('Tous');
  const [adminServiceFilter, setAdminServiceFilter] = useState('Tous');

  // Dark/Light Mode state
  const [darkMode, setDarkMode] = useState(false);

  // Menu burger & PWA installation states
  const [menuOpen, setMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showiOSInstallModal, setShowiOSInstallModal] = useState(false);

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
  const [newMemberLastName, setNewMemberLastName] = useState('');
  const [newMemberFirstName, setNewMemberFirstName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [showNewMemberPassword, setShowNewMemberPassword] = useState(false);
  const [newMemberService, setNewMemberService] = useState('Direction');
  const [newMemberRole, setNewMemberRole] = useState('employee');
  const [newMemberManager, setNewMemberManager] = useState('Aucun');
  const [newMemberCP, setNewMemberCP] = useState('25');
  const [newMemberPerm, setNewMemberPerm] = useState('5');
  const [newMemberHireDate, setNewMemberHireDate] = useState('');

  // Schedule States
  const [newMemberDefaultArrival, setNewMemberDefaultArrival] = useState('08:00');
  const [newMemberDefaultDeparture, setNewMemberDefaultDeparture] = useState('17:00');
  const [newMemberCustomSchedule, setNewMemberCustomSchedule] = useState(false);
  const [newMemberMonArrival, setNewMemberMonArrival] = useState('08:00');
  const [newMemberMonDeparture, setNewMemberMonDeparture] = useState('17:00');
  const [newMemberTueArrival, setNewMemberTueArrival] = useState('08:00');
  const [newMemberTueDeparture, setNewMemberTueDeparture] = useState('17:00');
  const [newMemberWedArrival, setNewMemberWedArrival] = useState('08:00');
  const [newMemberWedDeparture, setNewMemberWedDeparture] = useState('17:00');
  const [newMemberThuArrival, setNewMemberThuArrival] = useState('08:00');
  const [newMemberThuDeparture, setNewMemberThuDeparture] = useState('17:00');
  const [newMemberFriArrival, setNewMemberFriArrival] = useState('08:00');
  const [newMemberFriDeparture, setNewMemberFriDeparture] = useState('17:00');
  const [newMemberSatArrival, setNewMemberSatArrival] = useState('08:00');
  const [newMemberSatDeparture, setNewMemberSatDeparture] = useState('12:00');

  // Pointage States
  const [pointageDate, setPointageDate] = useState(getTodayDateString());
  const [pointageSearchQuery, setPointageSearchQuery] = useState('');
  const [pointageServiceFilter, setPointageServiceFilter] = useState('Tous');
  const [pointageEmployees, setPointageEmployees] = useState([]);
  const [pointageStats, setPointageStats] = useState(null);
  const [pointageLoading, setPointageLoading] = useState(false);
  const [clockingEmployeeId, setClockingEmployeeId] = useState(null);
  const [pointageSubTab, setPointageSubTab] = useState('expected');

  // Pagination / Limit States
  const [globalDashboardLimit, setGlobalDashboardLimit] = useState(5);
  const [adminRHLimit, setAdminRHLimit] = useState(5);
  const [pointageExpectedLimit, setPointageExpectedLimit] = useState(5);
  const [pointagePresentLimit, setPointagePresentLimit] = useState(5);

  const [memberError, setMemberError] = useState(null);
  const [memberSuccess, setMemberSuccess] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [allRequests, setAllRequests] = useState([]);
  const [editingLeave, setEditingLeave] = useState(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editLeaveType, setEditLeaveType] = useState('Congés Payés');
  const [editLeaveError, setEditLeaveError] = useState(null);
  const [editLeaveLoading, setEditLeaveLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const monthRequests = allRequests.filter(req => req.start_date <= monthEnd && req.end_date >= monthStart && req.status !== 'Refusé');

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
      day.dateString >= req.start_date && day.dateString <= req.end_date && req.status !== 'Refusé'
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

  const servicesOrder = [
    'Direction',
    'Admin',
    'Team leader',
    'Web',
    'Graphiste',
    'SEO',
    'SEA & Data analyst',
    'Marketing de croissance',
    'Community management',
    'Commercial',
    'Pointeur'
  ];

  const uniqueServices = ['Tous', ...new Set([
    ...servicesOrder,
    ...allMembers.map(m => (m.service === 'Directeur' ? 'Direction' : m.service) || 'Non spécifié')
  ])];

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

  useEffect(() => {
    if (balance && balance.service === 'Pointeur') {
      setActiveTab('pointage');
    }
  }, [balance]);

  useEffect(() => {
    const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
    // Always show the button for testing unless already running standalone
    setIsInstallable(!isStandalone);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      setShowiOSInstallModal(true);
      setMenuOpen(false);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } else {
      // General instructions alert/modal for non-iOS browsers when deferredPrompt is not yet ready
      alert("Pour installer l'application sur Android ou Ordinateur :\n\n1. Cliquez sur les 3 points verticaux de votre navigateur (Chrome/Edge).\n2. Sélectionnez l'option 'Ajouter à l'écran d'accueil' ou 'Installer l'application'.");
    }
    setMenuOpen(false);
  };

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

  const getProjectedBalance = (m, targetDate) => {
    const defaultRes = {
      cp: m.remaining_balance,
      perm: m.remaining_perm,
      cpBreakdown: '',
      permBreakdown: ''
    };

    if (!m.hire_date) return defaultRes;

    const parts = m.hire_date.split('-');
    if (parts.length !== 3) return defaultRes;
    const hireYear = parseInt(parts[0], 10);
    const hireMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
    const hireDay = parseInt(parts[2], 10);

    const today = new Date();
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const targetEnd = new Date(year, month + 1, 0); // last day of target month

    let cpMonthly = 0;
    let cpAnniversary = 0;

    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const targetEndUTC = new Date(Date.UTC(targetEnd.getFullYear(), targetEnd.getMonth(), targetEnd.getDate()));

    // 1. Monthly Accrual: Removed
    const todayMonthIndex = todayUTC.getUTCFullYear() * 12 + todayUTC.getUTCMonth();
    const targetMonthIndex = targetEndUTC.getUTCFullYear() * 12 + targetEndUTC.getUTCMonth();
    const monthsDiff = targetMonthIndex - todayMonthIndex;

    // 2. Anniversary Accrual: +30j per contract anniversary
    if (targetEndUTC > todayUTC) {
      // Future: add anniversaries that occur after today and before or equal to targetEnd
      for (let y = todayUTC.getUTCFullYear(); y <= targetEndUTC.getUTCFullYear(); y++) {
        const ann = new Date(Date.UTC(y, hireMonth, hireDay));
        if (ann > todayUTC && ann <= targetEndUTC) {
          cpAnniversary += 30;
        }
      }
    } else if (targetEndUTC < todayUTC) {
      // Past: subtract anniversaries that occur after targetEnd and before or equal to today
      for (let y = targetEndUTC.getUTCFullYear(); y <= todayUTC.getUTCFullYear(); y++) {
        const ann = new Date(Date.UTC(y, hireMonth, hireDay));
        if (ann > targetEndUTC && ann <= todayUTC) {
          cpAnniversary -= 30;
        }
      }
    }

    let overlapCP = 0;
    let overlapPerm = 0;

    const employeeReqs = allRequests.filter(req => req.employee_id === m.employee_id && req.status !== 'Refusé');

    employeeReqs.forEach(req => {
      const isNoDeduct = req.leave_type.toLowerCase().includes('sans solde') ||
        req.leave_type.toLowerCase().includes('rattraper') ||
        req.leave_type.toLowerCase().includes('maladie');
      if (isNoDeduct) return;

      const isPermission = req.leave_type.toLowerCase().includes('perm');

      // Calculate total business days of the request using current calculation rules
      let totalDays = 0;
      try {
        totalDays = calculateBusinessDays(req.start_date, req.end_date);
      } catch (e) { }

      if (totalDays > 0) {
        const reqBusinessDays = parseFloat(req.business_days || 0);

        if (req.status === 'Approuvé') {
          // Calculate portion after targetEnd
          const targetEndStr = `${targetEnd.getFullYear()}-${String(targetEnd.getMonth() + 1).padStart(2, '0')}-${String(targetEnd.getDate()).padStart(2, '0')}`;
          if (req.end_date > targetEndStr) {
            // Find start of the portion after targetEnd
            const nextDay = new Date(targetEnd);
            nextDay.setDate(targetEnd.getDate() + 1);
            const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;

            const overlapStart = req.start_date > nextDayStr ? req.start_date : nextDayStr;
            let afterDays = 0;
            try {
              afterDays = calculateBusinessDays(overlapStart, req.end_date);
            } catch (e) { }

            const fraction = afterDays / totalDays;
            if (!isPermission) {
              overlapCP -= reqBusinessDays * fraction; // Subtracting negative overlap means adding back!
            } else {
              overlapPerm -= reqBusinessDays * fraction;
            }
          }
        } else if (req.status === 'En attente') {
          // Calculate portion before or on targetEnd
          const targetEndStr = `${targetEnd.getFullYear()}-${String(targetEnd.getMonth() + 1).padStart(2, '0')}-${String(targetEnd.getDate()).padStart(2, '0')}`;
          if (req.start_date <= targetEndStr) {
            const overlapEnd = req.end_date < targetEndStr ? req.end_date : targetEndStr;
            let beforeDays = 0;
            try {
              beforeDays = calculateBusinessDays(req.start_date, overlapEnd);
            } catch (e) { }

            const fraction = beforeDays / totalDays;
            if (isPermission) {
              overlapPerm += reqBusinessDays * fraction;
            } else {
              overlapCP += reqBusinessDays * fraction;
            }
          }
        }
      }
    });

    const projectedCP = m.remaining_balance + cpMonthly + cpAnniversary - overlapCP;
    const projectedPerm = m.remaining_perm - overlapPerm;

    // Build human readable breakdown texts
    let cpAnniversaryForBreakdown = 0;
    if (targetDate.getMonth() === hireMonth && targetDate.getFullYear() > hireYear) {
      if (monthsDiff > 0) {
        cpAnniversaryForBreakdown = 30;
      } else if (monthsDiff < 0) {
        cpAnniversaryForBreakdown = -30;
      }
    }

    const cpParts = [];
    if (cpAnniversaryForBreakdown !== 0) cpParts.push(`${cpAnniversaryForBreakdown > 0 ? '+' : ''}${cpAnniversaryForBreakdown}j anniv.`);

    return {
      cp: parseFloat(Math.max(0, projectedCP).toFixed(1)),
      perm: parseFloat(Math.max(0, projectedPerm).toFixed(1)),
      cpBreakdown: cpParts.length > 0 ? cpParts.join(', ') : '',
      permBreakdown: ''
    };
  };

  const userRole = user?.app_metadata?.role || user?.user_metadata?.role || 'employee';

  // 2. Fetch all required data dynamically based on active tab and role
  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      // 2a. Fetch personal balance
      let currentService = '';
      const balanceRes = await fetch('/api/leaves/balance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalance(balanceData);
        currentService = balanceData.service;
      }

      // Skip heavy lists loading for the timekeeper (Pointeur) role
      if (currentService !== 'Pointeur') {
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

  // 2e. Initialize and synchronize drag-and-drop member ordering from localStorage
  const [memberOrder, setMemberOrder] = useState([]);
  const [draggedMemberId, setDraggedMemberId] = useState(null);
  const [dragOverMemberId, setDragOverMemberId] = useState(null);

  useEffect(() => {
    if (allMembers.length > 0) {
      const stored = localStorage.getItem('memberOrder');
      let order = [];
      if (stored) {
        try {
          order = JSON.parse(stored);
        } catch (e) {
          console.error('Error parsing memberOrder:', e);
        }
      }

      const servicesOrder = [
        'Direction',
        'Admin',
        'Team leader',
        'Web',
        'Graphiste',
        'SEO',
        'SEA & Data analyst',
        'Marketing de croissance',
        'Community management',
        'Commercial',
        'Pointeur'
      ];

      const defaultSorted = [...allMembers].sort((a, b) => {
        const serviceA = a.service === 'Directeur' ? 'Direction' : a.service;
        const serviceB = b.service === 'Directeur' ? 'Direction' : b.service;
        const indexA = servicesOrder.indexOf(serviceA);
        const indexB = servicesOrder.indexOf(serviceB);

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return (a.employee_first_name || '').localeCompare(b.employee_first_name || '');
      });

      const allActiveIds = new Set(allMembers.map(m => m.employee_id));
      let cleanedOrder = order.filter(id => allActiveIds.has(id));

      const orderedIds = new Set(cleanedOrder);
      const missingIds = defaultSorted
        .map(m => m.employee_id)
        .filter(id => !orderedIds.has(id));

      const finalOrder = [...cleanedOrder, ...missingIds];

      setMemberOrder(finalOrder);
      localStorage.setItem('memberOrder', JSON.stringify(finalOrder));
    }
  }, [allMembers]);

  const handleReorderMembers = (draggedId, targetId) => {
    setMemberOrder(prevOrder => {
      const newOrder = [...prevOrder];
      const fromIdx = newOrder.indexOf(draggedId);
      const toIdx = newOrder.indexOf(targetId);

      if (fromIdx !== -1 && toIdx !== -1) {
        newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, draggedId);
        localStorage.setItem('memberOrder', JSON.stringify(newOrder));
      }
      return newOrder;
    });
  };

  // 3. Submit Leave Request
  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    if (!reason || !reason.trim()) {
      setSubmitError('Le motif / justification est obligatoire.');
      return;
    }

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

  const getWorkSchedulePayload = () => {
    const schedule = {
      default: { arrival: newMemberDefaultArrival, departure: newMemberDefaultDeparture }
    };
    if (newMemberCustomSchedule) {
      schedule.Mon = { arrival: newMemberMonArrival, departure: newMemberMonDeparture };
      schedule.Tue = { arrival: newMemberTueArrival, departure: newMemberTueDeparture };
      schedule.Wed = { arrival: newMemberWedArrival, departure: newMemberWedDeparture };
      schedule.Thu = { arrival: newMemberThuArrival, departure: newMemberThuDeparture };
      schedule.Fri = { arrival: newMemberFriArrival, departure: newMemberFriDeparture };
      schedule.Sat = { arrival: newMemberSatArrival, departure: newMemberSatDeparture };
    }
    return schedule;
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
          name: newMemberLastName,
          firstName: newMemberFirstName,
          role: newMemberRole,
          manager_name: newMemberManager,
          initial_balance: parseFloat(newMemberCP || 0),
          initial_perm: parseFloat(newMemberPerm || 0),
          password: newMemberPassword,
          service: newMemberService,
          hire_date: newMemberHireDate,
          work_schedule: getWorkSchedulePayload()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setMemberError(data.error || 'Erreur lors de la création du membre.');
      } else {
        setMemberSuccess(true);
        setNewMemberLastName('');
        setNewMemberFirstName('');
        setNewMemberEmail('');
        setNewMemberPassword('');
        setShowNewMemberPassword(false);
        setNewMemberCP('25');
        setNewMemberPerm('5');
        setNewMemberHireDate('');
        setNewMemberManager('Aucun');
        setNewMemberService('Direction');

        // Reset schedules
        setNewMemberDefaultArrival('08:00');
        setNewMemberDefaultDeparture('17:00');
        setNewMemberCustomSchedule(false);
        setNewMemberMonArrival('08:00');
        setNewMemberMonDeparture('17:00');
        setNewMemberTueArrival('08:00');
        setNewMemberTueDeparture('17:00');
        setNewMemberWedArrival('08:00');
        setNewMemberWedDeparture('17:00');
        setNewMemberThuArrival('08:00');
        setNewMemberThuDeparture('17:00');
        setNewMemberFriArrival('08:00');
        setNewMemberFriDeparture('17:00');
        setNewMemberSatArrival('08:00');
        setNewMemberSatDeparture('12:00');

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
    setNewMemberLastName(m.employee_name || '');
    setNewMemberFirstName(m.employee_first_name || '');
    setNewMemberEmail(m.employee_email);
    setNewMemberRole(m.role || 'employee');
    setNewMemberManager(m.manager_name || 'Aucun');
    setNewMemberCP(m.initial_balance.toString());
    setNewMemberPerm((m.initial_perm || 5).toString());
    setNewMemberService(m.service || 'Non spécifié');
    setNewMemberHireDate(m.hire_date || '');

    // Parse work schedule
    const schedule = m.work_schedule || {};
    const defaultSchedule = schedule.default || { arrival: '08:00', departure: '17:00' };

    setNewMemberDefaultArrival(defaultSchedule.arrival || '08:00');
    setNewMemberDefaultDeparture(defaultSchedule.departure || '17:00');

    const isCustom = !!(schedule.Mon || schedule.Tue || schedule.Wed || schedule.Thu || schedule.Fri || schedule.Sat);
    setNewMemberCustomSchedule(isCustom);

    setNewMemberMonArrival((schedule.Mon && schedule.Mon.arrival) || '08:00');
    setNewMemberMonDeparture((schedule.Mon && schedule.Mon.departure) || '17:00');
    setNewMemberTueArrival((schedule.Tue && schedule.Tue.arrival) || '08:00');
    setNewMemberTueDeparture((schedule.Tue && schedule.Tue.departure) || '17:00');
    setNewMemberWedArrival((schedule.Wed && schedule.Wed.arrival) || '08:00');
    setNewMemberWedDeparture((schedule.Wed && schedule.Wed.departure) || '17:00');
    setNewMemberThuArrival((schedule.Thu && schedule.Thu.arrival) || '08:00');
    setNewMemberThuDeparture((schedule.Thu && schedule.Thu.departure) || '17:00');
    setNewMemberFriArrival((schedule.Fri && schedule.Fri.arrival) || '08:00');
    setNewMemberFriDeparture((schedule.Fri && schedule.Fri.departure) || '17:00');
    setNewMemberSatArrival((schedule.Sat && schedule.Sat.arrival) || '08:00');
    setNewMemberSatDeparture((schedule.Sat && schedule.Sat.departure) || '12:00');

    // Clear alerts
    setMemberError(null);
    setMemberSuccess(false);
  };

  // 6. Cancel Edit Mode
  const cancelEditMember = () => {
    setEditingMember(null);
    setNewMemberLastName('');
    setNewMemberFirstName('');
    setNewMemberEmail('');
    setNewMemberRole('employee');
    setNewMemberManager('Aucun');
    setNewMemberCP('25');
    setNewMemberPerm('5');
    setNewMemberService('Direction');
    setNewMemberHireDate('');

    // Reset schedules
    setNewMemberDefaultArrival('08:00');
    setNewMemberDefaultDeparture('17:00');
    setNewMemberCustomSchedule(false);
    setNewMemberMonArrival('08:00');
    setNewMemberMonDeparture('17:00');
    setNewMemberTueArrival('08:00');
    setNewMemberTueDeparture('17:00');
    setNewMemberWedArrival('08:00');
    setNewMemberWedDeparture('17:00');
    setNewMemberThuArrival('08:00');
    setNewMemberThuDeparture('17:00');
    setNewMemberFriArrival('08:00');
    setNewMemberFriDeparture('17:00');
    setNewMemberSatArrival('08:00');
    setNewMemberSatDeparture('12:00');
  };

  // 6.5 Leave Edit/Delete Actions
  const startEditLeave = (req) => {
    setEditingLeave(req);
    const parseDateToInputVal = (dStr) => {
      if (!dStr) return '';
      const parts = dStr.split('/');
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      return dStr;
    };
    setEditStartDate(parseDateToInputVal(req.start_date));
    setEditEndDate(parseDateToInputVal(req.end_date));
    setEditLeaveType(req.leave_type);
    setEditLeaveError(null);
  };

  const handleUpdateLeave = async (e) => {
    e.preventDefault();
    setEditLeaveError(null);
    setEditLeaveLoading(true);

    try {
      const res = await fetch('/api/leaves/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          request_id: editingLeave.request_id,
          start_date: editStartDate,
          end_date: editEndDate,
          leave_type: editLeaveType
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setEditLeaveError(data.error || 'Erreur lors de la modification.');
      } else {
        setEditingLeave(null);
        fetchDashboardData();
      }
    } catch (err) {
      setEditLeaveError('Une erreur réseau est survenue.');
    } finally {
      setEditLeaveLoading(false);
    }
  };

  const handleDeleteLeave = (requestId) => {
    triggerConfirm(
      'Suppression de la demande',
      'Êtes-vous sûr de vouloir supprimer cette demande de congé ?',
      async () => {
        try {
          const res = await fetch('/api/leaves/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              request_id: requestId
            })
          });

          const data = await res.json();
          if (!res.ok) {
            alert(data.error || 'Erreur lors de la suppression.');
          } else {
            fetchDashboardData();
          }
        } catch (err) {
          alert('Une erreur réseau est survenue.');
        }
      }
    );
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
          name: newMemberLastName,
          firstName: newMemberFirstName,
          email: newMemberEmail,
          role: newMemberRole,
          manager_name: newMemberManager,
          initial_balance: parseFloat(newMemberCP || 0),
          initial_perm: parseFloat(newMemberPerm || 0),
          service: newMemberService,
          hire_date: newMemberHireDate,
          work_schedule: getWorkSchedulePayload()
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

  // 7.5 Time logs & Pointage Handlers
  const fetchPointageData = async (forceSpinner = false) => {
    if (!token) return;

    const hasData = pointageEmployees && pointageEmployees.length > 0;
    const dateChanged = lastLoadedDateRef.current !== pointageDate;

    // Only display spinner if we don't have local data yet or if date changed
    if (forceSpinner || !hasData || dateChanged) {
      setPointageLoading(true);
    }

    try {
      const logsRes = await fetch(`/api/time-logs?date=${pointageDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setPointageEmployees(logsData.employees || []);
        lastLoadedDateRef.current = pointageDate;
      }

      if (balance?.service !== 'Pointeur') {
        const statsRes = await fetch('/api/time-logs/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setPointageStats(statsData);
        }
      }
    } catch (err) {
      console.error('Error fetching pointage data:', err);
    } finally {
      setPointageLoading(false);
    }
  };

  useEffect(() => {
    if (user && token && activeTab === 'pointage') {
      fetchPointageData();
    }
  }, [user, token, activeTab, pointageDate]);

  const handleClockIn = async (employeeId) => {
    if (!token) return;

    const empIndex = pointageEmployees.findIndex(emp => emp.employee_id === employeeId);
    if (empIndex === -1) return;

    const emp = pointageEmployees[empIndex];

    // Compute current local time in Madagascar (UTC+3)
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const localTime = new Date(utc + (3600000 * 3));
    const nowTimeStr = `${String(localTime.getHours()).padStart(2, '0')}:${String(localTime.getMinutes()).padStart(2, '0')}`;

    // Determine scheduled clock-in for status logic
    const dateObj = new Date(pointageDate);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayOfWeek = days[dateObj.getDay()];

    const schedule = emp.work_schedule || {};
    const defaultSchedule = schedule.default || { arrival: '08:00', departure: '17:00' };
    const daySchedule = schedule[dayOfWeek] || defaultSchedule;
    const scheduledClockIn = daySchedule.arrival || '08:00';

    const [inH, inM] = nowTimeStr.split(':').map(Number);
    const [schedH, schedM] = scheduledClockIn.split(':').map(Number);

    let status = 'Présent';
    if ((inH * 60 + inM) > (schedH * 60 + schedM)) {
      status = 'En retard';
    }

    // Keep original copy for potential rollback
    const originalEmployees = [...pointageEmployees];

    // 1. Optimistic Update: Add clock-in data locally immediately
    const updatedEmployees = [...pointageEmployees];
    updatedEmployees[empIndex] = {
      ...emp,
      time_log: {
        ...(emp.time_log || {}),
        clock_in: nowTimeStr,
        status: status
      }
    };
    setPointageEmployees(updatedEmployees);

    // 2. Perform API request in background
    try {
      const res = await fetch('/api/time-logs/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          employee_id: employeeId,
          date: pointageDate,
          clock_in_time: nowTimeStr
        })
      });

      if (!res.ok) {
        // Rollback state on error
        setPointageEmployees(originalEmployees);
        const errData = await res.json();
        alert(errData.error || 'Erreur lors du pointage.');
      }
    } catch (err) {
      console.error('Clock-in failed:', err);
      setPointageEmployees(originalEmployees);
    }
  };

  const handleClockOut = async (employeeId) => {
    if (!token) return;

    const empIndex = pointageEmployees.findIndex(emp => emp.employee_id === employeeId);
    if (empIndex === -1) return;

    const emp = pointageEmployees[empIndex];

    // Compute current local time in Madagascar (UTC+3)
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const localTime = new Date(utc + (3600000 * 3));
    const nowTimeStr = `${String(localTime.getHours()).padStart(2, '0')}:${String(localTime.getMinutes()).padStart(2, '0')}`;

    const originalEmployees = [...pointageEmployees];

    // 1. Optimistic Update: Add clock-out locally immediately
    const updatedEmployees = [...pointageEmployees];
    updatedEmployees[empIndex] = {
      ...emp,
      time_log: {
        ...(emp.time_log || {}),
        clock_out: nowTimeStr
      }
    };
    setPointageEmployees(updatedEmployees);

    // 2. Perform API request in background
    try {
      const res = await fetch('/api/time-logs/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          employee_id: employeeId,
          date: pointageDate,
          clock_out_time: nowTimeStr
        })
      });

      if (!res.ok) {
        // Rollback state on error
        setPointageEmployees(originalEmployees);
        const errData = await res.json();
        alert(errData.error || 'Erreur lors du pointage.');
      }
    } catch (err) {
      console.error('Clock-out failed:', err);
      setPointageEmployees(originalEmployees);
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
  const handleAdjustBalance = (employeeId, type, value) => {
    setHrError(null);
    setHrSuccess(null);

    const numericValue = parseFloat(value || 0);
    if (isNaN(numericValue) || numericValue < 0) {
      setHrError('La valeur doit être un nombre positif valide.');
      return;
    }

    // 1. Trouver le membre actuel pour récupérer l'ancienne valeur (pour le rollback)
    const member = allMembers.find(m => m.employee_id === employeeId);
    const fieldKey = type.toLowerCase() === 'cp' ? 'initial_balance' : 'initial_perm';
    const remainingKey = type.toLowerCase() === 'cp' ? 'remaining_balance' : 'remaining_perm';
    const takenKey = type.toLowerCase() === 'cp' ? 'taken_days' : 'taken_perm';

    const oldValue = parseFloat(member ? member[fieldKey] : 0);

    // 2. Mettre à jour l'état local React de manière optimiste
    setAllMembers(prevMembers => {
      return prevMembers.map(m => {
        if (m.employee_id === employeeId) {
          const takenVal = parseFloat(m[takenKey] || 0);
          return {
            ...m,
            [fieldKey]: numericValue,
            [remainingKey]: numericValue - takenVal
          };
        }
        return m;
      });
    });

    // 3. Mettre à jour le propre solde de l'utilisateur si c'est lui
    if (employeeId === userRef.current?.id) {
      setBalance(prevBalance => {
        const takenVal = parseFloat(prevBalance[takenKey] || 0);
        return {
          ...prevBalance,
          [fieldKey]: numericValue,
          [remainingKey]: numericValue - takenVal
        };
      });
    }

    // 4. Enregistrer dans la file de synchronisation
    if (syncQueueRef.current) {
      syncQueueRef.current.enqueue({
        type: 'adjust-balance',
        employeeId,
        field: type.toLowerCase(),
        value: numericValue,
        oldValue: oldValue
      });
      setHrSuccess('Modifications enregistrées localement (synchronisation en cours...)');
    } else {
      setHrError('Le gestionnaire de synchronisation n\'est pas disponible.');
    }
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

  const profileLoaded = !!balance.employee_id;

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
            <Clock size={14} className="kpi-pulse-icon" style={{ marginRight: '0.25rem' }} />
            <span>{pendingRequests.length} en attente</span>
          </div>
        )}

        <div className="session-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: (userRole === 'hr' || userRole === 'manager' || userRole === 'director') && pendingRequests.length > 0 ? '0' : 'auto' }}>
          <span><strong>{balance.employee_first_name || (user?.user_metadata?.full_name ? splitFullName(user.user_metadata.full_name).firstName : '') || user?.email}</strong></span>
          <span className={`badge-role ${userRole === 'hr' ? 'hr' : userRole === 'manager' ? 'manager' : userRole === 'director' ? 'director' : 'employee'}`} style={{ marginLeft: '0.25rem' }}>
            {userRole === 'hr' ? 'Administrateur' : userRole === 'manager' ? 'Manager' : userRole === 'director' ? 'Directeur' : 'Collaborateur'}
          </span>

          {/* Burger Menu Button & Dropdown */}
          <div style={{ position: 'relative', marginLeft: '0.75rem' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="logout-btn-header burger-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.45rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--panel-white)',
                cursor: 'pointer',
                width: '38px',
                height: '38px',
                color: 'var(--text-primary)',
                boxShadow: 'none',
                marginTop: 0
              }}
              title="Menu Options"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 90 }}
                />
                <div
                  className="burger-dropdown"
                  style={{
                    position: 'absolute',
                    top: '46px',
                    right: 0,
                    backgroundColor: 'var(--panel-white)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    padding: '0.5rem',
                    minWidth: '220px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    zIndex: 100,
                    animation: 'fadeIn 0.15s ease-out'
                  }}
                >
                  {isInstallable && (
                    <button
                      onClick={handleInstallClick}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        padding: '0.6rem 1rem',
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: '8px',
                        boxShadow: 'none',
                        marginTop: 0
                      }}
                      className="menu-item-hover"
                    >
                      <Download size={16} style={{ color: 'var(--brand-orange)' }} /> Installer l'application
                    </button>
                  )}

                  <button
                    onClick={() => {
                      toggleDarkMode();
                      setMenuOpen(false);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      padding: '0.6rem 1rem',
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      borderRadius: '8px',
                      boxShadow: 'none',
                      marginTop: 0
                    }}
                    className="menu-item-hover"
                  >
                    {darkMode ? (
                      <>
                        <Sun size={16} style={{ color: 'var(--brand-orange)' }} /> Mode Clair
                      </>
                    ) : (
                      <>
                        <Moon size={16} style={{ color: 'var(--brand-orange)' }} /> Mode Sombre
                      </>
                    )}
                  </button>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '0.25rem 0' }} />

                  <button
                    onClick={handleLogout}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--error-color)',
                      padding: '0.6rem 1rem',
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      borderRadius: '8px',
                      boxShadow: 'none',
                      marginTop: 0
                    }}
                    className="menu-item-hover-danger"
                  >
                    <LogOut size={16} /> Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="app-container">
        {/* --- TABS SELECTOR --- */}
        <div className="nav-tabs">
          {profileLoaded ? (
            <>
              {balance?.service !== 'Pointeur' && (
                <>
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
                </>
              )}
              {(userRole === 'hr' || userRole === 'manager' || userRole === 'director' || balance?.service === 'Pointeur') && (
                <>
                  {balance?.service !== 'Pointeur' && (
                    <button
                      className={`tab-button ${activeTab === 'adminRH' ? 'active' : ''}`}
                      onClick={() => setActiveTab('adminRH')}
                    >
                      Administration RH
                    </button>
                  )}
                  <button
                    className={`tab-button ${activeTab === 'pointage' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pointage')}
                  >
                    Pointage
                  </button>
                </>
              )}
            </>
          ) : (
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>Chargement du profil...</span>
          )}
        </div>

        {/* ==================================================== */}
        {/* 1. TAB CONTENT: MON ESPACE                          */}
        {/* ==================================================== */}
        {profileLoaded && activeTab === 'mySpace' && balance?.service !== 'Pointeur' && (
          <div className="split-layout">
            {/* Sidebar with Balance & Request Form */}
            <div className="sidebar">
              <div className="panel">
                <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ClipboardList size={18} style={{ color: 'var(--brand-orange)' }} /> Mes soldes restants</h2>
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
                <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><PlusCircle size={18} style={{ color: 'var(--brand-orange)' }} /> Déposer une demande</h2>

                <form onSubmit={handleSubmitLeave} style={{ padding: 0, border: 'none', background: 'none' }}>
                  <div className="form-group">
                    <label>Type de congé</label>
                    <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                      <option value="CP">Congé Payé</option>
                      <option value="Congé Sans Solde">Congé Sans Solde</option>
                      <option value="Permission">Permission Spéciale</option>
                      <option value="Permission à rattraper">Permission à rattraper</option>
                      <option value="Maladie">Congé Maladie</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date de début</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Heure de début</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date de fin</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Heure de fin</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Motif</label>
                    <textarea
                      placeholder="Raison..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                    />
                  </div>

                  {submitError && <div className="error-message" style={{ marginTop: '1rem', marginBottom: '1rem' }}>{submitError}</div>}
                  {submitSuccess && <div className="success-message" style={{ marginTop: '1rem', marginBottom: '1rem' }}>Votre demande a été soumise.</div>}

                  <button type="submit" className="btn-accent" disabled={submitting}>
                    {submitting ? 'Envoi...' : 'Soumettre la demande'}
                  </button>
                </form>
              </div>
            </div>

            {/* Main Content with request history */}
            <div className="main-content">
              <div className="panel">
                <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><History size={18} style={{ color: 'var(--brand-orange)' }} /> Suivi de mes demandes</h2>

                {myRequests.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    Aucune demande enregistrée.
                  </p>
                ) : (
                  <div className="table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
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
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {req.status === 'En attente' ? (
                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    className="btn-icon-edit"
                                    onClick={() => startEditLeave(req)}
                                    title="Modifier la demande"
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
                                    onClick={() => handleDeleteLeave(req.request_id)}
                                    title="Supprimer la demande"
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
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                              )}
                            </td>
                            <td>
                              <strong style={{ color: 'var(--brand-orange)' }}>{req.leave_type}</strong>
                            </td>
                            <td>
                              Du {formatDateStr(req.start_date)}<br />
                              Au {formatDateStr(req.end_date)}
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
        {profileLoaded && activeTab === 'globalDashboard' && balance?.service !== 'Pointeur' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* KPIs grids */}
            {(userRole === 'hr' || userRole === 'manager' || userRole === 'director') && (
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
            )}



            {/* Calendrier des départs & Superpositions en format Gantt */}
            <div className="panel">
              <h2 className="panel-title">Calendrier des départs et superpositions</h2>
              <p className="panel-subtitle">Visualisation mensuelle sous forme de planning Gantt et détection des conflits par service.</p>

              <div className="gantt-container">
                {/* Gantt Header Nav */}
                <div className="gantt-header">
                  <span className="gantt-month-title">
                    {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Service</label>
                      <select
                        value={ganttServiceFilter}
                        onChange={(e) => setGanttServiceFilter(e.target.value)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--panel-white)', minWidth: '160px' }}
                      >
                        {uniqueServices.map(svc => (
                          <option key={svc} value={svc}>{svc === 'Tous' ? 'Tous les services' : svc}</option>
                        ))}
                      </select>
                    </div>
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
                            'Community management',
                            'Commercial'
                          ];

                          const sortedMembers = [...allMembers].sort((a, b) => {
                            const indexA = memberOrder.indexOf(a.employee_id);
                            const indexB = memberOrder.indexOf(b.employee_id);
                            const finalA = indexA !== -1 ? indexA : 9999;
                            const finalB = indexB !== -1 ? indexB : 9999;
                            return finalA - finalB;
                          });

                          const filteredMembers = sortedMembers.filter(m => {
                            if (ganttServiceFilter === 'Tous') return true;
                            const svc = (m.service === 'Directeur' ? 'Direction' : m.service) || 'Non spécifié';
                            return svc === ganttServiceFilter;
                          });

                          if (filteredMembers.length === 0) {
                            return (
                              <tr>
                                <td colSpan={daysInMonthArray.length + 4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                  Aucun collaborateur trouvé pour ce service.
                                </td>
                              </tr>
                            );
                          }

                          return filteredMembers.slice(0, globalDashboardLimit).map(m => {
                            const employeeReqs = allRequests.filter(req => req.employee_id === m.employee_id && req.status !== 'Refusé');
                            const projected = getProjectedBalance(m, currentDate);

                            return (
                              <tr
                                key={m.employee_id}
                                draggable={true}
                                onDragStart={(e) => {
                                  setDraggedMemberId(m.employee_id);
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('text/plain', m.employee_id);
                                }}
                                onDragEnd={() => {
                                  setDraggedMemberId(null);
                                  setDragOverMemberId(null);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (draggedMemberId && draggedMemberId !== m.employee_id) {
                                    setDragOverMemberId(m.employee_id);
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const draggedId = e.dataTransfer.getData('text/plain') || draggedMemberId;
                                  const targetId = m.employee_id;
                                  if (draggedId && targetId && draggedId !== targetId) {
                                    handleReorderMembers(draggedId, targetId);
                                  }
                                  setDraggedMemberId(null);
                                  setDragOverMemberId(null);
                                }}
                                className={`draggable-row ${draggedMemberId === m.employee_id ? 'dragging' : ''} ${dragOverMemberId === m.employee_id ? 'drag-over' : ''}`}
                              >
                                <td className="gantt-col-name">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}>
                                    <button
                                      type="button"
                                      className="drag-handle-btn"
                                      title="Faire glisser pour réordonner"
                                      style={{ flexShrink: 0 }}
                                    >
                                      <svg width="10" height="15" viewBox="0 0 10 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <circle cx="2" cy="2.5" r="0.75" fill="currentColor" stroke="none" />
                                        <circle cx="2" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
                                        <circle cx="2" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
                                        <circle cx="8" cy="2.5" r="0.75" fill="currentColor" stroke="none" />
                                        <circle cx="8" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
                                        <circle cx="8" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
                                      </svg>
                                    </button>
                                    <div className="gantt-collaborator-name-wrapper" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      <span>{m.employee_first_name}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="gantt-col-service">
                                  {(m.service === 'Directeur' ? 'Direction' : m.service) || 'Non spécifié'}
                                </td>
                                {daysInMonthArray.map(day => {
                                  const isWeekend = day.isWeekend;
                                  const isHoliday = isMadagascarHoliday(day.dateString);

                                  // Find if employee has a leave request covering this day
                                  let activeReq = employeeReqs.find(req =>
                                    day.dateString >= req.start_date && day.dateString <= req.end_date
                                  );

                                  // Special rule: Saturday formatted as a leave day if the preceding Friday was a CP day and not a holiday
                                  let isSaturdayCP = false;
                                  let saturdayReq = null;

                                  if (day.dayNameAbbr === 'sam') {
                                    const parts = day.dateString.split('-');
                                    const y = parseInt(parts[0], 10);
                                    const mVal = parseInt(parts[1], 10) - 1;
                                    const dVal = parseInt(parts[2], 10);
                                    const currD = new Date(y, mVal, dVal);
                                    currD.setDate(currD.getDate() - 1);
                                    const prevDateString = `${currD.getFullYear()}-${String(currD.getMonth() + 1).padStart(2, '0')}-${String(currD.getDate()).padStart(2, '0')}`;

                                    const isFridayHoliday = isMadagascarHoliday(prevDateString);
                                    if (!isFridayHoliday) {
                                      const fridayReq = employeeReqs.find(req =>
                                        prevDateString >= req.start_date &&
                                        prevDateString <= req.end_date &&
                                        (req.leave_type === 'CP' || req.leave_type === 'Congés Payés')
                                      );
                                      if (fridayReq) {
                                        isSaturdayCP = true;
                                        saturdayReq = fridayReq;
                                      }
                                    }
                                  }

                                  if (isSaturdayCP && saturdayReq) {
                                    if (isHoliday) {
                                      isSaturdayCP = false;
                                      saturdayReq = null;
                                    } else {
                                      activeReq = saturdayReq;
                                    }
                                  } else if (day.dayNameAbbr === 'sam' && !isSaturdayCP) {
                                    activeReq = null;
                                  }

                                  let cellClass = 'gantt-cell';
                                  let cellText = '';
                                  let cellTitle = '';

                                  if (isHoliday) {
                                    cellClass += ' holiday';
                                    cellTitle = 'Jour Férié';
                                  } else if (isWeekend && !isSaturdayCP) {
                                    cellClass += ' weekend';
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
                                      cellTitle = `[Attention] Superposition dans le service ${svc} !\n`;
                                    }

                                    cellTitle += `${m.employee_first_name} - ${activeReq.leave_type} (${activeReq.status})`;
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
                                <td className="gantt-col-balance" style={{ textAlign: 'center', padding: '0.4rem 0.2rem', verticalAlign: 'middle' }}>
                                  <div style={{ fontWeight: '700', color: 'var(--brand-orange)', fontSize: '0.9rem', lineHeight: '1.2' }}>
                                    {projected.cp}j
                                  </div>

                                  {projected.cpBreakdown && (
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: '1.2', fontStyle: 'italic' }}>
                                      {projected.cpBreakdown}
                                    </div>
                                  )}
                                </td>
                                <td className="gantt-col-balance" style={{ textAlign: 'center', padding: '0.4rem 0.2rem', verticalAlign: 'middle' }}>
                                  <div style={{ fontWeight: '700', fontSize: '0.9rem', lineHeight: '1.2' }}>
                                    {projected.perm}j
                                  </div>

                                  {projected.permBreakdown && (
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: '1.2', fontStyle: 'italic' }}>
                                      {projected.permBreakdown}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const filteredMembers = allMembers.filter(m => {
                    if (ganttServiceFilter === 'Tous') return true;
                    const svc = (m.service === 'Directeur' ? 'Direction' : m.service) || 'Non spécifié';
                    return svc === ganttServiceFilter;
                  });
                  if (filteredMembers.length > globalDashboardLimit) {
                    return (
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        <button
                          type="button"
                          className="btn-accent"
                          onClick={() => setGlobalDashboardLimit(prev => prev + 5)}
                          style={{
                            background: 'none',
                            border: '1px solid var(--brand-orange)',
                            color: 'var(--brand-orange)',
                            padding: '0.5rem 1.5rem',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          <Search size={16} /> Voir plus de collaborateurs ({filteredMembers.length - globalDashboardLimit} restants)
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Overlaps alert cards */}
                {(() => {
                  const filteredOverlaps = activeMonthOverlaps.filter(overlap => {
                    if (ganttServiceFilter === 'Tous') return true;
                    return overlap.service === ganttServiceFilter;
                  });

                  if (filteredOverlaps.length === 0) return null;

                  return (
                    <div className="gantt-alerts-card">
                      <h3 className="gantt-alerts-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={18} style={{ color: 'var(--warning-color)' }} /> Alertes Superpositions de Service ({currentDate.toLocaleDateString('fr-FR', { month: 'long' })})
                      </h3>
                      <div className="gantt-alerts-list">
                        {filteredOverlaps.map((overlap, idx) => {
                          const m1 = allMembers.find(m => m.employee_id === overlap.r1.employee_id);
                          const m2 = allMembers.find(m => m.employee_id === overlap.r2.employee_id);
                          const firstName1 = m1?.employee_first_name || overlap.r1.employee_name;
                          const firstName2 = m2?.employee_first_name || overlap.r2.employee_name;

                          return (
                            <div key={idx} className="gantt-alert-item">
                              <div>
                                <span className="gantt-alert-badge">{overlap.service}</span>{' '}
                                <strong>{firstName1}</strong> et{' '}
                                <strong>{firstName2}</strong> ont des congés superposés.
                              </div>
                              <div>
                                Période commune : du <strong>{new Date(overlap.start).toLocaleDateString('fr-FR')}</strong> au <strong>{new Date(overlap.end).toLocaleDateString('fr-FR')}</strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 3. TAB CONTENT: ADMINISTRATION RH                    */}
        {/* ==================================================== */}
        {profileLoaded && activeTab === 'adminRH' && balance?.service !== 'Pointeur' && (userRole === 'hr' || userRole === 'manager' || userRole === 'director') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Validation Panel */}
            <div className="panel" style={{ borderTop: '4px solid var(--brand-orange)' }}>
              <h2 className="panel-title">Suivi et validation finale RH</h2>
              <p className="panel-subtitle">Valider ou refuser les demandes de congé de l'entreprise.</p>

              {hrError && <div className="error-message" style={{ marginBottom: '1rem' }}>{hrError}</div>}
              {hrSuccess && <div className="success-message" style={{ marginBottom: '1rem' }}>{hrSuccess}</div>}

              {pendingRequests.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>
                  Aucun dossier validé par le N+1 en attente de traitement RH.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {pendingRequests.map((req) => {
                    const employeeMember = allMembers.find(m => m.employee_id === req.employee_id);
                    const currentUserMember = allMembers.find(m => m.employee_email?.toLowerCase() === user?.email?.toLowerCase());
                    const isN1 = employeeMember && currentUserMember && employeeMember.manager_name !== 'Aucun' && employeeMember.manager_name === currentUserMember.employee_first_name;

                    return (
                      <div key={req.request_id} className="validation-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                          <div>
                            <strong style={{ fontSize: '1.1rem' }}>{employeeMember?.employee_first_name || req.employee_name}</strong>
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
                              Du {formatDateStr(req.start_date)} au {formatDateStr(req.end_date)}
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
                              disabled={!isN1}
                              onClick={() => handleValidateLeave(req.request_id, 'Approuver')}
                            >
                              Accepter
                            </button>
                            <button
                              className="btn-small btn-reject"
                              disabled={!isN1}
                              onClick={() => handleValidateLeave(req.request_id, 'Refuser')}
                            >
                              Refuser
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

            {/* Split creation form & adjustment table */}
            <div className="split-layout">
              {/* Add user form */}
              <div className="sidebar" style={{ width: '350px' }}>
                <div className="panel">
                  <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UserPlus size={18} style={{ color: 'var(--brand-orange)' }} /> Ajouter un membre</h2>

                  <form onSubmit={handleCreateMember} style={{ padding: 0, border: 'none', background: 'none' }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Nom</label>
                        <input
                          type="text"
                          placeholder="Ex: RAKOTOARISOA"
                          value={newMemberLastName}
                          onChange={(e) => setNewMemberLastName(e.target.value)}
                          required
                          disabled={memberLoading}
                        />
                      </div>
                      <div className="form-group">
                        <label>Prénom</label>
                        <input
                          type="text"
                          placeholder="Ex: Dany"
                          value={newMemberFirstName}
                          onChange={(e) => setNewMemberFirstName(e.target.value)}
                          required
                          disabled={memberLoading}
                        />
                      </div>
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
                        <option value="Commercial">Commercial</option>
                        <option value="Pointeur">Pointeur</option>
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
                          <option key={m.employee_id} value={m.employee_first_name}>{m.employee_first_name}</option>
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

                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Clock size={16} /> Horaires de travail</h3>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Heure d'arrivée standard</label>
                          <input
                            type="time"
                            value={newMemberDefaultArrival}
                            onChange={(e) => setNewMemberDefaultArrival(e.target.value)}
                            disabled={memberLoading}
                          />
                        </div>
                        <div className="form-group">
                          <label>Heure de départ standard</label>
                          <input
                            type="time"
                            value={newMemberDefaultDeparture}
                            onChange={(e) => setNewMemberDefaultDeparture(e.target.value)}
                            disabled={memberLoading}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <input
                          type="checkbox"
                          id="newMemberCustomSchedule"
                          checked={newMemberCustomSchedule}
                          onChange={(e) => setNewMemberCustomSchedule(e.target.checked)}
                          style={{ width: 'auto', cursor: 'pointer' }}
                        />
                        <label htmlFor="newMemberCustomSchedule" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 400 }}>Horaires variables par jour</label>
                      </div>

                      {newMemberCustomSchedule && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                            const dayNamesFr = { Mon: 'Lundi', Tue: 'Mardi', Wed: 'Mercredi', Thu: 'Jeudi', Fri: 'Vendredi', Sat: 'Samedi' };
                            const arrivalVal = day === 'Mon' ? newMemberMonArrival : day === 'Tue' ? newMemberTueArrival : day === 'Wed' ? newMemberWedArrival : day === 'Thu' ? newMemberThuArrival : day === 'Fri' ? newMemberFriArrival : newMemberSatArrival;
                            const departureVal = day === 'Mon' ? newMemberMonDeparture : day === 'Tue' ? newMemberTueDeparture : day === 'Wed' ? newMemberWedDeparture : day === 'Thu' ? newMemberThuDeparture : day === 'Fri' ? newMemberFriDeparture : newMemberSatDeparture;

                            const setArrival = (val) => {
                              if (day === 'Mon') setNewMemberMonArrival(val);
                              else if (day === 'Tue') setNewMemberTueArrival(val);
                              else if (day === 'Wed') setNewMemberWedArrival(val);
                              else if (day === 'Thu') setNewMemberThuArrival(val);
                              else if (day === 'Fri') setNewMemberFriArrival(val);
                              else setNewMemberSatArrival(val);
                            };

                            const setDeparture = (val) => {
                              if (day === 'Mon') setNewMemberMonDeparture(val);
                              else if (day === 'Tue') setNewMemberTueDeparture(val);
                              else if (day === 'Wed') setNewMemberWedDeparture(val);
                              else if (day === 'Thu') setNewMemberThuDeparture(val);
                              else if (day === 'Fri') setNewMemberFriDeparture(val);
                              else setNewMemberSatDeparture(val);
                            };

                            return (
                              <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 500, minWidth: '70px', fontSize: '0.85rem' }}>{dayNamesFr[day]}</span>
                                <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                                  <input
                                    type="time"
                                    value={arrivalVal}
                                    onChange={(e) => setArrival(e.target.value)}
                                    style={{ padding: '0.25rem', fontSize: '0.85rem', width: '100%' }}
                                  />
                                  <input
                                    type="time"
                                    value={departureVal}
                                    onChange={(e) => setDeparture(e.target.value)}
                                    style={{ padding: '0.25rem', fontSize: '0.85rem', width: '100%' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
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

                    {memberError && <div className="error-message" style={{ marginTop: '1rem', marginBottom: '1rem' }}>{memberError}</div>}
                    {memberSuccess && <div className="success-message" style={{ marginTop: '1rem', marginBottom: '1rem' }}>Données enregistrées avec succès.</div>}

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', width: '100%' }}>
                      <button type="submit" className="btn-accent" disabled={memberLoading} style={{ minWidth: '150px' }}>
                        {memberLoading ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Adjust balances table */}
              <div className="main-content">
                <div className="panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 className="panel-title" style={{ marginBottom: 0 }}>Configuration des équipes et droits</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Service</label>
                      <select
                        value={adminServiceFilter}
                        onChange={(e) => setAdminServiceFilter(e.target.value)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--panel-white)', minWidth: '160px' }}
                      >
                        {uniqueServices.map(svc => (
                          <option key={svc} value={svc}>{svc === 'Tous' ? 'Tous les services' : svc}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {hrError && <div className="error-message" style={{ marginBottom: '1rem' }}>{hrError}</div>}
                  {hrSuccess && <div className="success-message" style={{ marginBottom: '1rem' }}>{hrSuccess}</div>}

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
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const sorted = [...allMembers].sort((a, b) => {
                            const indexA = memberOrder.indexOf(a.employee_id);
                            const indexB = memberOrder.indexOf(b.employee_id);
                            const finalA = indexA !== -1 ? indexA : 9999;
                            const finalB = indexB !== -1 ? indexB : 9999;
                            return finalA - finalB;
                          });
                          const filtered = sorted.filter(m => {
                            if (adminServiceFilter === 'Tous') return true;
                            const svc = (m.service === 'Directeur' ? 'Direction' : m.service) || 'Non spécifié';
                            return svc === adminServiceFilter;
                          });

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                  Aucun collaborateur trouvé pour ce service.
                                </td>
                              </tr>
                            );
                          }

                          return filtered.slice(0, adminRHLimit).map((m) => (
                            <tr
                              key={m.employee_id}
                              draggable={true}
                              onDragStart={(e) => {
                                setDraggedMemberId(m.employee_id);
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', m.employee_id);
                              }}
                              onDragEnd={() => {
                                setDraggedMemberId(null);
                                setDragOverMemberId(null);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (draggedMemberId && draggedMemberId !== m.employee_id) {
                                  setDragOverMemberId(m.employee_id);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const draggedId = e.dataTransfer.getData('text/plain') || draggedMemberId;
                                const targetId = m.employee_id;
                                if (draggedId && targetId && draggedId !== targetId) {
                                  handleReorderMembers(draggedId, targetId);
                                }
                                setDraggedMemberId(null);
                                setDragOverMemberId(null);
                              }}
                              className={`draggable-row ${draggedMemberId === m.employee_id ? 'dragging' : ''} ${dragOverMemberId === m.employee_id ? 'drag-over' : ''}`}
                            >
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    className="drag-handle-btn"
                                    title="Faire glisser pour réordonner"
                                  >
                                    <svg width="10" height="15" viewBox="0 0 10 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                      <circle cx="2" cy="2.5" r="0.75" fill="currentColor" stroke="none" />
                                      <circle cx="2" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
                                      <circle cx="2" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
                                      <circle cx="8" cy="2.5" r="0.75" fill="currentColor" stroke="none" />
                                      <circle cx="8" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
                                      <circle cx="8" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
                                    </svg>
                                  </button>
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
                                <strong>{m.employee_first_name}</strong>
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
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  {(() => {
                    const filtered = allMembers.filter(m => {
                      if (adminServiceFilter === 'Tous') return true;
                      const svc = (m.service === 'Directeur' ? 'Direction' : m.service) || 'Non spécifié';
                      return svc === adminServiceFilter;
                    });
                    if (filtered.length > adminRHLimit) {
                      return (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                          <button
                            type="button"
                            className="btn-accent"
                            onClick={() => setAdminRHLimit(prev => prev + 5)}
                            style={{
                              background: 'none',
                              border: '1px solid var(--brand-orange)',
                              color: 'var(--brand-orange)',
                              padding: '0.5rem 1.5rem',
                              borderRadius: '20px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}
                          >
                            <Search size={14} /> Voir plus de collaborateurs ({filtered.length - adminRHLimit} restants)
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Historique et gestion de tous les congés */}
                <div className="panel">
                  <h2 className="panel-title">Gestion globale des demandes de congé</h2>
                  <p className="panel-subtitle">Modifier, supprimer ou consulter toutes les demandes (validées, en attente ou refusées).</p>

                  {hrError && <div className="error-message" style={{ marginBottom: '1rem' }}>{hrError}</div>}
                  {hrSuccess && <div className="success-message" style={{ marginBottom: '1rem' }}>{hrSuccess}</div>}

                  <div className="table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                          <th>Collaborateur</th>
                          <th>Type</th>
                          <th>Dates</th>
                          <th>Durée</th>
                          <th>Statut</th>
                          <th>Commentaire RH</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allRequests.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                              Aucune demande de congé enregistrée.
                            </td>
                          </tr>
                        ) : (
                          allRequests.map((req) => (
                            <tr key={req.request_id}>
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
                                  <button
                                    className="btn-icon-edit"
                                    onClick={() => startEditLeave(req)}
                                    title="Modifier la demande"
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
                                    onClick={() => handleDeleteLeave(req.request_id)}
                                    title="Supprimer la demande"
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
                                <strong>{allMembers.find(m => m.employee_id === req.employee_id)?.employee_first_name || req.employee_name}</strong>
                              </td>
                              <td>
                                <strong style={{ color: 'var(--brand-orange)' }}>{req.leave_type}</strong>
                              </td>
                              <td>
                                Du {formatDateStr(req.start_date)} au {formatDateStr(req.end_date)}
                              </td>
                              <td><strong>{req.business_days} j</strong></td>
                              <td>
                                <span className={`status-badge ${req.status === 'En attente' ? 'status-pending' :
                                  req.status === 'Approuvé' ? 'status-approved' : 'status-rejected'
                                  }`}>
                                  {req.status}
                                </span>
                              </td>
                              <td>
                                {req.hr_comment || '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ==================================================== */}
        {/* 3.5. TAB CONTENT: POINTAGE                           */}
        {/* ==================================================== */}
        {profileLoaded && activeTab === 'pointage' && (userRole === 'hr' || userRole === 'manager' || userRole === 'director' || balance?.service === 'Pointeur') && (
          <div className="pointage-layout" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Top Toolbar: Date & Search */}
            <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
                <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date de pointage</label>
                <input
                  type="date"
                  value={pointageDate}
                  onChange={(e) => setPointageDate(e.target.value)}
                  style={{ margin: 0, padding: '0.5rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '280px', position: 'relative' }}>
                <label style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rechercher un collaborateur</label>
                <input
                  type="text"
                  placeholder="Rechercher par prénom..."
                  value={pointageSearchQuery}
                  onChange={(e) => setPointageSearchQuery(e.target.value)}
                  style={{ margin: 0, padding: '0.5rem', width: '100%' }}
                />
              </div>
            </div>

            {/* Attendance Analytics & KPIs Dashboard */}
            {pointageStats && balance?.service !== 'Pointeur' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>

                {/* Expected card */}
                <div className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Présence aujourd'hui</span>
                    <UserPlus size={18} style={{ color: 'var(--brand-orange)' }} />
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                    {pointageStats.today.present} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>/ {pointageStats.today.total} actifs</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--border-light)', borderRadius: '3px', marginTop: '0.25rem', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pointageStats.today.total > 0 ? (pointageStats.today.present / pointageStats.today.total) * 100 : 0}%`,
                      height: '100%',
                      background: 'var(--brand-orange)',
                      borderRadius: '3px',
                      transition: 'width 0.4s ease'
                    }}></div>
                  </div>
                </div>

                {/* Late Arrivals card */}
                <div className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Arrivées en retard</span>
                    <AlertTriangle size={18} style={{ color: 'var(--warning-color)' }} />
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f97316' }}>
                    {pointageStats.today.late} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>ce jour</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Taux d'assiduité : <strong style={{ color: 'var(--success-color)' }}>{pointageStats.today.punctuality_rate}%</strong>
                  </div>
                </div>

                {/* Absents card */}
                <div className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Non pointés</span>
                    <XCircle size={18} style={{ color: 'var(--error-color)' }} />
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    {pointageStats.today.absent} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>collaborateurs</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Départs pointés : <strong>{pointageStats.today.clocked_out}</strong>
                  </div>
                </div>

              </div>
            )}

            {/* Mobile sub-tab switcher */}
            {(() => {
              const expectedCount = pointageEmployees.filter(emp => {
                const matchesSearch = `${emp.employee_first_name} ${emp.employee_name}`.toLowerCase().includes(pointageSearchQuery.toLowerCase());
                const notClockedIn = !emp.time_log || !emp.time_log.clock_in;
                return matchesSearch && notClockedIn;
              }).length;

              const presentCount = pointageEmployees.filter(emp => {
                const matchesSearch = `${emp.employee_first_name} ${emp.employee_name}`.toLowerCase().includes(pointageSearchQuery.toLowerCase());
                const isClockedIn = emp.time_log && emp.time_log.clock_in && !emp.time_log.clock_out;
                return matchesSearch && isClockedIn;
              }).length;

              return (
                <div className="pointage-subtabs" style={{ display: 'none', gap: '0.75rem', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setPointageSubTab('expected')}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: pointageSubTab === 'expected' ? 'var(--brand-orange)' : 'var(--panel-white)',
                      color: pointageSubTab === 'expected' ? '#fff' : 'var(--text-primary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    Non arrivés
                    <span style={{
                      background: pointageSubTab === 'expected' ? 'rgba(255,255,255,0.2)' : 'var(--background-light)',
                      color: pointageSubTab === 'expected' ? '#fff' : 'var(--brand-orange)',
                      padding: '0.1rem 0.5rem',
                      borderRadius: '10px',
                      fontSize: '0.75rem'
                    }}>{expectedCount}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPointageSubTab('present')}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: pointageSubTab === 'present' ? 'var(--brand-orange)' : 'var(--panel-white)',
                      color: pointageSubTab === 'present' ? '#fff' : 'var(--text-primary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    Présents
                    <span style={{
                      background: pointageSubTab === 'present' ? 'rgba(255,255,255,0.2)' : 'var(--background-light)',
                      color: pointageSubTab === 'present' ? '#fff' : 'var(--brand-orange)',
                      padding: '0.1rem 0.5rem',
                      borderRadius: '10px',
                      fontSize: '0.75rem'
                    }}>{presentCount}</span>
                  </button>
                </div>
              );
            })()}

            {/* The 2 Columns Board */}
            <div className="pointage-columns-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>

              {/* Column 1: A l'étape d'arrivée (Non présents) */}
              <div className={`panel pointage-column-panel expected-panel ${pointageSubTab === 'expected' ? 'mobile-show' : 'mobile-hide'}`} style={{ background: 'var(--background-light)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '2px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Non arrivés
                  </h2>
                  <span className="badge-role employee" style={{ padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                    {pointageEmployees.filter(emp => {
                      // Match filter
                      const matchesSearch = `${emp.employee_first_name} ${emp.employee_name}`.toLowerCase().includes(pointageSearchQuery.toLowerCase());
                      const matchesService = pointageServiceFilter === 'Tous' || emp.service === pointageServiceFilter;
                      const notClockedIn = !emp.time_log || !emp.time_log.clock_in;
                      return matchesSearch && matchesService && notClockedIn;
                    }).length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '300px' }}>
                  {pointageLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Chargement en cours...</div>
                  ) : (() => {
                    const filtered = pointageEmployees.filter(emp => {
                      const matchesSearch = `${emp.employee_first_name} ${emp.employee_name}`.toLowerCase().includes(pointageSearchQuery.toLowerCase());
                      const matchesService = pointageServiceFilter === 'Tous' || emp.service === pointageServiceFilter;
                      const notClockedIn = !emp.time_log || !emp.time_log.clock_in;
                      return matchesSearch && matchesService && notClockedIn;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--panel-white)', borderRadius: '8px', border: '1px dashed var(--border-light)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          Aucun collaborateur attendu dans cette liste.
                        </div>
                      );
                    }

                    return (
                      <>
                        {filtered.slice(0, pointageExpectedLimit).map(emp => {
                          // Get schedule of day dynamically
                          const dateObj = new Date(pointageDate);
                          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                          const dayOfWeek = days[dateObj.getDay()];
                          const schedule = emp.work_schedule || {};
                          const daySchedule = schedule[dayOfWeek] || schedule.default || { arrival: '08:00', departure: '17:00' };

                          return (
                            <div key={emp.employee_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--panel-white)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid var(--border-light)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <span style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>{emp.employee_first_name}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Service : {emp.service}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                                  <Timer size={12} /> Horaire : {daySchedule.arrival} - {daySchedule.departure}
                                </span>
                                {emp.time_log && emp.time_log.clock_out && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--error-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <LogOut size={12} /> Parti à {emp.time_log.clock_out.substring(0, 5)}
                                  </span>
                                )}
                              </div>

                              <button
                                className="btn-accent"
                                onClick={() => handleClockIn(emp.employee_id)}
                                disabled={clockingEmployeeId === emp.employee_id || (emp.time_log && emp.time_log.clock_out)}
                                style={{
                                  padding: '0.4rem 0.8rem',
                                  fontSize: '0.85rem',
                                  background: '#328853',
                                  borderColor: '#15803d',
                                  minWidth: '90px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                              >
                                {clockingEmployeeId === emp.employee_id ? 'Envoi...' : (
                                  <>
                                    <LogIn size={14} /> Arrivé
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                        {filtered.length > pointageExpectedLimit && (
                          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', width: '100%' }}>
                            <button
                              type="button"
                              onClick={() => setPointageExpectedLimit(prev => prev + 5)}
                              style={{
                                background: 'none',
                                border: '1px solid var(--brand-orange)',
                                color: 'var(--brand-orange)',
                                padding: '0.4rem 1rem',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '0.8rem'
                              }}
                            >
                              <ChevronDown size={14} /> Voir plus ({filtered.length - pointageExpectedLimit} restants)
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Column 2: Présents dans les locaux */}
              <div className={`panel pointage-column-panel present-panel ${pointageSubTab === 'present' ? 'mobile-show' : 'mobile-hide'}`} style={{ background: 'var(--background-light)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '2px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Présents
                  </h2>
                  <span className="badge-role manager" style={{ padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                    {pointageEmployees.filter(emp => {
                      const matchesSearch = `${emp.employee_first_name} ${emp.employee_name}`.toLowerCase().includes(pointageSearchQuery.toLowerCase());
                      const matchesService = pointageServiceFilter === 'Tous' || emp.service === pointageServiceFilter;
                      const isClockedIn = emp.time_log && emp.time_log.clock_in && !emp.time_log.clock_out;
                      return matchesSearch && matchesService && isClockedIn;
                    }).length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '300px' }}>
                  {pointageLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Chargement en cours...</div>
                  ) : (() => {
                    const filtered = pointageEmployees.filter(emp => {
                      const matchesSearch = `${emp.employee_first_name} ${emp.employee_name}`.toLowerCase().includes(pointageSearchQuery.toLowerCase());
                      const matchesService = pointageServiceFilter === 'Tous' || emp.service === pointageServiceFilter;
                      const isClockedIn = emp.time_log && emp.time_log.clock_in && !emp.time_log.clock_out;
                      return matchesSearch && matchesService && isClockedIn;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--panel-white)', borderRadius: '8px', border: '1px dashed var(--border-light)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          Aucun collaborateur présent actuellement.
                        </div>
                      );
                    }

                    return (
                      <>
                        {filtered.slice(0, pointagePresentLimit).map(emp => (
                          <div key={emp.employee_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--panel-white)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid var(--border-light)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>{emp.employee_first_name}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Service : {emp.service}</span>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--success-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <LogIn size={12} /> Arrivée : {emp.time_log.clock_in.substring(0, 5)}
                                </span>
                                <span className={`status-badge ${emp.time_log.status === 'En retard' ? 'status-rejected' : 'status-approved'}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                                  {emp.time_log.status}
                                </span>
                              </div>
                            </div>

                            <button
                              className="btn-accent"
                              onClick={() => handleClockOut(emp.employee_id)}
                              disabled={clockingEmployeeId === emp.employee_id}
                              style={{
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.85rem',
                                background: 'var(--brand-orange)',
                                borderColor: 'var(--brand-orange-hover)',
                                minWidth: '90px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              {clockingEmployeeId === emp.employee_id ? 'Envoi...' : (
                                <>
                                  <LogOut size={14} /> Sortie
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                        {filtered.length > pointagePresentLimit && (
                          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', width: '100%' }}>
                            <button
                              type="button"
                              onClick={() => setPointagePresentLimit(prev => prev + 5)}
                              style={{
                                background: 'none',
                                border: '1px solid var(--brand-orange)',
                                color: 'var(--brand-orange)',
                                padding: '0.4rem 1rem',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '0.8rem'
                              }}
                            >
                              <ChevronDown size={14} /> Voir plus ({filtered.length - pointagePresentLimit} restants)
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

            </div>

            {/* SVG Attendance History & Charts */}
            {pointageStats && pointageStats.chartData && pointageStats.chartData.length > 0 && balance?.service !== 'Pointeur' && (
              <div className="panel" style={{ marginTop: '1rem' }}>
                <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><History size={18} style={{ color: 'var(--brand-orange)' }} /> Assiduité de l'équipe (7 derniers jours)</h2>
                <p className="panel-subtitle">Historique des présences quotidiennes triées par ponctualité.</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '1.5rem', alignItems: 'center' }}>

                  {/* stacked Bar Chart SVG */}
                  <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <svg viewBox="0 0 500 220" style={{ width: '100%', height: 'auto', background: 'none' }}>
                      {/* Grid Lines */}
                      <line x1="40" y1="20" x2="480" y2="20" stroke="var(--border-light)" strokeDasharray="4" />
                      <line x1="40" y1="70" x2="480" y2="70" stroke="var(--border-light)" strokeDasharray="4" />
                      <line x1="40" y1="120" x2="480" y2="120" stroke="var(--border-light)" strokeDasharray="4" />
                      <line x1="40" y1="170" x2="480" y2="170" stroke="var(--border-light)" />

                      {/* Y Labels */}
                      <text x="20" y="24" fontSize="10" fill="var(--text-secondary)" textAnchor="end">100%</text>
                      <text x="20" y="74" fontSize="10" fill="var(--text-secondary)" textAnchor="end">50%</text>
                      <text x="20" y="124" fontSize="10" fill="var(--text-secondary)" textAnchor="end">25%</text>
                      <text x="20" y="174" fontSize="10" fill="var(--text-secondary)" textAnchor="end">0%</text>

                      {/* Bars */}
                      {pointageStats.chartData.map((d, index) => {
                        const x = 55 + index * 60;
                        const total = d.present + d.absent || 1;

                        const presentHeight = (d.present / total) * 150;
                        const lateHeight = (d.late / total) * 150;
                        const punctualHeight = Math.max(0, presentHeight - lateHeight);
                        const absentHeight = (d.absent / total) * 150;

                        const yAbsent = 170 - absentHeight;
                        const yLate = yAbsent - lateHeight;
                        const yPunctual = yLate - punctualHeight;

                        return (
                          <g key={d.date} style={{ cursor: 'pointer' }}>
                            {/* Punctual segment (Green) */}
                            {punctualHeight > 0 && (
                              <rect x={x} y={yPunctual} width="22" height={punctualHeight} fill="#166534" rx="2" />
                            )}
                            {/* Late segment (Orange) */}
                            {lateHeight > 0 && (
                              <rect x={x} y={yLate} width="22" height={lateHeight} fill="var(--brand-orange)" rx="2" />
                            )}
                            {/* Absent segment (Gray) */}
                            {absentHeight > 0 && (
                              <rect x={x} y={yAbsent} width="22" height={absentHeight} fill="var(--border-light)" rx="2" />
                            )}

                            {/* Date Label */}
                            <text x={x + 11} y="192" fontSize="10" fill="var(--text-secondary)" textAnchor="middle" fontWeight="500">{d.label}</text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#166534' }}></span>
                        <span>Présent (À l'heure)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--brand-orange)' }}></span>
                        <span>En retard</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--border-light)' }}></span>
                        <span>Absent / Non pointé</span>
                      </div>
                    </div>
                  </div>

                  {/* Radial Progress Ring SVG */}
                  <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', width: '140px', height: '140px' }}>
                      <svg width="100%" height="100%" viewBox="0 0 40 40">
                        {/* Background circle */}
                        <circle cx="20" cy="20" r="15.91549430918954" fill="none" stroke="var(--border-light)" strokeWidth="3" />
                        {/* Progress ring */}
                        <circle cx="20" cy="20" r="15.91549430918954" fill="none" stroke="var(--success-color)" strokeWidth="3.5"
                          strokeDasharray={`${pointageStats.today.punctuality_rate} ${100 - pointageStats.today.punctuality_rate}`}
                          strokeDashoffset="25"
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dasharray 0.5s ease-out' }}
                        />
                      </svg>
                      {/* Percent indicator */}
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-navy)' }}>{pointageStats.today.punctuality_rate}%</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase' }}>À l'heure</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '200px', fontWeight: 500 }}>
                      Taux de ponctualité global aujourd'hui
                    </span>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 4. MODAL: EDIT MEMBER POPUP                         */}
      {/* ==================================================== */}
      {editingMember && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Edit size={20} /> Modifier le Membre</h2>
            <p className="modal-message" style={{ marginBottom: '1.25rem' }}>
              Mettez à jour les informations et soldes initiaux pour <strong>{editingMember.employee_first_name}</strong>.
            </p>

            {memberError && <div className="error-message">{memberError}</div>}

            <form onSubmit={handleUpdateMember} style={{ padding: 0, border: 'none', background: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Nom</label>
                  <input
                    type="text"
                    placeholder="Nom"
                    value={newMemberLastName}
                    onChange={(e) => setNewMemberLastName(e.target.value)}
                    required
                    disabled={memberLoading}
                  />
                </div>
                <div className="form-group">
                  <label>Prénom</label>
                  <input
                    type="text"
                    placeholder="Prénom"
                    value={newMemberFirstName}
                    onChange={(e) => setNewMemberFirstName(e.target.value)}
                    required
                    disabled={memberLoading}
                  />
                </div>
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
                  <option value="Commercial">Commercial</option>
                  <option value="Pointeur">Pointeur</option>
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
                    <option key={m.employee_id} value={m.employee_first_name}>{m.employee_first_name}</option>
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

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Clock size={16} /> Horaires de travail</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Heure d'arrivée standard</label>
                    <input
                      type="time"
                      value={newMemberDefaultArrival}
                      onChange={(e) => setNewMemberDefaultArrival(e.target.value)}
                      disabled={memberLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label>Heure de départ standard</label>
                    <input
                      type="time"
                      value={newMemberDefaultDeparture}
                      onChange={(e) => setNewMemberDefaultDeparture(e.target.value)}
                      disabled={memberLoading}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="editMemberCustomSchedule"
                    checked={newMemberCustomSchedule}
                    onChange={(e) => setNewMemberCustomSchedule(e.target.checked)}
                    style={{ width: 'auto', cursor: 'pointer' }}
                  />
                  <label htmlFor="editMemberCustomSchedule" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 400 }}>Horaires variables par jour</label>
                </div>

                {newMemberCustomSchedule && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                      const dayNamesFr = { Mon: 'Lundi', Tue: 'Mardi', Wed: 'Mercredi', Thu: 'Jeudi', Fri: 'Vendredi', Sat: 'Samedi' };
                      const arrivalVal = day === 'Mon' ? newMemberMonArrival : day === 'Tue' ? newMemberTueArrival : day === 'Wed' ? newMemberWedArrival : day === 'Thu' ? newMemberThuArrival : day === 'Fri' ? newMemberFriArrival : newMemberSatArrival;
                      const departureVal = day === 'Mon' ? newMemberMonDeparture : day === 'Tue' ? newMemberTueDeparture : day === 'Wed' ? newMemberWedDeparture : day === 'Thu' ? newMemberThuDeparture : day === 'Fri' ? newMemberFriDeparture : newMemberSatDeparture;

                      const setArrival = (val) => {
                        if (day === 'Mon') setNewMemberMonArrival(val);
                        else if (day === 'Tue') setNewMemberTueArrival(val);
                        else if (day === 'Wed') setNewMemberWedArrival(val);
                        else if (day === 'Thu') setNewMemberThuArrival(val);
                        else if (day === 'Fri') setNewMemberFriArrival(val);
                        else setNewMemberSatArrival(val);
                      };

                      const setDeparture = (val) => {
                        if (day === 'Mon') setNewMemberMonDeparture(val);
                        else if (day === 'Tue') setNewMemberTueDeparture(val);
                        else if (day === 'Wed') setNewMemberWedDeparture(val);
                        else if (day === 'Thu') setNewMemberThuDeparture(val);
                        else if (day === 'Fri') setNewMemberFriDeparture(val);
                        else setNewMemberSatDeparture(val);
                      };

                      return (
                        <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 500, minWidth: '70px', fontSize: '0.85rem' }}>{dayNamesFr[day]}</span>
                          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                            <input
                              type="time"
                              value={arrivalVal}
                              onChange={(e) => setArrival(e.target.value)}
                              style={{ padding: '0.25rem', fontSize: '0.85rem', width: '100%' }}
                            />
                            <input
                              type="time"
                              value={departureVal}
                              onChange={(e) => setDeparture(e.target.value)}
                              style={{ padding: '0.25rem', fontSize: '0.85rem', width: '100%' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
      {/* 4.5 MODAL: EDIT LEAVE REQUEST POPUP                 */}
      {/* ==================================================== */}
      {editingLeave && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Edit size={20} /> Modifier la Demande</h2>
            <p className="modal-message" style={{ marginBottom: '1.25rem' }}>
              Mettez à jour les dates ou le type de congé pour cette demande.
            </p>

            <form onSubmit={handleUpdateLeave} style={{ padding: 0, border: 'none', background: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Date de Début</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  required
                  disabled={editLeaveLoading}
                />
              </div>

              <div className="form-group">
                <label>Date de Fin</label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  required
                  disabled={editLeaveLoading}
                />
              </div>

              <div className="form-group">
                <label>Type de congé / Permission</label>
                <select
                  value={editLeaveType}
                  onChange={(e) => setEditLeaveType(e.target.value)}
                  disabled={editLeaveLoading}
                  required
                >
                  <option value="CP">Congé Payé</option>
                  <option value="Congés Payés">Congés Payés (Ancien)</option>
                  <option value="Congé Sans Solde">Congé Sans Solde</option>
                  <option value="Permission">Permission Spéciale</option>
                  <option value="Permission Exceptionnelle">Permission Exceptionnelle (Ancien)</option>
                  <option value="Permission à rattraper">Permission à rattraper</option>
                  <option value="Maladie">Congé Maladie</option>
                </select>
              </div>

              {editLeaveError && <div className="error-message" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>{editLeaveError}</div>}

              <div className="modal-footer">
                <button type="submit" className="btn-accent" style={{ minWidth: '110px' }} disabled={editLeaveLoading}>
                  {editLeaveLoading ? 'Envoi...' : 'Sauvegarder'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setEditingLeave(null)} disabled={editLeaveLoading}>
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
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldAlert size={20} /> {confirmModal.title}</h2>
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

      {/* iOS Installation Instructions Modal */}
      {showiOSInstallModal && (
        <div className="modal-backdrop" onClick={() => setShowiOSInstallModal(false)} style={{ zIndex: 120 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center' }}>
            <h2 className="panel-title" style={{ justifyContent: 'center', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Smartphone size={20} /> Installer Step Hub sur iOS
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '0.5rem 0 1.5rem 0' }}>
              Suivez ces étapes simples pour ajouter l'application sur votre écran d'accueil iPhone ou iPad :
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left', margin: '1rem 0' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.15rem', background: 'var(--warning-bg)', color: 'var(--brand-orange)', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>1</span>
                <div>
                  <span style={{ fontWeight: '700', color: 'var(--brand-navy)', fontSize: '0.95rem' }}>Ouvrez Safari</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cette fonctionnalité est supportée uniquement sur Safari.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.15rem', background: 'var(--warning-bg)', color: 'var(--brand-orange)', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>2</span>
                <div>
                  <span style={{ fontWeight: '700', color: 'var(--brand-navy)', fontSize: '0.95rem' }}>Appuyez sur le bouton Partager</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    C'est l'icône de partage
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '16px', height: '16px', display: 'inline', color: 'var(--brand-orange)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
                    </svg>
                    dans la barre du navigateur.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.15rem', background: 'var(--warning-bg)', color: 'var(--brand-orange)', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>3</span>
                <div>
                  <span style={{ fontWeight: '700', color: 'var(--brand-navy)', fontSize: '0.95rem' }}>Sélectionnez "Sur l'écran d'accueil"</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Faites défiler le menu vers le bas et appuyez sur l'option ➕.</p>
                </div>
              </div>
            </div>

            <button
              className="btn-accent"
              onClick={() => setShowiOSInstallModal(false)}
              style={{ width: '100%', marginTop: '1.5rem' }}
            >
              Compris !
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
