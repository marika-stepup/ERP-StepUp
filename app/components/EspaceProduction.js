import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Square,
  Clock,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Calendar,
  PenTool,
  Palette,
  Users,
  BarChart3,
  Code,
  Repeat,
  UserCheck,
  Building2,
  Mail,
  FileText,
  Wrench,
  Share2,
  PictureInPicture2,
  ExternalLink,
  Minimize2,
  Layers
} from 'lucide-react';
import { supabaseClient } from '../../lib/supabaseClient';
import ClientCombobox from './ClientCombobox';

export const FacebookIcon = ({ size = 18, color = "#1877F2" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export const InstagramIcon = ({ size = 18, color = "#E1306C" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

export const LinkedinIcon = ({ size = 18, color = "#0A66C2" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

export const GooglePostIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

export const PAUSE_PRESETS = [
  { id: 'cigarette', label: 'Cigarette', icon: '🚬', fullLabel: 'Pause Cigarette', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  { id: 'gouter', label: 'Goûter', icon: '🍪', fullLabel: 'Pause Goûter', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { id: 'dejeuner', label: 'Déjeuner', icon: '🍽️', fullLabel: 'Pause Déjeuner', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  { id: 'general', label: 'Pause', icon: '☕', fullLabel: 'Pause Café / Détente', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' }
];

export const DELIVERABLE_CARDS = [
  {
    id: 'redaction',
    title: 'Rédaction',
    categoryKey: 'Rédaction',
    themeColor: '#D91207',
    icon: PenTool,
    activities: [
      'Billet de blog',
      'Newsletter',
      'Stratégie',
      'Posts',
      'Correspondance mail/Slack/WhatsApp',
      'Relance client',
      'Compte rendu',
      'Modération',
      'Marketing de croissance',
      'Contrat'
    ]
  },
  {
    id: 'crea_graphique',
    title: 'Créa graphique',
    categoryKey: 'Créa graphique',
    themeColor: '#178FCB',
    icon: Palette,
    activities: [
      'Création d\'image',
      'Vidéo',
      'Maquette',
      'Logo',
      'Moodboard'
    ]
  },
  {
    id: 'reunion',
    title: 'Réunion',
    categoryKey: 'Réunion',
    themeColor: '#338855',
    icon: Users,
    activities: [
      'Réunions internes',
      'Réunions externes',
      'Réunion des team leader',
      'Présentation commerciale',
      'Brief',
      'Atelier de stratégie',
      'Entretien individuel',
      'KIDS',
      'Formation',
      'Meeting marketing de croissance',
      'Appel impromptu'
    ]
  },
  {
    id: 'data',
    title: 'Data',
    categoryKey: 'Data',
    themeColor: '#F59E0B',
    icon: BarChart3,
    activities: [
      'Édition des rapports',
      'Reporting',
      'Banque',
      'Factures',
      'Planification',
      'Devis',
      'RH',
      'Pointage',
      'Comptabilité'
    ]
  },
  {
    id: 'tech',
    title: 'Tech',
    categoryKey: 'Tech',
    themeColor: '#6366F1',
    icon: Code,
    activities: [
      'Bricolage',
      'Développement IA',
      'Maintenance',
      'Développement Web',
      'TMA',
      'Administration informatique'
    ]
  }
];

export const isStandardDeliverableTask = (task, card) => {
  if (!task || !card) return false;
  // Une tâche assignée est TOUJOURS une tâche spécifique, JAMAIS un livrable standard générique
  if (task.assigned_to || task.assigned_to_name) return false;

  const tName = (task.name || '').toLowerCase().trim();
  const tCat = (task.category || '').toLowerCase().trim();
  const cardTitle = (card.title || '').toLowerCase().trim();
  const cardKey = (card.categoryKey || '').toLowerCase().trim();
  const cardId = (card.id || '').toLowerCase().trim();

  // 1. Correspondance directe avec le titre ou la clé du livrable
  if (tName === cardTitle || tName === cardKey || tName === cardId) {
    return true;
  }

  // 2. La catégorie correspond et le nom de tâche est standard / générique
  if (tCat === cardKey || tCat === cardId) {
    if (!tName || tName === cardTitle || tName === cardKey || tName === cardId) {
      return true;
    }
  }

  // 3. Variations courantes (Créa, Tech, etc.)
  if (cardId === 'crea_graphique') {
    const isCreaCat = ['crea', 'créa', 'créa graphique', 'crea graphique', 'création graphique', 'creation graphique'].includes(tCat);
    const isCreaName = ['créa graphique', 'création graphique', 'crea graphique', 'crea_graphique', 'créa', 'crea'].includes(tName);
    if (isCreaName || (isCreaCat && (!tName || isCreaName))) {
      return true;
    }
  }

  if (cardId === 'redaction') {
    const isRedCat = ['redaction', 'rédaction'].includes(tCat);
    const isRedName = ['redaction', 'rédaction'].includes(tName);
    if (isRedName || (isRedCat && (!tName || isRedName))) {
      return true;
    }
  }

  if (cardId === 'reunion') {
    const isReuCat = ['reunion', 'réunion', 'reunions & gestion', 'réunions & gestion'].includes(tCat);
    const isReuName = ['reunion', 'réunion', 'reunions & gestion', 'réunions & gestion'].includes(tName);
    if (isReuName || (isReuCat && (!tName || isReuName))) {
      return true;
    }
  }

  return false;
};

/* ==========================================================================
   SHARED CHRONOMETER CARD VIEW (MAIN APP & DOCUMENT PiP PORTAL)
   ========================================================================== */
/* ==========================================================================
   SHARED CHRONOMETER CARD VIEW (MAIN APP & DOCUMENT PiP PORTAL)
   ========================================================================== */
function ChronoCardView({
  isPip = false,
  timerRunning,
  activeTask,
  activeTaskClientName,
  selectedClient,
  timerSeconds,
  formatSecondsToHM,
  handleStopTimer,
  handleCompleteTask,
  isStandardMission,
  isPipSupported,
  isPipActive,
  onTogglePip,
  activePause,
  pauseSeconds,
  handleStartPause,
  handleStopPause,
  suspendedTask
}) {
  const currentPausePreset = PAUSE_PRESETS.find(p => p.id === activePause) || {
    id: 'general',
    label: 'Pause',
    icon: '☕',
    fullLabel: 'Pause',
    color: '#ea580c'
  };

  return (
    <div
      className={`panel prod-active-card ${timerRunning ? 'running' : ''} ${activePause ? 'pause-running' : ''} ${isPip ? 'pip-window-card' : ''}`}
      style={{
        padding: isPip ? '0.45rem 0.6rem' : '1.25rem 1.5rem',
        textAlign: isPip ? 'center' : 'left',
        background: '#ffffff',
        borderRadius: isPip ? '8px' : '14px',
        border: activePause ? '1.5px solid #fed7aa' : '1px solid var(--border-light)',
        boxShadow: isPip ? '0 4px 12px rgba(0,0,0,0.08)' : 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isPip ? 'space-around' : 'space-between',
        gap: isPip ? '0.2rem' : '1rem',
        height: isPip ? '100%' : 'auto',
        boxSizing: 'border-box',
        overflow: 'hidden',
        width: '100%'
      }}
    >
      {/* CARD HEADER WITH TITLE & PiP TOGGLE */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isPip ? '0.3rem' : '0.5rem', color: timerRunning ? '#0f172a' : activePause ? '#ea580c' : '#64748b', fontWeight: '800', fontSize: isPip ? '0.62rem' : '0.88rem', letterSpacing: '0.3px' }}>
          {activePause ? (
            <>
              <Clock size={isPip ? 11 : 16} style={{ color: '#ea580c' }} />
              <span>PAUSE ACTIVE</span>
            </>
          ) : timerRunning ? (
            <>
              <span className="pip-live-dot" style={{ width: isPip ? '5px' : '8px', height: isPip ? '5px' : '8px' }} />
              <Clock size={isPip ? 11 : 16} style={{ color: '#2563eb' }} />
              <span>SESSION DE PRODUCTION EN COURS</span>
            </>
          ) : (
            <>
              <Clock size={isPip ? 11 : 16} style={{ color: '#94a3b8' }} />
              <span>CHRONOMÈTRE DE PRODUCTION</span>
            </>
          )}
        </div>

        {/* PiP BUTTON (Desktop Document Picture-in-Picture API) */}
        {isPipSupported && (
          <button
            type="button"
            onClick={onTogglePip}
            className={`pip-toggle-btn ${isPipActive ? 'active' : ''}`}
            style={{
              padding: isPip ? '0.15rem 0.45rem' : '0.35rem 0.75rem',
              fontSize: isPip ? '0.62rem' : '0.78rem',
              borderRadius: isPip ? '5px' : '8px',
              gap: isPip ? '0.25rem' : '0.4rem'
            }}
            title={isPip ? "Réattacher à l'application principale" : isPipActive ? "Fermer la fenêtre PiP" : "Détacher le chronomètre en fenêtre flottante (Always-on-top)"}
          >
            {isPip ? (
              <>
                <Minimize2 size={10} />
                <span>Réattacher</span>
              </>
            ) : isPipActive ? (
              <>
                <PictureInPicture2 size={13} />
                <span>PiP actif</span>
              </>
            ) : (
              <>
                <PictureInPicture2 size={13} />
                <span>Détacher (PiP)</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* CARD BODY */}
      {activePause ? (
        /* 1. ACTIVE PAUSE DISPLAY */
        <div className="active-timer-display" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <h3 style={{ fontSize: isPip ? '0.82rem' : '1.35rem', fontWeight: '800', color: '#0f172a', margin: isPip ? '0.05rem 0' : '0.25rem 0', textAlign: 'center' }}>
            {currentPausePreset.icon} {currentPausePreset.fullLabel}
          </h3>

          <div style={{ fontSize: isPip ? '0.62rem' : '0.8rem', color: '#64748b', fontWeight: '500', marginBottom: isPip ? '0.15rem' : '0.4rem' }}>
            {suspendedTask ? `Mission suspendue : ${suspendedTask.name}` : 'Pause active • Indépendante de tout client'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isPip ? '0.35rem' : '0.65rem', margin: isPip ? '0.15rem 0' : '0.8rem 0 0.7rem 0' }}>
            <div
              className="chrono-digits orange"
              style={{
                fontSize: isPip ? '1.45rem' : '3.4rem',
                margin: 0,
                letterSpacing: isPip ? '1px' : '2px',
                textShadow: isPip ? '0 0 8px rgba(249, 115, 22, 0.22)' : undefined
              }}
            >
              {formatSecondsToHM(pauseSeconds)}
            </div>
            <span
              className="chrono-sparkle-badge"
              title="Pause active"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: isPip ? '0.2rem' : '0.35rem',
                padding: isPip ? '0.15rem 0.35rem' : '0.3rem 0.65rem',
                background: 'rgba(249, 115, 22, 0.12)',
                border: '1px solid rgba(249, 115, 22, 0.35)',
                borderRadius: '9999px',
                fontSize: isPip ? '0.58rem' : '0.78rem',
                color: '#ea580c',
                fontWeight: 800,
                letterSpacing: '0.2px'
              }}
            >
              <span className="chrono-sparkle-dot orange" />
              {!isPip && <span>En pause</span>}
            </span>
          </div>

          <div style={{ width: '100%', maxWidth: isPip ? '190px' : '340px', height: isPip ? '3px' : '5px', background: '#fed7aa', borderRadius: '9999px', overflow: 'hidden', margin: isPip ? '0.1rem auto 0.45rem auto' : '0.2rem auto 1.2rem auto' }}>
            <div style={{ width: '60%', height: '100%', background: '#ea580c', borderRadius: '9999px' }}></div>
          </div>

          {/* Action buttons during pause */}
          <div style={{ display: 'flex', gap: isPip ? '0.4rem' : '0.75rem', width: '100%', maxWidth: isPip ? '200px' : (suspendedTask ? '340px' : '220px'), justifyContent: 'center' }}>
            {suspendedTask && (
              <button
                type="button"
                onClick={() => handleStopPause(true)}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isPip ? '0.3rem' : '0.5rem',
                  padding: isPip ? '0.35rem 0.65rem' : '0.75rem 1rem',
                  background: '#10b981',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: isPip ? '0.72rem' : '0.88rem',
                  borderRadius: isPip ? '5px' : '8px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.15s ease'
                }}
                title={`Reprendre ${suspendedTask.name}`}
              >
                <Play size={isPip ? 10 : 14} fill="white" /> Reprendre
              </button>
            )}

            <button
              type="button"
              onClick={() => handleStopPause(false)}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isPip ? '0.3rem' : '0.5rem',
                padding: isPip ? '0.35rem 0.65rem' : '0.75rem 1rem',
                background: '#ef4444',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: isPip ? '0.72rem' : '0.88rem',
                borderRadius: isPip ? '5px' : '8px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <Square size={isPip ? 9 : 13} fill="white" /> Fin de pause
            </button>
          </div>
        </div>
      ) : timerRunning && activeTask ? (
        /* 2. ACTIVE TASK RUNNING DISPLAY */
        <div className="active-timer-display" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {/* Task Name */}
          <h3
            title={activeTask.name}
            style={{
              fontSize: isPip ? '0.82rem' : '1.35rem',
              fontWeight: '800',
              color: '#0f172a',
              margin: isPip ? '0.05rem 0' : '0.25rem 0',
              textAlign: 'center',
              lineHeight: isPip ? '1.15' : '1.25',
              maxHeight: isPip ? '1.3em' : '2.6em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: isPip ? 'nowrap' : 'normal',
              width: '100%'
            }}
          >
            {activeTask.name}
          </h3>

          {/* Subtitle: Client Name Badge + Due date */}
          <div style={{ fontSize: isPip ? '0.62rem' : '0.8rem', color: '#64748b', fontWeight: '600', marginBottom: isPip ? '0.15rem' : '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isPip ? '0.25rem' : '0.4rem', flexWrap: 'wrap' }}>
            <span style={{
              color: '#178FCB',
              fontWeight: '800',
              background: 'rgba(23, 143, 203, 0.08)',
              padding: isPip ? '0.05rem 0.35rem' : '0.12rem 0.5rem',
              borderRadius: isPip ? '3px' : '4px',
              border: '1px solid rgba(23, 143, 203, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              <Briefcase size={isPip ? 9 : 12} />
              {activeTaskClientName || selectedClient?.name}
            </span>
            {activeTask.due_date && !isPip && (
              <>
                <span style={{ color: '#94a3b8' }}>•</span>
                <span>Échéance : {new Date(activeTask.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              </>
            )}
          </div>

          {/* Large Digital Timer Display */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isPip ? '0.35rem' : '0.65rem', margin: isPip ? '0.15rem 0' : '0.9rem 0 0.8rem 0' }}>
            <div
              className="chrono-digits blue"
              style={{
                fontSize: isPip ? '1.45rem' : '3.4rem',
                margin: 0,
                letterSpacing: isPip ? '1px' : '2px',
                textShadow: isPip ? '0 0 8px rgba(37, 99, 235, 0.22)' : undefined
              }}
            >
              {formatSecondsToHM(timerSeconds)}
            </div>
            <span
              className="chrono-sparkle-badge"
              title="Chronomètre actif"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: isPip ? '0.2rem' : '0.35rem',
                padding: isPip ? '0.15rem 0.35rem' : '0.3rem 0.65rem',
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                borderRadius: '9999px',
                fontSize: isPip ? '0.58rem' : '0.78rem',
                color: '#16a34a',
                fontWeight: 800,
                letterSpacing: '0.2px',
                boxShadow: '0 0 10px rgba(34, 197, 94, 0.2)'
              }}
            >
              <span className="chrono-sparkle-dot" />
              {!isPip && <span>Actif</span>}
            </span>
          </div>

          {/* Progress track indicator */}
          <div style={{ width: '100%', maxWidth: isPip ? '190px' : '340px', height: isPip ? '3px' : '5px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', margin: isPip ? '0.1rem auto 0.45rem auto' : '0.2rem auto 1.2rem auto' }}>
            <div style={{ width: '45%', height: '100%', background: '#2563eb', borderRadius: '9999px' }}></div>
          </div>

          {/* Action Buttons: Red STOP (and Green TERMINÉ) */}
          <div style={{ display: 'flex', gap: isPip ? '0.4rem' : '0.75rem', width: '100%', maxWidth: isPip ? '200px' : (isStandardMission ? '240px' : '340px'), justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleStopTimer}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isPip ? '0.3rem' : '0.5rem',
                padding: isPip ? '0.35rem 0.65rem' : '0.75rem 1.25rem',
                background: '#ef4444',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: isPip ? '0.72rem' : '0.92rem',
                borderRadius: isPip ? '5px' : '8px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Square size={isPip ? 9 : 13} fill="white" /> STOP
            </button>

            {!isStandardMission && (
              <button
                type="button"
                onClick={handleCompleteTask}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isPip ? '0.3rem' : '0.5rem',
                  padding: isPip ? '0.35rem 0.65rem' : '0.75rem 1.25rem',
                  background: '#10b981',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: isPip ? '0.72rem' : '0.92rem',
                  borderRadius: isPip ? '5px' : '8px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <CheckCircle size={isPip ? 11 : 16} color="white" /> TERMINÉ
              </button>
            )}
          </div>

          {/* Quick Pause Toolbar while task is running */}
          <div style={{ marginTop: isPip ? '0.4rem' : '1.25rem', width: '100%', borderTop: '1px solid var(--border-light)', paddingTop: isPip ? '0.3rem' : '0.85rem' }}>
            <span style={{ fontSize: isPip ? '0.58rem' : '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: isPip ? '0.2rem' : '0.45rem' }}>
              Prendre une pause :
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: isPip ? '0.25rem' : '0.4rem', width: '100%', maxWidth: '340px', margin: '0 auto' }}>
              {PAUSE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleStartPause(preset.id)}
                  title={`Lancer une pause ${preset.label}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: isPip ? '0.15rem' : '0.3rem',
                    padding: isPip ? '0.2rem 0.3rem' : '0.4rem 0.5rem',
                    fontSize: isPip ? '0.58rem' : '0.78rem',
                    fontWeight: '700',
                    borderRadius: isPip ? '4px' : '6px',
                    border: `1px solid ${preset.border}`,
                    background: preset.bg,
                    color: preset.color,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* 3. NO ACTIVE TASK / IDLE STATE */
        <div className="no-active-timer" style={{ textAlign: 'center', padding: isPip ? '0.25rem 0' : '0.8rem 0', width: '100%' }}>
          <p style={{ color: '#0f172a', fontWeight: '800', margin: '0 0 0.25rem 0', fontSize: isPip ? '0.78rem' : '1.1rem' }}>
            Aucune tâche en cours
          </p>
          <span style={{ fontSize: isPip ? '0.62rem' : '0.82rem', color: '#64748b', display: 'block', marginBottom: isPip ? '0.4rem' : '1rem' }}>
            {isPip ? 'Prenez une pause rapide :' : 'Lancez un livrable à droite ou prenez une pause immédiate :'}
          </span>

          {/* Quick Pause Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: isPip ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isPip ? '0.3rem' : '0.5rem', width: '100%', maxWidth: '380px', margin: '0 auto' }}>
            {PAUSE_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleStartPause(preset.id)}
                title={`Démarrer une pause ${preset.label}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: isPip ? '0.35rem' : '0.6rem 0.5rem',
                  fontSize: isPip ? '0.65rem' : '0.85rem',
                  fontWeight: '700',
                  borderRadius: isPip ? '5px' : '8px',
                  border: `1.5px solid ${preset.border}`,
                  background: preset.bg,
                  color: preset.color,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.03)'; }}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EspaceProduction({ user, token, clients, loading, refreshData, employeeName }) {
  const [selectedClient, setSelectedClient] = useState(null);

  // Active tracking state for the current logged-in user
  const [activeTask, setActiveTask] = useState(null);
  const [activeLogId, setActiveLogId] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Document Picture-in-Picture (PiP) State
  const [pipWindow, setPipWindow] = useState(null);
  const [isPipSupported, setIsPipSupported] = useState(false);

  // Pauses (cigarette, gouter, dejeuner, general)
  const [activePause, setActivePause] = useState(null); // 'cigarette' | 'gouter' | 'dejeuner' | 'general'
  const [pauseLogId, setPauseLogId] = useState(null);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [suspendedTask, setSuspendedTask] = useState(null);

  // Modals d'alerte et confirmation personnalisés
  const [clientOverviewTab, setClientOverviewTab] = useState('poles'); // 'poles' | 'contract'
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  const showAlert = (title, message) => {
    setAlertModal({ show: true, title, message });
  };

  const showConfirm = (title, message, onConfirm) => {
    setConfirmModal({ show: true, title, message, onConfirm });
  };

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const pauseStartTimeRef = useRef(null);

  // Vérifier la compatibilité Document Picture-in-Picture au montage
  useEffect(() => {
    if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
      setIsPipSupported(true);
    }
  }, []);

  // Fermer proprement la fenêtre PiP au démontage du composant
  useEffect(() => {
    return () => {
      if (pipWindow) {
        try {
          pipWindow.close();
        } catch (e) {}
      }
    };
  }, [pipWindow]);

  // Mettre à jour dynamiquement le titre de la fenêtre PiP flottante
  useEffect(() => {
    if (pipWindow && pipWindow.document) {
      if (timerRunning && activeTask) {
        pipWindow.document.title = `${formatSecondsToHM(timerSeconds)} • ${activeTask.name}`;
      } else if (activePause) {
        const preset = PAUSE_PRESETS.find(p => p.id === activePause) || { label: 'Pause', icon: '☕' };
        pipWindow.document.title = `${formatSecondsToHM(pauseSeconds)} • ${preset.icon} ${preset.label}`;
      } else {
        pipWindow.document.title = "⏱️ Chronomètre — StepUp RH";
      }
    }
  }, [pipWindow, timerSeconds, pauseSeconds, timerRunning, activeTask, activePause]);

  // Fonction pour ouvrir la fenêtre Document PiP Always-on-top
  const openPip = async () => {
    if (!isPipSupported) return null;
    if (pipWindow) return pipWindow;

    try {
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 250,
        height: 180,
        disallowReturnToOpener: false
      });

      // 1. Copie intégrale des styles CSS de l'application
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
          const style = pip.document.createElement('style');
          style.textContent = cssRules;
          pip.document.head.appendChild(style);
        } catch (e) {
          const link = pip.document.createElement('link');
          link.rel = 'stylesheet';
          link.type = styleSheet.type || 'text/css';
          link.media = styleSheet.media?.mediaText || '';
          link.href = styleSheet.href;
          pip.document.head.appendChild(link);
        }
      });

      // 2. Google Fonts (Orbitron + Polices modernes)
      const fontLink = pip.document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap';
      pip.document.head.appendChild(fontLink);

      pip.document.title = activeTask ? `⏱️ ${activeTask.name} — StepUp RH` : "⏱️ Chronomètre — StepUp RH";

      // 3. Style personnalisé dédié pour la fenêtre Always-on-top (Ultra-compacte)
      const customStyle = pip.document.createElement('style');
      customStyle.textContent = `
        :root {
          --brand-navy: #0f172a;
          --brand-orange: #ea580c;
          --background-light: #ffffff;
          --text-primary: #0f172a;
          --text-secondary: #64748b;
          --border-color: #e2e8f0;
          --border-light: #f1f5f9;
          --panel-white: #ffffff;
        }
        * {
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          background: #f8fafc;
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          user-select: none;
        }
        #pip-root {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 0.35rem;
          box-sizing: border-box;
        }
        .chrono-digits {
          font-family: 'Orbitron', monospace, sans-serif !important;
          font-weight: 800;
          letter-spacing: 1px;
          text-align: center;
          margin: 0.15rem 0 0.15rem 0;
          line-height: 1;
          font-size: 1.45rem !important;
        }
        .chrono-digits.blue {
          color: #2563eb;
          text-shadow: 0 0 8px rgba(37, 99, 235, 0.22);
        }
        .chrono-digits.orange {
          color: #f97316;
          text-shadow: 0 0 8px rgba(249, 115, 22, 0.22);
        }
        @keyframes chrono-sparkle-pulse {
          0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); opacity: 0.85; }
          50% { transform: scale(1.18); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); opacity: 1; }
          100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); opacity: 0.85; }
        }
        @keyframes chrono-sparkle-pulse-orange {
          0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7); opacity: 0.85; }
          50% { transform: scale(1.18); box-shadow: 0 0 0 6px rgba(249, 115, 22, 0); opacity: 1; }
          100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); opacity: 0.85; }
        }
        .chrono-sparkle-dot {
          width: 7px;
          height: 7px;
          background-color: #22c55e;
          border-radius: 50%;
          display: inline-block;
          animation: chrono-sparkle-pulse 1.4s infinite ease-in-out;
        }
        .chrono-sparkle-dot.orange {
          background-color: #f97316;
          animation: chrono-sparkle-pulse-orange 1.4s infinite ease-in-out;
        }
      `;
      pip.document.head.appendChild(customStyle);

      // 4. Conteneur racine pour React Portal
      const pipRoot = pip.document.createElement('div');
      pipRoot.id = 'pip-root';
      pip.document.body.appendChild(pipRoot);

      // 5. Gestion de la fermeture par l'utilisateur
      pip.addEventListener('pagehide', () => {
        setPipWindow(null);
      });

      setPipWindow(pip);
      return pip;
    } catch (err) {
      console.warn("Ouverture automatique PiP non disponible:", err);
      return null;
    }
  };

  // Fonction pour détacher / réattacher la fenêtre Document PiP
  const togglePip = async () => {
    if (!isPipSupported) {
      showAlert(
        "Document Picture-in-Picture non supporté",
        "Votre navigateur ne supporte pas l'API Document Picture-in-Picture. Cette fonctionnalité nécessite Google Chrome, Microsoft Edge ou un navigateur basé sur Chromium récent."
      );
      return;
    }

    if (pipWindow) {
      try {
        pipWindow.close();
      } catch (e) {}
      setPipWindow(null);
      return;
    }

    await openPip();
  };

  // Update selected client when shared clients list changes
  useEffect(() => {
    if (clients && clients.length > 0) {
      if (selectedClient) {
        const updated = clients.find(c => c.id === selectedClient.id);
        setSelectedClient(updated || clients[0]);
      } else {
        setSelectedClient(clients[0]);
      }
    } else {
      setSelectedClient(null);
    }
  }, [clients]);

  // Re-hydrate running chrono for the active user
  const fetchMyActiveLogs = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabaseClient
        .from('production_time_logs')
        .select('id, task_id, employee_id, employee_name, start_time, log_type')
        .eq('employee_id', user.id)
        .is('end_time', null);

      if (error) throw error;

      let myActiveProdLog = null;
      let myActivePauseLog = null;

      (data || []).forEach(log => {
        if (log.log_type === 'production') {
          myActiveProdLog = log;
        } else if (log.log_type.startsWith('pause') || log.log_type.startsWith('interruption:pause')) {
          myActivePauseLog = log;
        }
      });

      // 1. Re-hydrate running production task if any
      if (clients && clients.length > 0 && myActiveProdLog && !timerRunning) {
        let matchedTask = null;
        clients.forEach(c => {
          const t = (c.tasks || []).find(task => task.id === myActiveProdLog.task_id);
          if (t) matchedTask = t;
        });

        if (matchedTask) {
          setActiveTask(matchedTask);
          setActiveLogId(myActiveProdLog.id);

          const elapsed = Math.floor((Date.now() - new Date(myActiveProdLog.start_time).getTime()) / 1000);
          setTimerSeconds(elapsed > 0 ? elapsed : 0);
          startTimeRef.current = new Date(myActiveProdLog.start_time).getTime();
          setTimerRunning(true);
        }
      }

      // 2. Re-hydrate active pause if any
      if (myActivePauseLog) {
        const rawType = myActivePauseLog.log_type.includes(':') ? myActivePauseLog.log_type.split(':')[1] : 'general';
        setActivePause(rawType);
        setPauseLogId(myActivePauseLog.id);
        const elapsedPause = Math.floor((Date.now() - new Date(myActivePauseLog.start_time).getTime()) / 1000);
        setPauseSeconds(elapsedPause > 0 ? elapsedPause : 0);
        pauseStartTimeRef.current = new Date(myActivePauseLog.start_time).getTime();
      }
    } catch (err) {
      console.error('Error fetching active time logs:', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchMyActiveLogs();
  }, [user, clients]);

  // Timer interval updates (Production & Pause)
  useEffect(() => {
    if (timerRunning || activePause) {
      timerRef.current = setInterval(() => {
        if (activePause && pauseStartTimeRef.current) {
          const diff = Math.floor((Date.now() - pauseStartTimeRef.current) / 1000);
          setPauseSeconds(diff > 0 ? diff : 0);
        } else if (timerRunning && startTimeRef.current) {
          const diff = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setTimerSeconds(diff > 0 ? diff : 0);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, activePause]);

  const handleStartTimer = async (task) => {
    // 🚀 Ouverture automatique de la fenêtre flottante PiP Always-on-top au lancement de la tâche
    openPip();

    const prevActiveTask = activeTask;
    const prevActiveLogId = activeLogId;
    const prevTimerSeconds = timerSeconds;
    const prevTimerRunning = timerRunning;

    // Si une pause est active, la clore d'abord
    if (activePause && pauseLogId) {
      await handleStopPause(false);
    }

    // Stop current running timer if there is one
    if (timerRunning && activeTask) {
      await handleStopTimer();
    }

    // Optimistic UI update
    setActiveTask(task);
    setTimerSeconds(0);
    setTimerRunning(true);
    startTimeRef.current = Date.now();

    const start = new Date().toISOString();

    try {
      const res = await fetch('/api/production/time-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          task_id: task.id,
          employee_id: user.id,
          employee_name: employeeName || 'Collaborateur',
          duration_seconds: 0,
          log_type: 'production',
          start_time: start,
          end_time: null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'failed_to_start');
      }

      const data = await res.json();
      setActiveLogId(data.log.id);

    } catch (err) {
      console.error('Error starting production timer:', err);

      setActiveTask(prevActiveTask);
      setActiveLogId(prevActiveLogId);
      setTimerSeconds(prevTimerSeconds);
      setTimerRunning(prevTimerRunning);
      if (prevTimerRunning) {
        startTimeRef.current = Date.now() - prevTimerSeconds * 1000;
      }

      showAlert("Erreur", "Erreur lors du démarrage du chronomètre. Veuillez réessayer.");
    }
  };

  const handleStartDeliverable = async (card) => {
    if (!selectedClient) return;

    // 🚀 Déclencher l'ouverture de la fenêtre PiP dès le clic utilisateur
    openPip();

    // 1. Chercher UNIQUEMENT une tâche standard / générique (non assignée) pour ce livrable
    let targetTask = (selectedClient.tasks || []).find(t => isStandardDeliverableTask(t, card));

    // 2. Si elle n'existe pas encore en base, la créer à la volée (non assignée)
    if (!targetTask) {
      try {
        const res = await fetch('/api/production/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            client_id: selectedClient.id,
            category: card.categoryKey,
            name: card.title,
            budget_hours: 0,
            status: 'Non démarré'
          })
        });

        if (res.ok) {
          const data = await res.json();
          targetTask = data.task;
          await refreshData();
        } else {
          const errData = await res.json();
          showAlert("Erreur", errData.error || "Impossible d'initialiser le livrable.");
          return;
        }
      } catch (err) {
        console.error('Error creating deliverable task on demand:', err);
        showAlert("Erreur", "Erreur lors de la création du livrable.");
        return;
      }
    }

    if (targetTask) {
      handleStartTimer(targetTask);
    }
  };

  const handleStopTimer = async () => {
    if (!activeTask || !timerRunning) return;

    const stopTime = new Date().toISOString();
    const prodSeconds = timerSeconds;
    const currentLogId = activeLogId;

    setTimerRunning(false);
    setActiveTask(null);
    setActiveLogId(null);
    setTimerSeconds(0);

    try {
      if (currentLogId) {
        await fetch(`/api/production/time-logs/${currentLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            end_time: stopTime,
            duration_seconds: prodSeconds
          })
        });
      }

      await refreshData();
    } catch (err) {
      console.error('Error stopping timer:', err);
    }
  };

  const handleCompleteTask = async () => {
    if (!activeTask) return;

    if (pipWindow) {
      const confirmed = window.confirm("Êtes-vous sûr de vouloir marquer ce livrable comme terminé ? Cela arrêtera également le chronomètre.");
      if (confirmed) {
        const taskId = activeTask.id;
        await handleStopTimer();
        try {
          const res = await fetch(`/api/production/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'Fait' })
          });
          if (res.ok) {
            await refreshData();
          } else {
            const errData = await res.json();
            showAlert("Erreur", errData.error || "Erreur lors de la complétion de la tâche.");
          }
        } catch (err) {
          console.error('Error completing task:', err);
          showAlert("Erreur", "Erreur lors de la complétion de la tâche.");
        }
      }
      return;
    }

    showConfirm(
      "Compléter le livrable",
      "Êtes-vous sûr de vouloir marquer ce livrable comme terminé ? Cela arrêtera également le chronomètre.",
      async () => {
        const taskId = activeTask.id;
        await handleStopTimer();

        try {
          const res = await fetch(`/api/production/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'Fait' })
          });

          if (res.ok) {
            await refreshData();
          } else {
            const errData = await res.json();
            showAlert("Erreur", errData.error || "Erreur lors de la complétion de la tâche.");
          }
        } catch (err) {
          console.error('Error completing task:', err);
          showAlert("Erreur", "Erreur lors de la complétion de la tâche.");
        }
      }
    );
  };

  const handleStartPause = async (type = 'general') => {
    const now = new Date().toISOString();

    // 🚀 Ouverture automatique de la fenêtre flottante PiP
    openPip();

    // 1. Si une pause est déjà en cours, la terminer proprement
    if (activePause && pauseLogId) {
      try {
        await fetch(`/api/production/time-logs/${pauseLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            end_time: now,
            duration_seconds: pauseSeconds
          })
        });
      } catch (err) {
        console.error('Error closing previous pause:', err);
      }
    }

    // 2. Si une tâche est en cours, la suspendre (sauvegarder le temps et conserver la référence)
    if (activeTask && timerRunning) {
      setSuspendedTask(activeTask);
      const prodSeconds = timerSeconds;
      const currentLogId = activeLogId;

      setTimerRunning(false);
      setActiveTask(null);
      setActiveLogId(null);
      setTimerSeconds(0);

      try {
        if (currentLogId) {
          await fetch(`/api/production/time-logs/${currentLogId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              end_time: now,
              duration_seconds: prodSeconds
            })
          });
        }
      } catch (err) {
        console.error('Error suspending task for pause:', err);
      }
    }

    // 3. Démarrage de la nouvelle pause (100% indépendante de tout client)
    try {
      const res = await fetch('/api/production/time-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          task_id: null,
          employee_id: user.id,
          employee_name: employeeName || 'Collaborateur',
          duration_seconds: 0,
          log_type: `pause:${type}`,
          start_time: now,
          end_time: null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActivePause(type);
        setPauseLogId(data.log.id);
        setPauseSeconds(0);
        pauseStartTimeRef.current = Date.now();
        await refreshData();
      }
    } catch (err) {
      console.error('Error starting pause:', err);
    }
  };

  const handleStopPause = async (shouldResumeSuspended = false) => {
    const now = new Date().toISOString();
    const currentPauseLogId = pauseLogId;
    const currentPauseSec = pauseSeconds;

    setActivePause(null);
    setPauseLogId(null);
    setPauseSeconds(0);

    try {
      if (currentPauseLogId) {
        await fetch(`/api/production/time-logs/${currentPauseLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            end_time: now,
            duration_seconds: currentPauseSec
          })
        });
        await refreshData();
      }
    } catch (err) {
      console.error('Error stopping pause:', err);
    }

    if (shouldResumeSuspended && suspendedTask) {
      const taskToResume = suspendedTask;
      setSuspendedTask(null);
      handleStartTimer(taskToResume);
    } else {
      setSuspendedTask(null);
    }
  };

  const formatSecondsToHM = (totalSeconds) => {
    const hours = Math.floor((totalSeconds || 0) / 3600);
    const minutes = Math.floor(((totalSeconds || 0) % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const formatSecondsToHMText = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h${String(minutes).padStart(2, '0')}`;
    }
    return `${minutes} min`;
  };

  const activeTaskClientObj = activeTask ? clients.find(c => c.id === activeTask.client_id) : null;
  const activeTaskClientName = activeTaskClientObj ? activeTaskClientObj.name : '';

  // Filtrer TOUTES les tâches spécifiquement assignées à l'utilisateur courant (tous clients confondus)
  const allClientsTasks = (clients || []).flatMap(client =>
    (client.tasks || []).map(task => ({
      ...task,
      client_id: task.client_id || client.id,
      client_name: client.name || 'Client',
      client_code: client.code || ''
    }))
  );

  const assignedTasks = allClientsTasks.filter(task => {
    if (task.assigned_to || task.assigned_to_name) {
      const isAssignedToMe =
        task.assigned_to === user?.id ||
        task.assigned_to === user?.email ||
        (task.assigned_to_name && employeeName && task.assigned_to_name.trim().toLowerCase() === employeeName.trim().toLowerCase());
      return isAssignedToMe;
    }

    // Si la tâche n'a pas de assigned_to spécifié, vérifier si c'est une tâche spécifique / non-standard
    const isStandardDeliverable = DELIVERABLE_CARDS.some(c => isStandardDeliverableTask(task, c));

    return !isStandardDeliverable;
  });

  const renderDeliverableCard = (card) => {
    const IconComp = card.icon;

    // Trouver les tâches standard / génériques (non assignées) associées à ce livrable
    const genericTasks = (selectedClient?.tasks || []).filter(t => isStandardDeliverableTask(t, card));

    let totalSpentSec = 0;
    let totalBudgetHours = 0;
    genericTasks.forEach(t => {
      totalSpentSec += (t.time_spent_seconds || 0);
      totalBudgetHours += (t.budget_hours || 0);
    });

    const areAllTasksCompleted = genericTasks.length > 0 && genericTasks.every(t => t.status === 'Fait');
    const isCategoryActive = Boolean(
      activeTask &&
      timerRunning &&
      isStandardDeliverableTask(activeTask, card)
    );

    const totalBudgetSec = totalBudgetHours * 3600;
    const progressPercent = totalBudgetSec > 0 ? Math.min(Math.round((totalSpentSec / totalBudgetSec) * 100), 100) : 0;

    return (
      <div
        key={card.id}
        className={`deliverable-card-item ${areAllTasksCompleted ? 'completed' : isCategoryActive ? 'active' : ''}`}
        style={{
          borderLeft: `4px solid ${card.themeColor}`,
          background: '#ffffff',
          borderRadius: '12px',
          padding: '1.15rem 1.25rem',
          border: '1px solid var(--border-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
          transition: 'all 0.2s ease'
        }}
      >
        <div className="deliverable-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div className="deliverable-card-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              className="deliverable-card-icon-badge"
              style={{
                backgroundColor: `${card.themeColor}15`,
                color: card.themeColor,
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <IconComp size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 className="deliverable-card-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>
                  {card.title}
                </h3>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                ⏱️ {formatSecondsToHMText(totalSpentSec)} passées
              </span>
            </div>
          </div>

          <div className="deliverable-card-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
            {selectedClient && (
              <span className="deliverable-client-tag" style={{ margin: 0, fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '4px', background: 'rgba(23, 143, 203, 0.08)', color: '#178FCB', fontWeight: '700', border: '1px solid rgba(23, 143, 203, 0.2)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Briefcase size={10} />
                {selectedClient.code ? `${selectedClient.code} • ` : ''}{selectedClient.name}
              </span>
            )}
            {isCategoryActive ? (
              <div
                className="status-badge en-cours"
                style={{
                  background: 'rgba(234, 88, 12, 0.15)',
                  color: 'var(--brand-orange)',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '20px',
                  fontSize: '0.82rem'
                }}
              >
                <span className="dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--brand-orange)', display: 'inline-block' }}></span>
                En cours
              </div>
            ) : (
              <button
                onClick={() => handleStartDeliverable(card)}
                title={`Lancer le chronomètre sur ${card.title} (${selectedClient?.name || ''})`}
                style={{
                  background: 'var(--panel-white)',
                  border: '1px solid var(--border-light)',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                  padding: '0.35rem 0.95rem',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: '#10b981',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <Play size={13} fill="#10b981" />
                Démarrer
              </button>
            )}
          </div>
        </div>

        {/* Activities Tags */}
        <div className="deliverable-activities-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.2rem' }}>
          {card.activities.map(act => (
            <span key={act} className="activity-pill">
              {act}
            </span>
          ))}
        </div>

        {/* Progress bar for category if budget exists */}
        {totalBudgetHours > 0 && (
          <div style={{ marginTop: '0.2rem' }}>
            <div className="progress-bar-container" style={{ height: '5px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                className={`progress-bar-fill ${areAllTasksCompleted ? 'green' : isCategoryActive ? 'orange' : 'blue'}`}
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: areAllTasksCompleted ? '#338855' : isCategoryActive ? '#ff7a00' : '#2563eb',
                  borderRadius: '9999px'
                }}
              ></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="espace-production">
      {/* HEADER CONTROLS & CLIENT OVERVIEW */}
      <div className="panel prod-header" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-light)', marginBottom: '1.5rem', background: 'var(--panel-white)' }}>
        {/* ROW 1: Client Selector & Main Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1.25rem', width: '100%' }}>
          <div style={{ flex: '1 1 320px', maxWidth: '440px' }}>
            <ClientCombobox
              label="Espace Client"
              clients={clients}
              selectedClient={selectedClient}
              onSelectClient={(client) => setSelectedClient(client || null)}
              disabled={timerRunning}
              placeholder="Rechercher un client..."
            />
          </div>

          {selectedClient && (() => {
            const currentMonthFormatted = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            const currentMonthCapitalized = currentMonthFormatted.charAt(0).toUpperCase() + currentMonthFormatted.slice(1);

            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: '#f8fafc', padding: '0.55rem 0.95rem', borderRadius: '9px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <Calendar size={15} style={{ color: 'var(--brand-orange)' }} />
                  <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#334155' }}>
                    {currentMonthCapitalized}
                  </span>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: 'rgba(234, 88, 12, 0.08)', padding: '0.55rem 0.95rem', borderRadius: '9px', border: '1px solid rgba(234, 88, 12, 0.25)', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <Clock size={15} style={{ color: 'var(--brand-orange)' }} />
                  <span style={{ fontSize: '0.84rem', fontWeight: '800', color: 'var(--brand-orange)' }}>
                    {selectedClient.total_spent_hours}h consommées
                  </span>
                </div>

                {selectedClient.total_budget_hours > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: 'rgba(37, 99, 235, 0.08)', padding: '0.55rem 0.95rem', borderRadius: '9px', border: '1px solid rgba(37, 99, 235, 0.25)', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <BarChart3 size={15} style={{ color: '#2563eb' }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#2563eb' }}>
                      Budget : {selectedClient.total_budget_hours}h ({selectedClient.progression_percent || 0}%)
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {selectedClient && (() => {
          const currentMonthFormatted = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
          const currentMonthCapitalized = currentMonthFormatted.charAt(0).toUpperCase() + currentMonthFormatted.slice(1);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>

              {/* SEGMENTED TAB SWITCHER */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <button
                    type="button"
                    onClick={() => setClientOverviewTab('poles')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 1.1rem',
                      borderRadius: '7px',
                      border: 'none',
                      fontSize: '0.85rem',
                      fontWeight: clientOverviewTab === 'poles' ? '800' : '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: clientOverviewTab === 'poles' ? '#ffffff' : 'transparent',
                      color: clientOverviewTab === 'poles' ? 'var(--brand-navy)' : '#64748b',
                      boxShadow: clientOverviewTab === 'poles' ? '0 2px 4px rgba(0, 0, 0, 0.08)' : 'none'
                    }}
                  >
                    <BarChart3 size={16} style={{ color: clientOverviewTab === 'poles' ? 'var(--brand-orange)' : '#94a3b8' }} />
                    <span>Temps passé par pôle</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClientOverviewTab('contract')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 1.1rem',
                      borderRadius: '7px',
                      border: 'none',
                      fontSize: '0.85rem',
                      fontWeight: clientOverviewTab === 'contract' ? '800' : '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: clientOverviewTab === 'contract' ? '#ffffff' : 'transparent',
                      color: clientOverviewTab === 'contract' ? 'var(--brand-navy)' : '#64748b',
                      boxShadow: clientOverviewTab === 'contract' ? '0 2px 4px rgba(0, 0, 0, 0.08)' : 'none'
                    }}
                  >
                    <FileText size={16} style={{ color: clientOverviewTab === 'contract' ? 'var(--brand-orange)' : '#94a3b8' }} />
                    <span>Détails du contrat</span>
                  </button>
                </div>
              </div>

              {/* ONGLET 1: TEMPS PASSÉ PAR PÔLE (PLEINE LARGEUR) */}
              {clientOverviewTab === 'poles' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', width: '100%' }}>
                  {DELIVERABLE_CARDS.map(card => {
                    const IconComp = card.icon;
                    const catTasks = (selectedClient.tasks || []).filter(t => {
                      const tCat = (t.category || '').toLowerCase().trim();
                      const tName = (t.name || '').toLowerCase().trim();
                      const cardKey = (card.categoryKey || '').toLowerCase().trim();
                      const cardId = (card.id || '').toLowerCase().trim();
                      const cardTitle = (card.title || '').toLowerCase().trim();

                      if (tCat === cardKey || tCat === cardId || tName === cardTitle || tCat === cardTitle) return true;
                      if (cardId === 'crea_graphique' && (tCat.includes('créa') || tCat.includes('crea') || tName.includes('créa') || tName.includes('crea'))) return true;
                      if (cardId === 'redaction' && (tCat.includes('rédac') || tCat.includes('redac') || tName.includes('rédac') || tName.includes('redac'))) return true;
                      if (cardId === 'reunion' && (tCat.includes('réunion') || tCat.includes('reunion') || tName.includes('réunion') || tName.includes('reunion'))) return true;
                      if (cardId === 'data' && (tCat.includes('data') || tName.includes('data'))) return true;
                      if (cardId === 'tech' && (tCat.includes('tech') || tCat.includes('tma') || tCat.includes('dev') || tCat.includes('web') || tName.includes('tech') || tName.includes('tma'))) return true;
                      return false;
                    });

                    let spentSec = 0;
                    let budgetHours = 0;
                    catTasks.forEach(t => {
                      spentSec += (t.time_spent_seconds || 0);
                      budgetHours += (t.budget_hours || 0);
                    });

                    const displaySpent = formatSecondsToHMText(spentSec);

                    let fillPercent = 0;
                    if (budgetHours > 0) {
                      fillPercent = Math.min(Math.round((spentSec / (budgetHours * 3600)) * 100), 100);
                    } else if (selectedClient.total_budget_hours > 0) {
                      fillPercent = Math.min(Math.round(((spentSec / 3600) / selectedClient.total_budget_hours) * 100), 100);
                    } else if (spentSec > 0) {
                      fillPercent = 100;
                    }

                    return (
                      <div
                        key={card.id}
                        style={{
                          background: '#ffffff',
                          border: `1.5px solid ${card.themeColor}30`,
                          borderRadius: '10px',
                          padding: '0.9rem 1.1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.55rem',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.03)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              background: `${card.themeColor}15`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: card.themeColor
                            }}>
                              <IconComp size={16} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e293b' }}>
                              {card.title}
                            </span>
                          </div>

                          <span style={{ fontSize: '1.05rem', fontWeight: '800', color: card.themeColor }}>
                            {displaySpent}
                          </span>
                        </div>

                        <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.max(fillPercent, spentSec > 0 ? 8 : 0)}%`,
                              height: '100%',
                              background: card.themeColor,
                              borderRadius: '9999px',
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#64748b' }}>
                          <span>{budgetHours > 0 ? `Budget : ${budgetHours}h` : 'Consommation'}</span>
                          {budgetHours > 0 && <span style={{ fontWeight: '700' }}>{fillPercent}%</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ONGLET 2: DÉTAILS DU CONTRAT (PLEINE LARGEUR) */}
              {clientOverviewTab === 'contract' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', width: '100%' }}>
                    {/* Facebook */}
                    <div
                      className="contract-detail-card"
                      style={{
                        padding: '0.8rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(24, 119, 242, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <div style={{ color: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FacebookIcon size={22} color="#1877F2" />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Posts Facebook</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                          {selectedClient.posts_facebook || 0} <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#64748b' }}>/ mois</span>
                        </div>
                      </div>
                    </div>

                    {/* Instagram */}
                    <div
                      className="contract-detail-card"
                      style={{
                        padding: '0.8rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(225, 48, 108, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <div style={{ color: '#E1306C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <InstagramIcon size={22} color="#E1306C" />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Posts Instagram</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                          {selectedClient.posts_instagram || 0} <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#64748b' }}>/ mois</span>
                        </div>
                      </div>
                    </div>

                    {/* LinkedIn */}
                    <div
                      className="contract-detail-card"
                      style={{
                        padding: '0.8rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(10, 102, 194, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <div style={{ color: '#0A66C2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <LinkedinIcon size={22} color="#0A66C2" />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Posts LinkedIn</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                          {selectedClient.posts_linkedin || 0} <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#64748b' }}>/ mois</span>
                        </div>
                      </div>
                    </div>

                    {/* Google Post */}
                    <div
                      className="contract-detail-card"
                      style={{
                        padding: '0.8rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(66, 133, 244, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <div style={{ color: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <GooglePostIcon size={22} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Google Posts</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                          {selectedClient.posts_google || 0} <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#64748b' }}>/ mois</span>
                        </div>
                      </div>
                    </div>

                    {/* TMA */}
                    <div
                      className="contract-detail-card"
                      style={{
                        padding: '0.8rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <div style={{ color: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Wrench size={22} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>TMA / Maint.</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                          {selectedClient.tma ? (typeof selectedClient.tma === 'string' && (selectedClient.tma.toLowerCase().includes('h') || selectedClient.tma.toLowerCase().includes('min')) ? selectedClient.tma : `${selectedClient.tma}h`) : (selectedClient.tma_hours ? `${selectedClient.tma_hours}h` : '0h')}
                        </div>
                      </div>
                    </div>

                    {/* Blog */}
                    <div
                      className="contract-detail-card"
                      style={{
                        padding: '0.8rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(234, 88, 12, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <div style={{ color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={22} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Articles Blog</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                          {selectedClient.blog_count || 0} <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#64748b' }}>/ mois</span>
                        </div>
                      </div>
                    </div>

                    {/* Newsletter */}
                    <div
                      className="contract-detail-card"
                      style={{
                        padding: '0.8rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(2, 132, 199, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <div style={{ color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Mail size={22} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Newsletters</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                          {selectedClient.newsletter_count || 0} <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#64748b' }}>/ mois</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tâches inquantifiables */}
                  {selectedClient.unquantifiable_tasks && (
                    <div style={{ fontSize: '0.85rem', background: '#fffbeb', padding: '0.65rem 0.9rem', borderRadius: '8px', borderLeft: '4px solid #f59e0b', color: '#92400e', lineHeight: '1.4' }}>
                      <strong>📌 Notes & Tâches inquantifiables :</strong> {selectedClient.unquantifiable_tasks}
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })()}
      </div>

      {loading ? (
        <div className="loading-state" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Chargement de l'espace de production...
        </div>
      ) : !selectedClient ? (
        <div className="empty-state panel" style={{ padding: '3rem', textAlign: 'center', marginTop: '1rem' }}>
          <AlertCircle size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
          <h3>Aucun client sélectionné</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Veuillez sélectionner un client dans le menu ci-dessus.</p>
        </div>
      ) : (
        <div className="prod-vertical-layout" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>

          {/* 1. CHRONOMÈTRE POSITIONNÉ AU-DESSUS (COMMAND CENTER) */}
          <div className="prod-chrono-hero-wrapper" style={{ width: '100%' }}>
            <ChronoCardView
              isPip={false}
              timerRunning={timerRunning}
              activeTask={activeTask}
              activeTaskClientName={activeTaskClientName}
              selectedClient={selectedClient}
              timerSeconds={timerSeconds}
              formatSecondsToHM={formatSecondsToHM}
              handleStopTimer={handleStopTimer}
              handleCompleteTask={handleCompleteTask}
              isStandardMission={DELIVERABLE_CARDS.some(c => isStandardDeliverableTask(activeTask, c))}
              isPipSupported={isPipSupported}
              isPipActive={!!pipWindow}
              onTogglePip={togglePip}
              activePause={activePause}
              pauseSeconds={pauseSeconds}
              handleStartPause={handleStartPause}
              handleStopPause={handleStopPause}
              suspendedTask={suspendedTask}
            />
          </div>

          {/* 2. MISSIONS ACTIVES : PLEINE LARGEUR & SCINDÉE EN 2 COLONNES */}
          <div className="panel deliverables-card" style={{ width: '100%', padding: '1.5rem 1.75rem', borderRadius: '14px', border: '1px solid var(--border-light)', background: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <h2 className="panel-title" style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <Layers size={22} style={{ color: 'var(--brand-orange)' }} />
                  MISSIONS ACTIVES
                </h2>
                <p className="panel-subtitle" style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>
                  Sélectionnez votre pôle d'intervention et démarrez votre session de travail.
                </p>
              </div>

              {selectedClient && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    background: 'rgba(23, 143, 203, 0.08)',
                    border: '1.5px solid rgba(23, 143, 203, 0.25)',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '8px'
                  }}
                >
                  <Briefcase size={16} style={{ color: '#178FCB' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client actif :</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#178FCB' }}>
                    {selectedClient.code ? `${selectedClient.code} - ` : ''}{selectedClient.name}
                  </span>
                </div>
              )}
            </div>

            {/* GRILLE À 2 COLONNES (Rédaction + Créa graphique D'UN CÔTÉ, Réunion + Data + Tech DE L'AUTRE) */}
            <div
              className="deliverables-two-columns-layout"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '1.5rem',
                alignItems: 'start'
              }}
            >
              {/* COLONNE GAUCHE : RÉDACTION & CRÉA GRAPHIQUE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.4rem', borderBottom: '2px solid rgba(217, 18, 7, 0.25)' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    ✍️ Pôle Contenu & Création
                  </span>
                </div>

                {DELIVERABLE_CARDS.filter(c => ['redaction', 'crea_graphique'].includes(c.id)).map(card => (
                  renderDeliverableCard(card)
                ))}
              </div>

              {/* COLONNE DROITE : RÉUNION, DATA & TECH */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.4rem', borderBottom: '2px solid rgba(51, 136, 85, 0.25)' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    👥 Pôle Gestion, Data & Tech
                  </span>
                </div>

                {DELIVERABLE_CARDS.filter(c => ['reunion', 'data', 'tech'].includes(c.id)).map(card => (
                  renderDeliverableCard(card)
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* CUSTOM ALERT MODAL */}
      {alertModal.show && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <h2 className="modal-title" style={{ color: 'var(--brand-orange)', marginBottom: '1rem' }}>
              {alertModal.title}
            </h2>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              {alertModal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minWidth: '100px' }}
                onClick={() => setAlertModal({ show: false, title: '', message: '' })}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmModal.show && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '440px', width: '90%', textAlign: 'center' }}>
            <h2 className="modal-title" style={{ marginBottom: '1rem' }}>
              {confirmModal.title}
            </h2>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              {confirmModal.message}
            </p>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ minWidth: '100px' }}
                onClick={() => setConfirmModal({ show: false, title: '', message: '', onConfirm: null })}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minWidth: '100px' }}
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ show: false, title: '', message: '', onConfirm: null });
                }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PICTURE-IN-PICTURE (PiP) PORTAL */}
      {pipWindow && pipWindow.document && pipWindow.document.getElementById('pip-root') && (
        createPortal(
          <ChronoCardView
            isPip={true}
            timerRunning={timerRunning}
            activeTask={activeTask}
            activeTaskClientName={activeTaskClientName}
            selectedClient={selectedClient}
            timerSeconds={timerSeconds}
            formatSecondsToHM={formatSecondsToHM}
            handleStopTimer={handleStopTimer}
            handleCompleteTask={handleCompleteTask}
            isStandardMission={DELIVERABLE_CARDS.some(c => isStandardDeliverableTask(activeTask, c))}
            isPipSupported={isPipSupported}
            isPipActive={true}
            onTogglePip={togglePip}
            activePause={activePause}
            pauseSeconds={pauseSeconds}
            handleStartPause={handleStartPause}
            handleStopPause={handleStopPause}
            suspendedTask={suspendedTask}
          />,
          pipWindow.document.getElementById('pip-root')
        )
      )}
    </div>
  );
}
