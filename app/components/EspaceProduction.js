import { useEffect, useState, useRef } from 'react';
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
  Code
} from 'lucide-react';
import { supabaseClient } from '../../lib/supabaseClient';

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
      'Correspondance mail',
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
      'Meeting marketing de croissance'
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

export default function EspaceProduction({ user, token, clients, loading, refreshData, employeeName }) {
  const [selectedClient, setSelectedClient] = useState(null);

  // Active tracking state for the current logged-in user
  const [activeTask, setActiveTask] = useState(null); 
  const [activeLogId, setActiveLogId] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  
  // Interruptions
  const [activeInterruption, setActiveInterruption] = useState(null); // 'slack', 'meeting', 'pause', 'call'
  const [interruptionLogId, setInterruptionLogId] = useState(null);
  const [interruptionSeconds, setInterruptionSeconds] = useState(0);

  // Allocation client pour interruptions
  const [interruptionModalOpen, setInterruptionModalOpen] = useState(false);
  const [interruptionTypeToStart, setInterruptionTypeToStart] = useState(null);
  const [selectedInterruptionClientId, setSelectedInterruptionClientId] = useState('');
  const [activeInterruptionClientId, setActiveInterruptionClientId] = useState(null);

  // Modals d'alerte et confirmation personnalisés
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
  const interruptionStartTimeRef = useRef(null);

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
      let myActiveInterLog = null;

      (data || []).forEach(log => {
        if (log.log_type === 'production') {
          myActiveProdLog = log;
        } else if (log.log_type.startsWith('interruption:')) {
          myActiveInterLog = log;
        }
      });

      // Re-hydrate active timer state using the pre-fetched clients prop
      if (clients && clients.length > 0) {
        if (myActiveProdLog && !timerRunning) {
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

            if (myActiveInterLog) {
              const type = myActiveInterLog.log_type.split(':')[1];
              setActiveInterruption(type);
              setInterruptionLogId(myActiveInterLog.id);
              
              let matchedInterTaskClient = null;
              clients.forEach(c => {
                const t = (c.tasks || []).find(task => task.id === myActiveInterLog.task_id);
                if (t) matchedInterTaskClient = c;
              });
              if (matchedInterTaskClient) {
                setActiveInterruptionClientId(matchedInterTaskClient.id);
              }

              const elapsedInter = Math.floor((Date.now() - new Date(myActiveInterLog.start_time).getTime()) / 1000);
              setInterruptionSeconds(elapsedInter > 0 ? elapsedInter : 0);
              interruptionStartTimeRef.current = new Date(myActiveInterLog.start_time).getTime();
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching active time logs:', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchMyActiveLogs();
  }, [user, clients]);

  // Timer interval updates
  useEffect(() => {
    if (timerRunning || activeInterruption) {
      timerRef.current = setInterval(() => {
        if (activeInterruption) {
          const diff = Math.floor((Date.now() - interruptionStartTimeRef.current) / 1000);
          setInterruptionSeconds(diff);
        } else {
          const diff = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setTimerSeconds(diff);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, activeInterruption]);

  const handleStartTimer = async (task) => {
    const prevActiveTask = activeTask;
    const prevActiveLogId = activeLogId;
    const prevTimerSeconds = timerSeconds;
    const prevTimerRunning = timerRunning;

    // Stop current running timer if there is one
    if (timerRunning && activeTask) {
      await handleStopTimer();
    }

    // Optimistic UI update
    setActiveTask(task);
    setTimerSeconds(0);
    setInterruptionSeconds(0);
    setActiveInterruption(null);
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

    // 1. Chercher si une tâche existe déjà pour ce livrable
    let targetTask = (selectedClient.tasks || []).find(
      t => t.category?.toLowerCase() === card.categoryKey.toLowerCase() || 
           t.name?.toLowerCase() === card.title.toLowerCase() ||
           t.category?.toLowerCase() === card.id.toLowerCase()
    );

    // 2. Si elle n'existe pas encore en base, la créer à la volée
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
    const currentInterLogId = interruptionLogId;
    const interSeconds = interruptionSeconds;

    setTimerRunning(false);
    setActiveTask(null);
    setActiveLogId(null);
    setActiveInterruption(null);
    setInterruptionLogId(null);
    setActiveInterruptionClientId(null);
    setTimerSeconds(0);
    setInterruptionSeconds(0);

    try {
      if (currentInterLogId) {
        await fetch(`/api/production/time-logs/${currentInterLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            end_time: stopTime,
            duration_seconds: interSeconds
          })
        });
      }

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

  const handleToggleInterruption = async (type) => {
    const now = new Date().toISOString();

    if (activeInterruption === type) {
      const interSeconds = interruptionSeconds;
      const currentInterLogId = interruptionLogId;

      setActiveInterruption(null);
      setInterruptionLogId(null);
      setInterruptionSeconds(0);
      setActiveInterruptionClientId(null);

      if (activeTask) {
        startTimeRef.current = startTimeRef.current + (Date.now() - interruptionStartTimeRef.current);
      }

      try {
        if (currentInterLogId) {
          await fetch(`/api/production/time-logs/${currentInterLogId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              end_time: now,
              duration_seconds: interSeconds
            })
          });
          await refreshData();
        }
      } catch (err) {
        console.error('Error ending interruption:', err);
      }
    } else {
      handleStartInterruption(type);
    }
  };

  const handleStartInterruption = async (type, targetClientId = null) => {
    const now = new Date().toISOString();

    if (activeInterruption && interruptionLogId) {
      try {
        await fetch(`/api/production/time-logs/${interruptionLogId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            end_time: now,
            duration_seconds: interruptionSeconds
          })
        });
      } catch (err) {
        console.error('Error stopping previous interruption:', err);
      }
    }

    let resolvedClientId = targetClientId;
    if (!resolvedClientId && activeTask) {
      resolvedClientId = activeTask.client_id;
    }

    if (activeTask && timerRunning) {
      await handleStopTimer();
    }

    let targetTaskId = null;
    if (resolvedClientId) {
      const clientObj = clients.find(c => c.id === resolvedClientId);
      if (clientObj && clientObj.tasks && clientObj.tasks.length > 0) {
        targetTaskId = clientObj.tasks[0].id;
      }
    }

    if (!targetTaskId) {
      showAlert("Action impossible", "Le client choisi n'a aucune tâche configurée.");
      return;
    }

    try {
      const res = await fetch('/api/production/time-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          task_id: targetTaskId,
          employee_id: user.id,
          employee_name: employeeName || 'Collaborateur',
          duration_seconds: 0,
          log_type: `interruption:${type}`,
          start_time: now,
          end_time: null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveInterruption(type);
        setInterruptionLogId(data.log.id);
        setInterruptionSeconds(0);
        setActiveInterruptionClientId(resolvedClientId);
        interruptionStartTimeRef.current = Date.now();
      }
    } catch (err) {
      console.error('Error starting new interruption:', err);
    }
  };

  const handleInterruptionClick = (type) => {
    if (activeInterruption === type) {
      handleToggleInterruption(type);
    } else if (type === 'pause') {
      const clientId = activeTask ? activeTask.client_id : (selectedClient?.id || clients[0]?.id || '');
      handleStartInterruption('pause', clientId);
    } else {
      setInterruptionTypeToStart(type);
      setSelectedInterruptionClientId(activeTask?.client_id || selectedClient?.id || clients[0]?.id || '');
      setInterruptionModalOpen(true);
    }
  };

  const formatSecondsToHMS = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

  const activeInterruptionClientObj = activeInterruptionClientId ? clients.find(c => c.id === activeInterruptionClientId) : null;
  const activeInterruptionClientName = activeInterruptionClientObj ? activeInterruptionClientObj.name : '';

  return (
    <div className="espace-production">
      {/* HEADER CONTROLS */}
      <div className="prod-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 className="prod-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Briefcase size={24} style={{ color: 'var(--brand-orange)' }} />
              Espace Client :
            </h1>
            <select 
              className="client-selector"
              value={selectedClient?.id || ''}
              onChange={(e) => {
                const client = clients.find(c => c.id === e.target.value);
                setSelectedClient(client || null);
              }}
              disabled={timerRunning}
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
              ))}
              {clients.length === 0 && <option value="">Aucun client</option>}
            </select>
          </div>

          {selectedClient && (
            <div className="contract-progression">
              <div className="progression-text">
                <span>Progression du contrat ({selectedClient.contract_period}) :</span>
                <strong>{selectedClient.progression_percent}% consommé</strong>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill orange"
                  style={{ width: `${Math.min(selectedClient.progression_percent, 100)}%` }}
                ></div>
              </div>
              <div className="progression-hours">
                {selectedClient.total_spent_hours}h passées / {selectedClient.total_budget_hours}h budgétées
              </div>
            </div>
          )}
        </div>

        {selectedClient && (
          <div className="contract-details-container" style={{ width: '100%', marginTop: '1.2rem', paddingTop: '1.2rem', borderTop: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                {selectedClient.start_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <Calendar size={14} style={{ color: 'var(--brand-orange)' }} />
                    <span>Début : <strong>{new Date(selectedClient.start_date).toLocaleDateString('fr-FR')}</strong></span>
                  </div>
                )}
                {selectedClient.end_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <Calendar size={14} style={{ color: 'var(--brand-orange)' }} />
                    <span>Fin : <strong>{new Date(selectedClient.end_date).toLocaleDateString('fr-FR')}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* 5 Deliverables header summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {DELIVERABLE_CARDS.map(card => {
                const IconComp = card.icon;
                const catTasks = (selectedClient.tasks || []).filter(
                  t => t.category?.toLowerCase() === card.categoryKey.toLowerCase() ||
                       t.name?.toLowerCase() === card.title.toLowerCase() ||
                       t.category?.toLowerCase() === card.id.toLowerCase()
                );
                let spentSeconds = 0;
                let budgetHours = 0;
                catTasks.forEach(t => {
                  spentSeconds += (t.time_spent_seconds || 0);
                  budgetHours += (t.budget_hours || 0);
                });

                return (
                  <div 
                    key={card.id} 
                    className="deliverable-mini-card" 
                    style={{ 
                      padding: '0.6rem 0.8rem', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border-light)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.6rem', 
                      background: 'var(--panel-white)' 
                    }}
                  >
                    <div style={{ color: card.themeColor, display: 'flex' }}>
                      <IconComp size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{card.title}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700' }}>
                        {formatSecondsToHMText(spentSeconds)}
                        {budgetHours > 0 && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>
                            / {budgetHours}h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Unquantifiable tasks */}
            {selectedClient.unquantifiable_tasks && (
              <div style={{ marginTop: '1rem', fontSize: '0.85rem', background: 'var(--background-light)', padding: '0.6rem 0.8rem', borderRadius: '6px', borderLeft: '3px solid var(--brand-orange)', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                <strong>Tâches inquantifiables :</strong> {selectedClient.unquantifiable_tasks}
              </div>
            )}
          </div>
        )}
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
        <div className="prod-grid">
          
          {/* LEFT COLUMN: ACTIVE TRACKING & INTERRUPTIONS */}
          <div className="prod-left-column">
            
            {/* ACTIVE CHRONO CARD */}
            <div className={`panel prod-active-card ${timerRunning ? 'running' : ''}`} style={{ padding: '1.75rem 1.5rem', textAlign: 'center' }}>
              {timerRunning && activeTask ? (
                <div className="active-timer-display" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* 1. Header: Clock Icon + TÂCHE EN COURS */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', color: '#0f172a', fontWeight: '800', fontSize: '1rem', letterSpacing: '0.5px' }}>
                    <Clock size={19} style={{ color: '#ea580c' }} />
                    <span>TÂCHE EN COURS</span>
                  </div>

                  {/* 2. Task Name */}
                  <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#0f172a', margin: '0.9rem 0 0.25rem 0', textAlign: 'center', lineHeight: '1.3' }}>
                    {activeTask.name}
                  </h3>

                  {/* 3. Subtitle / Due date if available (WITHOUT BUDGET ALLOUÉ) */}
                  <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '0.5rem' }}>
                    {activeTask.due_date ? (
                      <span>Échéance : {new Date(activeTask.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
                    ) : (
                      <span>{activeTaskClientName ? `${activeTaskClientName} • ` : ''}{activeTask.category}</span>
                    )}
                  </div>

                  {/* 4. Large Digital Timer Display */}
                  <div style={{ 
                    fontSize: '3.4rem', 
                    fontWeight: '800', 
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", 
                    color: '#2563eb', 
                    letterSpacing: '1px', 
                    lineHeight: '1', 
                    margin: '1.1rem 0 0.9rem 0' 
                  }}>
                    {formatSecondsToHMS(timerSeconds)}
                  </div>

                  {/* 5. Progress track indicator */}
                  <div style={{ width: '100%', maxWidth: '340px', height: '6px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', margin: '0.2rem auto 1.5rem auto' }}>
                    <div style={{ width: '35%', height: '100%', background: '#2563eb', borderRadius: '9999px' }}></div>
                  </div>

                  {activeInterruption && (
                    <div className="active-interruption-banner" style={{ marginBottom: '1.25rem', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '340px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: '600' }}>
                        Pause ({activeInterruption}) : {formatSecondsToHMS(interruptionSeconds)}
                      </span>
                      <button 
                        onClick={() => handleToggleInterruption(activeInterruption)}
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#d97706', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                      >
                        Reprendre
                      </button>
                    </div>
                  )}

                  {/* 6. Two Action Buttons: Red STOP & Green TERMINÉ */}
                  <div style={{ display: 'flex', gap: '0.85rem', width: '100%', maxWidth: '340px', justifyContent: 'center' }}>
                    <button 
                      onClick={handleStopTimer}
                      style={{ 
                        flex: 1, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '0.5rem', 
                        padding: '0.7rem 1.25rem', 
                        background: '#ef4444', 
                        color: '#ffffff', 
                        fontWeight: '700', 
                        fontSize: '0.95rem', 
                        borderRadius: '8px', 
                        border: 'none', 
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      <Square size={13} fill="white" /> STOP
                    </button>
                    <button 
                      onClick={handleCompleteTask}
                      style={{ 
                        flex: 1, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '0.5rem', 
                        padding: '0.7rem 1.25rem', 
                        background: '#10b981', 
                        color: '#ffffff', 
                        fontWeight: '700', 
                        fontSize: '0.95rem', 
                        borderRadius: '8px', 
                        border: 'none', 
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      <CheckCircle size={16} color="white" /> TERMINÉ
                    </button>
                  </div>
                </div>
              ) : activeInterruption ? (
                <div className="active-timer-display" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', color: '#ea580c', fontWeight: '800', fontSize: '1rem', letterSpacing: '0.5px' }}>
                    <Clock size={19} style={{ color: '#ea580c' }} />
                    <span>INTERRUPTION EN COURS</span>
                  </div>

                  <h3 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#0f172a', margin: '0.9rem 0 0.25rem 0', textAlign: 'center', textTransform: 'capitalize' }}>
                    {activeInterruption === 'slack' ? 'Slack / Mails' :
                     activeInterruption === 'meeting' ? 'Point Interne' :
                     activeInterruption === 'pause' ? 'Pause' : 'Appel Impromptu'}
                  </h3>

                  <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500', marginBottom: '0.5rem' }}>
                    {activeInterruptionClientName ? `Client : ${activeInterruptionClientName}` : 'Met le chrono en pause'}
                  </div>
                  
                  <div style={{ 
                    fontSize: '3.4rem', 
                    fontWeight: '800', 
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", 
                    color: '#f97316', 
                    letterSpacing: '1px', 
                    lineHeight: '1', 
                    margin: '1.1rem 0 0.9rem 0' 
                  }}>
                    {formatSecondsToHMS(interruptionSeconds)}
                  </div>

                  <div style={{ width: '100%', maxWidth: '340px', height: '6px', background: '#fed7aa', borderRadius: '9999px', overflow: 'hidden', margin: '0.2rem auto 1.5rem auto' }}>
                    <div style={{ width: '50%', height: '100%', background: '#f97316', borderRadius: '9999px' }}></div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '340px', justifyContent: 'center' }}>
                    <button 
                      onClick={() => handleToggleInterruption(activeInterruption)} 
                      style={{ 
                        flex: 1, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '0.5rem', 
                        padding: '0.7rem 1.25rem', 
                        background: '#ef4444', 
                        color: '#ffffff', 
                        fontWeight: '700', 
                        fontSize: '0.95rem', 
                        borderRadius: '8px', 
                        border: 'none', 
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)' 
                      }}
                    >
                      <Square size={13} fill="white" /> STOP
                    </button>
                  </div>
                </div>
              ) : (
                <div className="no-active-timer" style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', color: '#64748b', fontWeight: '800', fontSize: '1rem', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                    <Clock size={19} style={{ color: '#94a3b8' }} />
                    <span>CHRONOMÈTRE</span>
                  </div>
                  <p style={{ color: '#0f172a', fontWeight: '600', margin: '0 0 0.35rem 0' }}>Aucune tâche en cours de suivi.</p>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Lancez le chrono directement depuis la liste des livrables à droite.</span>
                </div>
              )}
            </div>

            {/* INTERRUPTIONS CARD */}
            <div className="panel prod-interruptions-card">
              <h2 className="panel-title">INTERRUPTIONS <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>(Met le chrono client en pause)</span></h2>
              <p className="panel-subtitle">Ne perdez plus de temps à justifier les coupures. Un clic suffit.</p>
              
              <div className="interruptions-grid">
                <button 
                  className={`btn-interrupt slack ${activeInterruption === 'slack' ? 'active' : ''}`}
                  onClick={() => handleInterruptionClick('slack')}
                >
                  <span className="dot"></span> Slack / Mails
                </button>
                <button 
                  className={`btn-interrupt meeting ${activeInterruption === 'meeting' ? 'active' : ''}`}
                  onClick={() => handleInterruptionClick('meeting')}
                >
                  <span className="dot"></span> Point Interne
                </button>
                <button 
                  className={`btn-interrupt pause-type ${activeInterruption === 'pause' ? 'active' : ''}`}
                  onClick={() => handleInterruptionClick('pause')}
                >
                  <span className="dot"></span> Pause
                </button>
                <button 
                  className={`btn-interrupt call ${activeInterruption === 'call' ? 'active' : ''}`}
                  onClick={() => handleInterruptionClick('call')}
                >
                  <span className="dot"></span> Appel Impromptu
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: DELIVERABLES */}
          <div className="prod-right-column">
            
            {/* LIVRABLES CARD */}
            <div className="panel deliverables-card">
              <h2 className="panel-title" style={{ marginBottom: '0.5rem' }}>LIVRABLES DU MOIS</h2>
              <p className="panel-subtitle">Lancez le chronomètre directement depuis le livrable concerné.</p>

              <div className="deliverables-5-container" style={{ marginTop: '1.25rem' }}>
                {DELIVERABLE_CARDS.map(card => {
                  const IconComp = card.icon;
                  
                  // Trouver les tâches associées à ce livrable
                  const catTasks = (selectedClient?.tasks || []).filter(
                    t => t.category?.toLowerCase() === card.categoryKey.toLowerCase() ||
                         t.name?.toLowerCase() === card.title.toLowerCase() ||
                         t.category?.toLowerCase() === card.id.toLowerCase()
                  );
                  
                  const primaryTask = catTasks.length > 0 ? catTasks[0] : null;

                  let totalSpentSec = 0;
                  let totalBudgetHours = 0;
                  catTasks.forEach(t => {
                    totalSpentSec += (t.time_spent_seconds || 0);
                    totalBudgetHours += (t.budget_hours || 0);
                  });

                  const isCompleted = primaryTask && primaryTask.status === 'Fait';
                  const isActive = activeTask && (
                    activeTask.id === primaryTask?.id ||
                    activeTask.category?.toLowerCase() === card.categoryKey.toLowerCase() ||
                    activeTask.name?.toLowerCase() === card.title.toLowerCase()
                  );

                  const totalBudgetSec = totalBudgetHours * 3600;
                  const progressPercent = totalBudgetSec > 0 ? Math.min(Math.round((totalSpentSec / totalBudgetSec) * 100), 100) : 0;

                  return (
                    <div 
                      key={card.id} 
                      className={`deliverable-card-item ${isCompleted ? 'completed' : isActive ? 'active' : ''}`}
                      style={{
                        borderLeft: `4px solid ${card.themeColor}`
                      }}
                    >
                      <div className="deliverable-card-header">
                        <div className="deliverable-card-title-group">
                          <div 
                            className="deliverable-card-icon-badge"
                            style={{ 
                              backgroundColor: `${card.themeColor}15`,
                              color: card.themeColor
                            }}
                          >
                            <IconComp size={20} />
                          </div>
                          <div>
                            <h3 className="deliverable-card-title">
                              {card.title}
                            </h3>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {formatSecondsToHMText(totalSpentSec)}
                              {totalBudgetHours > 0 ? ` / ${totalBudgetHours}h budgétées` : ' passées'}
                            </span>
                          </div>
                        </div>

                        <div className="deliverable-card-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {isCompleted ? (
                            <div className="status-badge fait">
                              <CheckCircle size={12} /> Fait
                            </div>
                          ) : isActive ? (
                            <div 
                              className="status-badge en-cours"
                              style={{
                                background: 'rgba(234, 88, 12, 0.15)',
                                color: 'var(--brand-orange)',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '6px'
                              }}
                            >
                              <span className="dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--brand-orange)', display: 'inline-block' }}></span>
                              En cours
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleStartDeliverable(card)}
                              title={`Lancer le chronomètre sur ${card.title}`}
                              disabled={timerRunning && !isActive}
                              style={{
                                background: 'var(--panel-white)',
                                border: '1px solid var(--border-light)',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '20px',
                                cursor: (timerRunning && !isActive) ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                color: '#10b981',
                                fontWeight: '600',
                                fontSize: '0.8rem',
                                transition: 'all 0.15s ease',
                                opacity: (timerRunning && !isActive) ? 0.5 : 1
                              }}
                            >
                              <Play size={13} fill="#10b981" />
                              Démarrer
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Activities Tags */}
                      <div className="deliverable-activities-tags">
                        {card.activities.map(act => (
                          <span key={act} className="activity-pill">
                            {act}
                          </span>
                        ))}
                      </div>

                      {/* Progress bar if budget exists */}
                      {totalBudgetHours > 0 && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <div className="progress-bar-container" style={{ height: '5px' }}>
                            <div 
                              className={`progress-bar-fill ${isCompleted ? 'green' : isActive ? 'orange' : 'blue'}`}
                              style={{ width: `${progressPercent}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: ALLOCATE INTERRUPTION CLIENT */}
      {interruptionModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px', width: '90%' }}>
            <h2 className="modal-title" style={{ textAlign: 'center', marginBottom: '1rem' }}>
              Attribuer l'interruption
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              À quel client souhaitez-vous attribuer ce temps de <strong>{
                interruptionTypeToStart === 'slack' ? 'Slack / Mails' :
                interruptionTypeToStart === 'meeting' ? 'Point Interne' : 'Appel Impromptu'
              }</strong> ?
            </p>
            
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: '600' }}>Client concerné</label>
              <select 
                value={selectedInterruptionClientId} 
                onChange={(e) => setSelectedInterruptionClientId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ minWidth: '100px' }}
                onClick={() => {
                  setInterruptionModalOpen(false);
                  setInterruptionTypeToStart(null);
                }}
              >
                Annuler
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ minWidth: '120px' }}
                onClick={() => {
                  setInterruptionModalOpen(false);
                  handleStartInterruption(interruptionTypeToStart, selectedInterruptionClientId);
                  setInterruptionTypeToStart(null);
                }}
              >
                Démarrer
              </button>
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
    </div>
  );
}
