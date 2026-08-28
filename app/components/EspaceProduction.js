import { useEffect, useState, useRef } from 'react';
import { 
  Play, 
  Square, 
  Clock, 
  Briefcase, 
  CheckCircle, 
  AlertCircle,
  Lock,
  Calendar,
  Globe,
  Mail,
  BookOpen
} from 'lucide-react';
import { supabaseClient } from '../../lib/supabaseClient';

export default function EspaceProduction({ user, token, clients, loading, refreshData, employeeName }) {
  const [selectedClient, setSelectedClient] = useState(null);

  // Real-time locks: task_id -> { log_id, employee_id, employee_name, start_time }
  const [activeLocks, setActiveLocks] = useState({});

  // Active tracking state
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
  const [selectedFilter, setSelectedFilter] = useState('Tous');

  useEffect(() => {
    setSelectedFilter('Tous');
  }, [selectedClient?.id]);
  // Fetch active locks & re-hydrate running chrono
  const fetchActiveLocks = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('production_time_logs')
        .select('id, task_id, employee_id, employee_name, start_time, log_type')
        .is('end_time', null);

      if (error) throw error;

      const locks = {};
      let myActiveProdLog = null;
      let myActiveInterLog = null;

      (data || []).forEach(log => {
        locks[log.task_id] = {
          log_id: log.id,
          employee_id: log.employee_id,
          employee_name: log.employee_name,
          start_time: log.start_time,
          log_type: log.log_type
        };

        if (log.employee_id === user?.id) {
          if (log.log_type === 'production') {
            myActiveProdLog = log;
          } else if (log.log_type.startsWith('interruption:')) {
            myActiveInterLog = log;
          }
        }
      });

      setActiveLocks(locks);

      // Re-hydrate active timer state using the pre-fetched clients prop (no database fetch required!)
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
            
            // Calculate elapsed seconds since start_time
            const elapsed = Math.floor((Date.now() - new Date(myActiveProdLog.start_time).getTime()) / 1000);
            setTimerSeconds(elapsed > 0 ? elapsed : 0);
            startTimeRef.current = new Date(myActiveProdLog.start_time).getTime();
            setTimerRunning(true);

            // Re-hydrate interruption if present
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
        } else if (myActiveInterLog && !activeInterruption) {
          // Re-hydrate active interruption when no production task is active
          let matchedInterTaskClient = null;
          clients.forEach(c => {
            const t = (c.tasks || []).find(task => task.id === myActiveInterLog.task_id);
            if (t) matchedInterTaskClient = c;
          });

          if (matchedInterTaskClient) {
            const type = myActiveInterLog.log_type.split(':')[1];
            setActiveInterruption(type);
            setInterruptionLogId(myActiveInterLog.id);
            setActiveInterruptionClientId(matchedInterTaskClient.id);
            const elapsedInter = Math.floor((Date.now() - new Date(myActiveInterLog.start_time).getTime()) / 1000);
            setInterruptionSeconds(elapsedInter > 0 ? elapsedInter : 0);
            interruptionStartTimeRef.current = new Date(myActiveInterLog.start_time).getTime();
          }
        }
      }
    } catch (err) {
      console.error('Error fetching active locks:', err);
    }
  };

  // Supabase Realtime Subscription for lock synchronization
  useEffect(() => {
    if (!user) return;

    fetchActiveLocks();

    const channel = supabaseClient
      .channel('production_locks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_time_logs'
        },
        (payload) => {
          console.log('[Realtime Lock] Changed log:', payload);
          if (payload.eventType === 'INSERT') {
            if (payload.new.end_time === null) {
              setActiveLocks(prev => ({
                ...prev,
                [payload.new.task_id]: {
                  log_id: payload.new.id,
                  employee_id: payload.new.employee_id,
                  employee_name: payload.new.employee_name,
                  start_time: payload.new.start_time,
                  log_type: payload.new.log_type
                }
              }));
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.end_time !== null) {
              setActiveLocks(prev => {
                const copy = { ...prev };
                delete copy[payload.new.task_id];
                return copy;
              });
            } else {
              setActiveLocks(prev => ({
                ...prev,
                [payload.new.task_id]: {
                  log_id: payload.new.id,
                  employee_id: payload.new.employee_id,
                  employee_name: payload.new.employee_name,
                  start_time: payload.new.start_time,
                  log_type: payload.new.log_type
                }
              }));
            }
          } else if (payload.eventType === 'DELETE') {
            fetchActiveLocks();
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [user, clients]); // Trigger lock hydration when clients list is available

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
    // 1. Client-side anti-collision guard (optimistic check)
    const lock = activeLocks[task.id];
    if (lock && lock.employee_id !== user.id) {
      showAlert("Tâche verrouillée", `🔒 Action impossible : Cette tâche est actuellement en cours par ${lock.employee_name}.`);
      return;
    }

    // 2. Prepare previous state for rollback in case of race condition failure
    const prevActiveTask = activeTask;
    const prevActiveLogId = activeLogId;
    const prevTimerSeconds = timerSeconds;
    const prevTimerRunning = timerRunning;

    // Stop current running timer if there is one
    if (timerRunning && activeTask) {
      await handleStopTimer();
    }

    // 3. Optimistic UI update
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
        throw new Error(data.error === 'task_locked' ? 'task_locked' : 'failed_to_start');
      }

      const data = await res.json();
      setActiveLogId(data.log.id);

    } catch (err) {
      console.error('Error starting production timer:', err);
      
      // 4. Rollback Optimistic UI state immediately
      setActiveTask(prevActiveTask);
      setActiveLogId(prevActiveLogId);
      setTimerSeconds(prevTimerSeconds);
      setTimerRunning(prevTimerRunning);
      if (prevTimerRunning) {
        startTimeRef.current = Date.now() - prevTimerSeconds * 1000;
      }

      if (err.message === 'task_locked') {
        showAlert("Action impossible", "Cette tâche vient d'être prise par un autre collaborateur.");
      } else {
        showAlert("Erreur", "Erreur lors du démarrage du chronomètre. Veuillez réessayer.");
      }
    }
  };

  const handleStopTimer = async () => {
    if (!activeTask || !timerRunning) return;

    const stopTime = new Date().toISOString();
    const prodSeconds = timerSeconds;
    const currentLogId = activeLogId;
    const currentInterLogId = interruptionLogId;
    const interSeconds = interruptionSeconds;
    const currentInterruption = activeInterruption;

    setTimerRunning(false);
    setActiveTask(null);
    setActiveLogId(null);
    setActiveInterruption(null);
    setInterruptionLogId(null);
    setActiveInterruptionClientId(null);
    setTimerSeconds(0);
    setInterruptionSeconds(0);

    try {
      // 1. Stop active interruption log if it was running
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

      // 2. Stop main production time log
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

      // Refresh parent's clients shared state
      await refreshData();
    } catch (err) {
      console.error('Error stopping timer:', err);
    }
  };

  const handleCompleteTask = async () => {
    if (!activeTask) return;

    showConfirm(
      "Compléter la tâche",
      "Êtes-vous sûr de vouloir marquer cette tâche comme terminée ? Cela arrêtera également le chronomètre.",
      async () => {
        const taskId = activeTask.id;
        
        // Stop the timer first to save any logged seconds
        await handleStopTimer();

        try {
          // Mark task as completed (status = 'Fait')
          const res = await fetch(`/api/production/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'Fait' })
          });

          if (res.ok) {
            // Refresh data again to display the task as completed
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
        }
      } catch (err) {
        console.error('Error stopping interruption:', err);
      }
    }
  };

  const handleStartInterruption = async (type, targetClientId) => {
    const now = new Date().toISOString();

    // 1. Stop current active interruption if any
    if (activeInterruption && interruptionLogId && interruptionSeconds > 0) {
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

    // 2. Resolve client ID before stopping the active task timer
    let resolvedClientId = targetClientId;
    if (!resolvedClientId && activeTask) {
      resolvedClientId = activeTask.client_id;
    }

    // 3. Stop the active task timer if one is running, to avoid overlaps!
    if (activeTask && timerRunning) {
      await handleStopTimer();
    }

    // 4. Determine target task ID (based on chosen client)
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

    // 3. Start the new interruption
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
      // Toggle off
      handleToggleInterruption(type);
    } else if (type === 'pause') {
      // Pause is independent and always allowed! We attribute it to the active task's client or selected client.
      const clientId = activeTask ? activeTask.client_id : (selectedClient?.id || clients[0]?.id || '');
      handleStartInterruption('pause', clientId);
    } else {
      // Open modal to choose client (Slack, Point Interne, Appel Impromptu)
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

  const getCategoryType = (category) => {
    const cat = category.toLowerCase();
    if (cat.includes('linkedin')) return 'LinkedIn';
    if (cat.includes('facebook') || cat.startsWith('fb')) return 'Facebook';
    if (cat.includes('instagram') || cat.startsWith('insta') || cat.startsWith('ig')) return 'Instagram';
    if (cat.includes('google')) return 'Google Posts';
    if (cat.includes('newsletter')) return 'Newsletter';
    if (cat.includes('bb') || cat.includes('blog')) return 'Billet Blog';
    return category; // fallback
  };

  const getGroupedTasks = () => {
    if (!selectedClient) return {};
    const grouped = {};
    (selectedClient.tasks || []).forEach(task => {
      if (!grouped[task.category]) {
        grouped[task.category] = [];
      }
      grouped[task.category].push(task);
    });
    return grouped;
  };

  const groupedTasks = getGroupedTasks();

  // Get distinct filter types for the client's existing tasks
  const availableFilterTypes = [
    'Tous',
    ...new Set(Object.keys(groupedTasks).map(getCategoryType))
  ];

  // Filter grouped tasks based on selection
  const filteredGroupedTasks = {};
  Object.entries(groupedTasks).forEach(([category, tasks]) => {
    if (selectedFilter === 'Tous' || getCategoryType(category) === selectedFilter) {
      filteredGroupedTasks[category] = tasks;
    }
  });

  // Resolve client names for active timers/interruptions
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

            {/* Deliverables grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              <div className="deliverable-mini-card" style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--panel-white)' }}>
                <div style={{ color: '#1877f2', display: 'flex' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ display: 'inline-block' }}>
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Facebook</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700' }}>{selectedClient.posts_facebook || 0} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/mois</span></div>
                </div>
              </div>

              <div className="deliverable-mini-card" style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--panel-white)' }}>
                <div style={{ color: '#e1306c', display: 'flex' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Instagram</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700' }}>{selectedClient.posts_instagram || 0} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/mois</span></div>
                </div>
              </div>

              <div className="deliverable-mini-card" style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--panel-white)' }}>
                <div style={{ color: '#0a66c2', display: 'flex' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                    <rect x="2" y="9" width="4" height="12" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>LinkedIn</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700' }}>{selectedClient.posts_linkedin || 0} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/mois</span></div>
                </div>
              </div>

              <div className="deliverable-mini-card" style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--panel-white)' }}>
                <div style={{ color: '#4285f4', display: 'flex' }}><Globe size={18} /></div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Google Posts</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700' }}>{selectedClient.posts_google || 0} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/mois</span></div>
                </div>
              </div>

              <div className="deliverable-mini-card" style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--panel-white)' }}>
                <div style={{ color: '#ea4335', display: 'flex' }}><Mail size={18} /></div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Newsletter</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700' }}>{selectedClient.newsletter_count || 0} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/mois</span></div>
                </div>
              </div>

              <div className="deliverable-mini-card" style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--panel-white)' }}>
                <div style={{ color: '#fbbc05', display: 'flex' }}><BookOpen size={18} /></div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Billet Blog</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700' }}>{selectedClient.blog_count || 0} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>/mois</span></div>
                </div>
              </div>
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
          <h3>Aucun client disponible</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Veuillez configurer un client dans l'Espace manager.</p>
        </div>
      ) : (
        <div className="prod-grid">
          {/* LEFT COLUMN: TIMER & INTERRUPTIONS */}
          <div className="prod-left-column">
            
            {/* ACTIVE TIMER CARD */}
            <div className="panel prod-timer-card">
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: 'var(--brand-orange)' }} />
                TÂCHE EN COURS
              </h2>
              
              {activeTask ? (
                <div className="timer-content">
                  {activeTaskClientName && (
                    <div className="client-badge" style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(234, 88, 12, 0.12)',
                      color: 'var(--brand-orange)',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {activeTaskClientName}
                    </div>
                  )}
                  <h3 className="timer-task-name" style={{ marginTop: '0.25rem' }}>{activeTask.name}</h3>
                  <p className="timer-task-meta">
                    Budget vendu : {activeTask.budget_hours}h00 {activeTask.due_date && `| Échéance : ${new Date(activeTask.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
                  </p>
                  
                  {activeInterruption ? (
                    <div className="interruption-banner">
                      <span>Interruption en cours : <strong>{
                        activeInterruption === 'slack' ? 'Slack / Mails' :
                        activeInterruption === 'meeting' ? 'Point Interne' :
                        activeInterruption === 'pause' ? 'Pause' : 'Appel Impromptu'
                      }</strong></span>
                      <span className="interruption-timer-val">+{formatSecondsToHMS(interruptionSeconds)}</span>
                    </div>
                  ) : null}

                  <div className="timer-display">
                    {formatSecondsToHMS(timerSeconds)}
                  </div>
                  
                  {/* Task Progress Bar */}
                  <div className="task-progress-bar-container" style={{ margin: '1rem 0', width: '100%', maxWidth: '360px' }}>
                    {(() => {
                      const totalSecondsOnTask = (activeTask.time_spent_seconds || 0) + timerSeconds;
                      const budgetSec = activeTask.budget_hours * 3600;
                      const percent = budgetSec > 0 ? Math.min((totalSecondsOnTask / budgetSec) * 100, 100) : 0;
                      return (
                        <div className="progress-bar-container">
                          <div className="progress-bar-fill blue" style={{ width: `${percent}%` }}></div>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '360px', justifyContent: 'center' }}>
                    <button className="btn-stop-timer" onClick={handleStopTimer} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Square size={14} fill="white" style={{ marginRight: '0.5rem' }} /> STOP
                    </button>
                    <button 
                      className="btn-complete-timer" 
                      onClick={handleCompleteTask}
                      style={{
                        flex: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.5rem 1rem',
                        fontSize: '0.9rem',
                        fontWeight: '700',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                    >
                      <CheckCircle size={14} style={{ marginRight: '0.5rem' }} /> TERMINÉ
                    </button>
                  </div>
                </div>
              ) : activeInterruption ? (
                <div className="timer-content">
                  {activeInterruptionClientName && (
                    <div className="client-badge" style={{
                      display: 'inline-block',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(234, 88, 12, 0.12)',
                      color: 'var(--brand-orange)',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      marginBottom: '0.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {activeInterruptionClientName}
                    </div>
                  )}
                  <h3 className="timer-task-name" style={{ color: 'var(--brand-orange)', marginTop: '0.25rem' }}>
                    {
                      activeInterruption === 'pause' ? 'Pause' :
                      `Interruption : ${
                        activeInterruption === 'slack' ? 'Slack / Mails' :
                        activeInterruption === 'meeting' ? 'Point Interne' : 'Appel Impromptu'
                      }`
                    }
                  </h3>
                  <p className="timer-task-meta">Aucune tâche client en cours de suivi.</p>
                  
                  <div className="timer-display">
                    {formatSecondsToHMS(interruptionSeconds)}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '360px', justifyContent: 'center', marginTop: '1.5rem' }}>
                    <button 
                      className="btn-stop-timer" 
                      onClick={() => handleToggleInterruption(activeInterruption)} 
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Square size={14} fill="white" style={{ marginRight: '0.5rem' }} /> STOP
                    </button>
                  </div>
                </div>
              ) : (
                <div className="no-active-timer">
                  <p>Aucune tâche en cours de suivi.</p>
                  <span>Lancez le chrono directement depuis la liste des tâches à droite.</span>
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
              <p className="panel-subtitle">Lancez le chrono directement depuis la tâche.</p>

              {Object.keys(groupedTasks).length === 0 ? (
                <p className="no-data-text" style={{ textAlign: 'center', padding: '2rem' }}>Aucune tâche configurée pour ce client.</p>
              ) : (
                <>
                  {/* Category Filter Badges */}
                  {availableFilterTypes.length > 2 && (
                    <div className="filter-tabs" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-light)' }}>
                      {availableFilterTypes.map(type => (
                        <button
                          key={type}
                          onClick={() => setSelectedFilter(type)}
                          style={{
                            padding: '0.35rem 0.85rem',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            borderRadius: '16px',
                            border: '1px solid ' + (selectedFilter === type ? 'var(--brand-orange)' : 'var(--border-light)'),
                            background: selectedFilter === type ? 'var(--brand-orange)' : 'var(--panel-white)',
                            color: selectedFilter === type ? 'white' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="deliverable-categories">
                    {Object.keys(filteredGroupedTasks).length === 0 ? (
                      <p className="no-data-text" style={{ textAlign: 'center', padding: '1.5rem', width: '100%' }}>Aucune tâche ne correspond à ce filtre.</p>
                    ) : (
                      Object.entries(filteredGroupedTasks).map(([category, tasks]) => (
                    <div key={category} className="category-group">
                      <h3 className="category-title">{category}</h3>
                      <div className="task-items-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                        {tasks.map(task => {
                          const budgetSec = task.budget_hours * 3600;
                          const spentSec = task.time_spent_seconds || 0;
                          const isCompleted = task.status === 'Fait';
                          const isActive = activeTask?.id === task.id;
                          
                          const lock = activeLocks[task.id];
                          const isLockedByOther = lock && lock.employee_id !== user?.id;
                          
                          let progressPercent = budgetSec > 0 ? (spentSec / budgetSec) * 100 : 0;
                          progressPercent = Math.round(progressPercent);

                          return (
                            <div key={task.id} className={`task-item-card ${isCompleted ? 'completed' : isActive ? 'active' : ''}`}>
                              <div className="task-item-header">
                                <div className="task-item-details">
                                  <h4 className="task-item-name">{task.name}</h4>
                                  <span className="task-item-budget">
                                    {formatSecondsToHMText(spentSec)} / {task.budget_hours}h00 budgété
                                    {task.due_date && ` (Échéance: ${new Date(task.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})`}
                                  </span>
                                </div>

                                <div className="task-item-actions">
                                  {isCompleted ? (
                                    <div className="status-badge fait">
                                      <CheckCircle size={12} /> Fait
                                    </div>
                                  ) : isLockedByOther ? (
                                    <div className="status-badge en-cours" style={{ background: 'var(--alert-red-bg, #fee2e2)', color: 'var(--alert-red, #ef4444)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                      <Lock size={10} /> {lock.employee_name}
                                    </div>
                                  ) : isActive ? (
                                    <div className="status-badge en-cours">
                                      En cours
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => handleStartTimer(task)}
                                      title="Lancer le chronomètre"
                                      disabled={timerRunning && activeTask?.id === task.id}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        boxShadow: 'none',
                                        padding: 0,
                                        margin: 0,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '32px',
                                        height: '32px',
                                        outline: 'none'
                                      }}
                                    >
                                      <svg viewBox="0 0 24 24" width="24" height="24" fill="#10b981" style={{ display: 'inline-block', fill: '#10b981' }}>
                                        <path d="M8 5v14l11-7z" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="task-item-progress">
                                <div className="progress-bar-container">
                                  <div 
                                    className={`progress-bar-fill ${isCompleted ? 'green' : isActive ? 'blue' : 'grey'}`}
                                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                      ))
                    )}
                  </div>
                </>
              )}
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
