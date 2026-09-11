'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Filter,
  Users,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Search,
  LogIn,
  LogOut,
  Timer,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ClipboardList,
  Sparkles,
  PieChart,
  UserCheck,
  Building2,
  ArrowRight
} from 'lucide-react';

// Madagascar timezone offset helper (UTC+3)
const getLocalTodayStr = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const local = new Date(utc + (3600000 * 3));
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
};

const formatDateFR = (dateStr) => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

export default function StatistiquesRH({
  user,
  token,
  allMembers = [],
  pendingRequests = [],
  uniqueServices = ['Tous']
}) {
  const todayStr = getLocalTodayStr();

  // Date Range States (Default to last 7 days ending today)
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const local = new Date(utc + (3600000 * 3));
    local.setDate(local.getDate() - 6);
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  }, []);

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(todayStr);
  const [activePreset, setActivePreset] = useState('7days'); // 'today', '7days', 'thisMonth', '30days', 'prevMonth', 'thisYear', 'custom'
  const [serviceFilter, setServiceFilter] = useState('Tous');

  // Stats Data from API
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Employee Table States
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [employeeSortField, setEmployeeSortField] = useState('punctualityRate'); // 'name', 'service', 'presentDays', 'lateDays', 'punctualityRate', 'leaveDays'
  const [employeeSortDir, setEmployeeSortDir] = useState('desc');
  const [employeeLimit, setEmployeeLimit] = useState(10);
  const [hoveredDayIndex, setHoveredDayIndex] = useState(null);

  // Quick Preset Handler
  const applyPreset = (presetKey) => {
    setActivePreset(presetKey);
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const local = new Date(utc + (3600000 * 3));

    const y = local.getFullYear();
    const m = local.getMonth();
    const day = local.getDate();

    if (presetKey === 'today') {
      const today = getLocalTodayStr();
      setStartDate(today);
      setEndDate(today);
    } else if (presetKey === '7days') {
      const start = new Date(local);
      start.setDate(day - 6);
      setStartDate(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`);
      setEndDate(getLocalTodayStr());
    } else if (presetKey === 'thisMonth') {
      const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      setStartDate(startStr);
      setEndDate(getLocalTodayStr());
    } else if (presetKey === '30days') {
      const start = new Date(local);
      start.setDate(day - 29);
      setStartDate(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`);
      setEndDate(getLocalTodayStr());
    } else if (presetKey === 'prevMonth') {
      const prevMonthDate = new Date(y, m - 1, 1);
      const prevMonthLastDate = new Date(y, m, 0);
      const startStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
      const endStr = `${prevMonthLastDate.getFullYear()}-${String(prevMonthLastDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthLastDate.getDate()).padStart(2, '0')}`;
      setStartDate(startStr);
      setEndDate(endStr);
    } else if (presetKey === 'thisYear') {
      const startStr = `${y}-01-01`;
      setStartDate(startStr);
      setEndDate(getLocalTodayStr());
    }
  };

  // Fetch Stats Data
  const fetchStats = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        service: serviceFilter
      });

      const res = await fetch(`/api/time-logs/stats?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Erreur lors du chargement des statistiques.');
      }

      const data = await res.json();
      setStatsData(data);
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError(err.message || 'Impossible de récupérer les statistiques.');
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate, serviceFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Global Company-wide calculations (from allMembers)
  const totalCumulatedCP = useMemo(() => {
    return allMembers
      .reduce((sum, m) => sum + parseFloat(m.remaining_balance || 0), 0)
      .toFixed(1);
  }, [allMembers]);

  const totalCumulatedPerm = useMemo(() => {
    return allMembers
      .reduce((sum, m) => sum + parseFloat(m.remaining_perm || 0), 0)
      .toFixed(1);
  }, [allMembers]);

  // Handle Sort
  const handleSort = (field) => {
    if (employeeSortField === field) {
      setEmployeeSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setEmployeeSortField(field);
      setEmployeeSortDir('desc');
    }
  };

  // Filtered & Sorted Employees list
  const filteredEmployees = useMemo(() => {
    if (!statsData || !statsData.byEmployee) return [];

    let list = [...statsData.byEmployee];

    if (employeeSearchQuery.trim()) {
      const query = employeeSearchQuery.toLowerCase();
      list = list.filter(emp =>
        `${emp.employee_first_name} ${emp.employee_name} ${emp.service}`.toLowerCase().includes(query)
      );
    }

    list.sort((a, b) => {
      let valA = a[employeeSortField];
      let valB = b[employeeSortField];

      if (employeeSortField === 'name') {
        valA = (a.employee_first_name || '').toLowerCase();
        valB = (b.employee_first_name || '').toLowerCase();
        return employeeSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (typeof valA === 'string') {
        return employeeSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = valA || 0;
      valB = valB || 0;
      return employeeSortDir === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [statsData, employeeSearchQuery, employeeSortField, employeeSortDir]);

  // SVG Chart Computations
  const chartData = statsData?.chartData || [];
  const chartWidth = Math.max(600, chartData.length * 48 + 80);
  const chartHeight = 220;
  const barWidth = Math.min(26, Math.max(14, Math.floor(chartWidth / (chartData.length * 1.8 + 5))));

  const summary = statsData?.summary || {
    totalEmployees: allMembers.length,
    totalClockIns: 0,
    totalPunctual: 0,
    totalLate: 0,
    totalClockOuts: 0,
    punctualityRate: 100,
    totalLeaveDays: 0,
    avgPresentPerDay: '0'
  };

  const punctualityColor =
    summary.punctualityRate >= 90
      ? 'var(--success-color)'
      : summary.punctualityRate >= 75
      ? 'var(--warning-color)'
      : 'var(--error-color)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ==================================================== */}
      {/* 1. FILTER & PERIOD TOOLBAR                           */}
      {/* ==================================================== */}
      <div className="panel" style={{ padding: '1.25rem 1.5rem', background: 'var(--panel-white)', border: '1px solid var(--border-light)', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          
          {/* Header title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--brand-orange) 0%, #ea580c 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(255, 122, 0, 0.25)'
            }}>
              <BarChart3 size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Statistiques & Indicateurs RH
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Analyse de l'assiduité, de la ponctualité, des effectifs et des congés
              </p>
            </div>
          </div>

          {/* Refresh & Active period indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              background: 'var(--background-light)',
              border: '1px solid var(--border-light)',
              color: 'var(--brand-navy)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <Calendar size={14} style={{ color: 'var(--brand-orange)' }} />
              <span>Période : <strong>{formatDateFR(startDate)}</strong> au <strong>{formatDateFR(endDate)}</strong></span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>({statsData?.period?.daysCount || 1} j)</span>
            </div>

            <button
              type="button"
              onClick={fetchStats}
              disabled={loading}
              className="btn-secondary"
              title="Rafraîchir les données"
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                borderRadius: '8px'
              }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Calcul...' : 'Actualiser'}</span>
            </button>
          </div>
        </div>

        {/* Quick Date Presets Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '0.25rem' }}>
            Raccourcis :
          </span>
          {[
            { id: 'today', label: "Aujourd'hui" },
            { id: '7days', label: '7 derniers jours' },
            { id: 'thisMonth', label: 'Ce mois-ci' },
            { id: '30days', label: '30 derniers jours' },
            { id: 'prevMonth', label: 'Mois dernier' },
            { id: 'thisYear', label: 'Cette année' }
          ].map(p => {
            const isActive = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: '20px',
                  border: isActive ? '1px solid var(--brand-orange)' : '1px solid var(--border-light)',
                  background: isActive ? 'var(--brand-orange)' : 'var(--background-light)',
                  color: isActive ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Pickers & Service Filter Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date de début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset('custom');
              }}
              style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date de fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset('custom');
              }}
              style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Département / Service</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem', width: '100%', cursor: 'pointer' }}
            >
              {uniqueServices.map(svc => (
                <option key={svc} value={svc}>{svc === 'Tous' ? 'Tous les services' : svc}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          background: 'var(--error-bg)',
          border: '1px solid var(--error-border)',
          color: 'var(--error-color)',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. SECTION: GLOBAL HR & WORKFORCE METRICS            */}
      {/* ==================================================== */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Building2 size={16} style={{ color: 'var(--brand-orange)' }} /> Vue d'ensemble Globale & Effectifs
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Données consolidées entreprise</span>
        </div>

        <div className="kpi-grid" style={{ marginBottom: 0 }}>
          {/* Total Collaborateurs */}
          <div className="kpi-card" style={{ borderLeft: '4px solid var(--brand-navy)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="kpi-lbl">Total Collaborateurs</span>
              <Users size={20} style={{ color: 'var(--brand-navy)' }} />
            </div>
            <span className="kpi-val" style={{ color: 'var(--brand-navy)' }}>
              {summary.totalEmployees}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {serviceFilter === 'Tous' ? 'Effectif total actif' : `Effectif (${serviceFilter})`}
            </span>
          </div>

          {/* Soldes Congés payés cumulés */}
          <div className="kpi-card" style={{ borderLeft: '4px solid var(--brand-orange)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="kpi-lbl">Soldes CP Cumulés</span>
              <ClipboardList size={20} style={{ color: 'var(--brand-orange)' }} />
            </div>
            <span className="kpi-val">
              {totalCumulatedCP} <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>jours</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Droits restants entreprise
            </span>
          </div>

          {/* Soldes Permissions Spéciales */}
          <div className="kpi-card" style={{ borderLeft: '4px solid #178FCB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="kpi-lbl">Soldes Permissions</span>
              <Sparkles size={20} style={{ color: '#178FCB' }} />
            </div>
            <span className="kpi-val" style={{ color: '#178FCB' }}>
              {totalCumulatedPerm} <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>jours</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Permissions cumulées
            </span>
          </div>

          {/* Demandes en attente */}
          <div className="kpi-card" style={{ borderLeft: `4px solid ${pendingRequests.length > 0 ? 'var(--warning-color)' : 'var(--success-color)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className="kpi-lbl">Demandes en attente</span>
              <Clock size={20} style={{ color: pendingRequests.length > 0 ? 'var(--warning-color)' : 'var(--success-color)' }} />
            </div>
            <span className="kpi-val" style={{ color: pendingRequests.length > 0 ? 'var(--warning-color)' : 'var(--success-color)' }}>
              {pendingRequests.length}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {pendingRequests.length > 0 ? 'À valider par la RH / Direction' : 'Toutes traitées'}
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 3. SECTION: ATTENDANCE & POINTAGE KPIS               */}
      {/* ==================================================== */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Timer size={16} style={{ color: 'var(--brand-orange)' }} /> Indicateurs de Pointage & Ponctualité (Sur la période)
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Du {formatDateFR(startDate)} au {formatDateFR(endDate)}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          
          {/* Taux de Ponctualité */}
          <div className="panel" style={{ padding: '1.25rem', borderLeft: `4px solid ${punctualityColor}`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Taux de Ponctualité
              </span>
              <Timer size={18} style={{ color: punctualityColor }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: punctualityColor }}>
                {summary.punctualityRate}%
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                ({summary.totalPunctual} à l'heure)
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Sur <strong>{summary.totalClockIns}</strong> arrivée{summary.totalClockIns > 1 ? 's' : ''} enregistrée{summary.totalClockIns > 1 ? 's' : ''}
            </div>
          </div>

          {/* Présences & Arrivées Totales */}
          <div className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Présences
              </span>
              <LogIn size={18} style={{ color: 'var(--success-color)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
              {summary.totalClockIns} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>pointages</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Moyenne : <strong>{summary.avgPresentPerDay}</strong> collaborateur(s)/jour
            </div>
          </div>

          {/* Retards */}
          <div className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Arrivées en Retard
              </span>
              <AlertTriangle size={18} style={{ color: 'var(--warning-color)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f97316' }}>
              {summary.totalLate} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>retard{summary.totalLate > 1 ? 's' : ''}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {summary.totalClockIns > 0 ? `${((summary.totalLate / summary.totalClockIns) * 100).toFixed(1)}% des arrivées` : '0%'}
            </div>
          </div>

          {/* Total Départs pointés */}
          <div className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Départs Pointés
              </span>
              <LogOut size={18} style={{ color: 'var(--brand-orange)' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
              {summary.totalClockOuts} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>sorties</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Congés approuvés : <strong>{summary.totalLeaveDays}</strong> j
            </div>
          </div>

        </div>
      </div>

      {/* ==================================================== */}
      {/* 4. SECTION: VISUAL CHARTS & ATTENDANCE TRENDS        */}
      {/* ==================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>
        
        {/* Main Stacked Bar Chart */}
        <div className="panel" style={{ gridColumn: chartData.length > 7 ? '1 / -1' : 'span 2', minHeight: '340px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.35rem 0' }}>
                <TrendingUp size={20} style={{ color: 'var(--brand-orange)' }} /> Assiduité Quotidienne de l'Équipe
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Répartition jour par jour : À l'heure, Retard, En congé et Non pointé
              </p>
            </div>

            {/* Quick Chart Legend */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.78rem', alignItems: 'center', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#338855' }}></span>
                <span>À l'heure</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--brand-orange)' }}></span>
                <span>En retard</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6' }}></span>
                <span>En Congé</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--border-light)' }}></span>
                <span>Non pointé</span>
              </div>
            </div>
          </div>

          {/* Chart Container (Scrollable if many days) */}
          <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '0.5rem', flex: 1, display: 'flex', alignItems: 'center' }}>
            {chartData.length === 0 ? (
              <div style={{ textAlign: 'center', width: '100%', padding: '3rem', color: 'var(--text-secondary)' }}>
                Aucune donnée d'assiduité pour cette période.
              </div>
            ) : (
              <div style={{ minWidth: `${chartWidth}px`, width: '100%', position: 'relative' }}>
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                  {/* Background Grid Lines */}
                  <line x1="45" y1="20" x2={chartWidth - 20} y2="20" stroke="var(--border-light)" strokeDasharray="3" opacity="0.6" />
                  <line x1="45" y1="65" x2={chartWidth - 20} y2="65" stroke="var(--border-light)" strokeDasharray="3" opacity="0.6" />
                  <line x1="45" y1="110" x2={chartWidth - 20} y2="110" stroke="var(--border-light)" strokeDasharray="3" opacity="0.6" />
                  <line x1="45" y1="155" x2={chartWidth - 20} y2="155" stroke="var(--border-light)" strokeDasharray="3" opacity="0.6" />
                  <line x1="45" y1="175" x2={chartWidth - 20} y2="175" stroke="var(--border-light)" />

                  {/* Y Axis Labels */}
                  <text x="35" y="24" fontSize="10" fill="var(--text-secondary)" textAnchor="end" fontWeight="600">100%</text>
                  <text x="35" y="69" fontSize="10" fill="var(--text-secondary)" textAnchor="end">75%</text>
                  <text x="35" y="114" fontSize="10" fill="var(--text-secondary)" textAnchor="end">50%</text>
                  <text x="35" y="159" fontSize="10" fill="var(--text-secondary)" textAnchor="end">25%</text>
                  <text x="35" y="178" fontSize="10" fill="var(--text-secondary)" textAnchor="end">0%</text>

                  {/* Bars & Day Labels */}
                  {chartData.map((d, index) => {
                    const stepX = (chartWidth - 80) / chartData.length;
                    const x = 55 + index * stepX + (stepX - barWidth) / 2;
                    const maxCount = Math.max(1, summary.totalEmployees);

                    const totalPresent = d.present;
                    const lateCount = d.late;
                    const punctualCount = Math.max(0, totalPresent - lateCount);
                    const onLeaveCount = d.on_leave || 0;
                    const absentCount = Math.max(0, maxCount - totalPresent - onLeaveCount);

                    const maxHeight = 150;
                    const punctualHeight = (punctualCount / maxCount) * maxHeight;
                    const lateHeight = (lateCount / maxCount) * maxHeight;
                    const leaveHeight = (onLeaveCount / maxCount) * maxHeight;
                    const absentHeight = (absentCount / maxCount) * maxHeight;

                    const yAbsent = 175 - absentHeight;
                    const yLeave = yAbsent - leaveHeight;
                    const yLate = yLeave - lateHeight;
                    const yPunctual = yLate - punctualHeight;

                    const isHovered = hoveredDayIndex === index;

                    return (
                      <g
                        key={d.date}
                        onMouseEnter={() => setHoveredDayIndex(index)}
                        onMouseLeave={() => setHoveredDayIndex(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Weekend background column */}
                        {d.isWeekend && (
                          <rect
                            x={x - 4}
                            y="15"
                            width={barWidth + 8}
                            height="160"
                            fill="rgba(0,0,0,0.02)"
                            rx="4"
                          />
                        )}

                        {/* Hover Highlight bar */}
                        {isHovered && (
                          <rect
                            x={x - 4}
                            y="15"
                            width={barWidth + 8}
                            height="160"
                            fill="rgba(255, 122, 0, 0.08)"
                            rx="4"
                          />
                        )}

                        {/* Punctual segment (Green) */}
                        {punctualHeight > 0 && (
                          <rect
                            x={x}
                            y={yPunctual}
                            width={barWidth}
                            height={punctualHeight}
                            fill="#338855"
                            rx="2"
                          />
                        )}

                        {/* Late segment (Orange) */}
                        {lateHeight > 0 && (
                          <rect
                            x={x}
                            y={yLate}
                            width={barWidth}
                            height={lateHeight}
                            fill="var(--brand-orange)"
                            rx="2"
                          />
                        )}

                        {/* Leave segment (Blue) */}
                        {leaveHeight > 0 && (
                          <rect
                            x={x}
                            y={yLeave}
                            width={barWidth}
                            height={leaveHeight}
                            fill="#3b82f6"
                            rx="2"
                          />
                        )}

                        {/* Absent segment (Gray) */}
                        {absentHeight > 0 && (
                          <rect
                            x={x}
                            y={yAbsent}
                            width={barWidth}
                            height={absentHeight}
                            fill="var(--border-light)"
                            rx="2"
                          />
                        )}

                        {/* X-axis Day Label */}
                        <text
                          x={x + barWidth / 2}
                          y="194"
                          fontSize="9.5"
                          fill={d.isWeekend ? 'var(--text-secondary)' : 'var(--brand-navy)'}
                          textAnchor="middle"
                          fontWeight={isHovered ? '800' : '600'}
                        >
                          {d.label}
                        </text>

                        {/* Tooltip on Hover */}
                        {isHovered && (
                          <g>
                            <rect
                              x={Math.max(10, Math.min(chartWidth - 160, x - 70))}
                              y="5"
                              width="150"
                              height="65"
                              fill="var(--brand-navy)"
                              rx="6"
                              filter="drop-shadow(0 4px 6px rgba(0,0,0,0.3))"
                            />
                            <text x={Math.max(10, Math.min(chartWidth - 160, x - 70)) + 75} y="20" fill="#fff" fontSize="10" fontWeight="700" textAnchor="middle">
                              {d.label} ({d.date})
                            </text>
                            <text x={Math.max(10, Math.min(chartWidth - 160, x - 70)) + 10} y="34" fill="#4ade80" fontSize="9">
                              • À l'heure : {punctualCount}
                            </text>
                            <text x={Math.max(10, Math.min(chartWidth - 160, x - 70)) + 10} y="46" fill="#fb923c" fontSize="9">
                              • En retard : {lateCount}
                            </text>
                            <text x={Math.max(10, Math.min(chartWidth - 160, x - 70)) + 10} y="58" fill="#93c5fd" fontSize="9">
                              • En congé : {onLeaveCount} | Non pointé : {absentCount}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Radial Progress Gauge & Leave Breakdown */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'space-between' }}>
          <div>
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.35rem 0' }}>
              <PieChart size={20} style={{ color: 'var(--brand-orange)' }} /> Ponctualité & Types de Congés
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Jauge globale et répartition des absences
            </p>
          </div>

          {/* Radial Progress Gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ position: 'relative', width: '130px', height: '130px' }}>
              <svg width="100%" height="100%" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="15.91549430918954" fill="none" stroke="var(--border-light)" strokeWidth="3.5" />
                <circle
                  cx="20"
                  cy="20"
                  r="15.91549430918954"
                  fill="none"
                  stroke={punctualityColor}
                  strokeWidth="3.8"
                  strokeDasharray={`${summary.punctualityRate} ${100 - summary.punctualityRate}`}
                  strokeDashoffset="25"
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
                />
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                  {summary.punctualityRate}%
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  À l'heure
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 500 }}>
              Taux moyen sur la période ({summary.totalPunctual} / {summary.totalClockIns} arrivées)
            </span>
          </div>

          {/* Leave Breakdown Badges */}
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-navy)', display: 'block', marginBottom: '0.5rem' }}>
              Congés approuvés sur la période ({summary.totalLeaveDays} j) :
            </span>
            {statsData?.leaveBreakdown && Object.keys(statsData.leaveBreakdown).length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {Object.entries(statsData.leaveBreakdown).map(([type, days]) => (
                  <div
                    key={type}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      background: 'var(--background-light)',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--brand-navy)' }}>{type} :</span>
                    <strong style={{ color: 'var(--brand-orange)' }}>{days} j</strong>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Aucun congé approuvé sur cette période.
              </span>
            )}
          </div>

        </div>

      </div>

      {/* ==================================================== */}
      {/* 5. SECTION: SERVICE PERFORMANCE BREAKDOWN            */}
      {/* ==================================================== */}
      {statsData?.byService && statsData.byService.length > 0 && (
        <div className="panel">
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.35rem 0' }}>
              <Building2 size={20} style={{ color: 'var(--brand-orange)' }} /> Comparatif par Département & Service
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Performances de ponctualité, volume de pointages et congés posés par service
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {statsData.byService.map((svc) => {
              const svcColor =
                svc.punctualityRate >= 90
                  ? 'var(--success-color)'
                  : svc.punctualityRate >= 75
                  ? 'var(--warning-color)'
                  : 'var(--error-color)';

              return (
                <div
                  key={svc.service}
                  style={{
                    background: 'var(--background-light)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--brand-navy)' }}>
                      {svc.service}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.5rem', borderRadius: '12px', background: 'var(--panel-white)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                      {svc.employeesCount} membre{svc.employeesCount > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Progress Bar for Punctuality */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Ponctualité</span>
                      <strong style={{ color: svcColor }}>{svc.punctualityRate}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--border-light)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${svc.punctualityRate}%`,
                          height: '100%',
                          background: svcColor,
                          borderRadius: '3px',
                          transition: 'width 0.4s ease'
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Details stats */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.5rem' }}>
                    <span>Arrivées : <strong>{svc.totalClockIns}</strong></span>
                    <span>Retards : <strong style={{ color: svc.lateCount > 0 ? 'var(--warning-color)' : 'inherit' }}>{svc.lateCount}</strong></span>
                    <span>Congés : <strong>{svc.leaveDays} j</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. SECTION: INDIVIDUAL EMPLOYEE SUMMARY TABLE        */}
      {/* ==================================================== */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.35rem 0' }}>
              <UserCheck size={20} style={{ color: 'var(--brand-orange)' }} /> Récapitulatif par Collaborateur
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Détail individuel des pointages, retards, ponctualité et congés sur la période sélectionnée
            </p>
          </div>

          {/* Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 240px', maxWidth: '340px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Rechercher collaborateur..."
                value={employeeSearchQuery}
                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '2.2rem', paddingRight: '0.75rem', fontSize: '0.85rem' }}
              />
            </div>
          </div>
        </div>

        {/* Responsive Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--background-light)', textAlign: 'left', borderBottom: '2px solid var(--border-light)' }}>
                <th
                  onClick={() => handleSort('name')}
                  style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-navy)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    Collaborateur
                    {employeeSortField === 'name' ? (employeeSortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronsUpDown size={14} style={{ color: 'var(--text-secondary)' }} />}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('service')}
                  style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-navy)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    Service
                    {employeeSortField === 'service' ? (employeeSortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronsUpDown size={14} style={{ color: 'var(--text-secondary)' }} />}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('presentDays')}
                  style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-navy)', cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                    Jours Pointés
                    {employeeSortField === 'presentDays' ? (employeeSortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronsUpDown size={14} style={{ color: 'var(--text-secondary)' }} />}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('lateDays')}
                  style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-navy)', cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                    Retards
                    {employeeSortField === 'lateDays' ? (employeeSortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronsUpDown size={14} style={{ color: 'var(--text-secondary)' }} />}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('punctualityRate')}
                  style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-navy)', cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                    Ponctualité (%)
                    {employeeSortField === 'punctualityRate' ? (employeeSortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronsUpDown size={14} style={{ color: 'var(--text-secondary)' }} />}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('leaveDays')}
                  style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-navy)', cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                    Congés (Période)
                    {employeeSortField === 'leaveDays' ? (employeeSortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronsUpDown size={14} style={{ color: 'var(--text-secondary)' }} />}
                  </div>
                </th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-navy)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  Solde CP Restant
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    Calcul des statistiques en cours...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    Aucun collaborateur trouvé pour cette recherche.
                  </td>
                </tr>
              ) : (
                filteredEmployees.slice(0, employeeLimit).map((emp) => {
                  const empPunctualityColor =
                    emp.punctualityRate >= 90
                      ? 'var(--success-color)'
                      : emp.punctualityRate >= 75
                      ? 'var(--warning-color)'
                      : 'var(--error-color)';

                  return (
                    <tr key={emp.employee_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>
                          {emp.employee_first_name} {emp.employee_name}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span className="badge-role employee" style={{ fontSize: '0.75rem' }}>
                          {emp.service}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600 }}>
                        {emp.presentDays} j
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          fontWeight: 700,
                          color: emp.lateDays > 0 ? 'var(--warning-color)' : 'var(--text-secondary)',
                          background: emp.lateDays > 0 ? 'var(--warning-bg)' : 'transparent',
                          padding: emp.lateDays > 0 ? '0.2rem 0.5rem' : '0',
                          borderRadius: '6px'
                        }}>
                          {emp.lateDays}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            color: empPunctualityColor
                          }}>
                            {emp.punctualityRate}%
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            ({emp.punctualDays}/{emp.presentDays})
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600, color: emp.leaveDays > 0 ? 'var(--brand-orange)' : 'var(--text-secondary)' }}>
                        {emp.leaveDays > 0 ? `${emp.leaveDays} j` : '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--brand-navy)' }}>
                        {parseFloat(emp.remaining_balance || 0).toFixed(1)} j
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Row Limit Selector */}
        {filteredEmployees.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', padding: '0.5rem 0' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Afficher :</span>
            <select
              value={employeeLimit}
              onChange={(e) => setEmployeeLimit(Number(e.target.value))}
              style={{
                padding: '0.35rem 0.5rem',
                fontSize: '0.85rem',
                borderRadius: '6px',
                border: '1px solid var(--border-light)',
                backgroundColor: 'var(--panel-white)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                width: '120px',
                outline: 'none'
              }}
            >
              <option value={5}>5 lignes</option>
              <option value={10}>10 lignes</option>
              <option value={20}>20 lignes</option>
              <option value={50}>50 lignes</option>
              <option value={100}>100 lignes</option>
            </select>
          </div>
        )}
      </div>

    </div>
  );
}
