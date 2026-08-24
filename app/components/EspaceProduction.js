import { useEffect, useState, useRef } from 'react';
import { 
  Play, 
  Square, 
  Clock, 
  Briefcase, 
  CheckCircle, 
  AlertCircle,
  Lock
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
      if (myActiveProdLog && !timerRunning && clients && clients.length > 0) {
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
    if (timerRunning) {
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
      alert(`🔒 Action impossible : Cette tâche est actuellement en cours par ${lock.employee_name}.`);
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
        alert("Action impossible : Cette tâche vient d'être prise par un autre collaborateur.");
      } else {
        alert("Erreur lors du démarrage du chronomètre. Veuillez réessayer.");
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
    setTimerSeconds(0);
    setInterruptionSeconds(0);

    try {
      // 1. Stop active interruption log if it was running
      if (currentInterruption && currentInterLogId && interSeconds > 0) {
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
      if (currentLogId && prodSeconds > 0) {
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

  const handleToggleInterruption = async (type) => {
    if (!activeTask || !activeLogId) return;

    const now = new Date().toISOString();

    if (activeInterruption === type) {
      const interSeconds = interruptionSeconds;
      const currentInterLogId = interruptionLogId;

      setActiveInterruption(null);
      setInterruptionLogId(null);
      setInterruptionSeconds(0);

      startTimeRef.current = startTimeRef.current + (Date.now() - interruptionStartTimeRef.current);

      try {
        if (currentInterLogId && interSeconds > 0) {
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
    } else {
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

      try {
        const res = await fetch('/api/production/time-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            task_id: activeTask.id,
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
          interruptionStartTimeRef.current = Date.now();
        }
      } catch (err) {
        console.error('Error starting new interruption:', err);
      }
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

  return (
    <div className="espace-production">
      {/* HEADER CONTROLS */}
      <div className="prod-header">
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
                  <h3 className="timer-task-name">{activeTask.name}</h3>
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

                  <button className="btn-stop-timer" onClick={handleStopTimer}>
                    <Square size={16} fill="white" style={{ marginRight: '0.5rem' }} /> STOP
                  </button>
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
                  onClick={() => handleToggleInterruption('slack')}
                  disabled={!activeTask}
                >
                  <span className="dot"></span> Slack / Mails
                </button>
                <button 
                  className={`btn-interrupt meeting ${activeInterruption === 'meeting' ? 'active' : ''}`}
                  onClick={() => handleToggleInterruption('meeting')}
                  disabled={!activeTask}
                >
                  <span className="dot"></span> Point Interne
                </button>
                <button 
                  className={`btn-interrupt pause-type ${activeInterruption === 'pause' ? 'active' : ''}`}
                  onClick={() => handleToggleInterruption('pause')}
                  disabled={!activeTask}
                >
                  <span className="dot"></span> Pause
                </button>
                <button 
                  className={`btn-interrupt call ${activeInterruption === 'call' ? 'active' : ''}`}
                  onClick={() => handleToggleInterruption('call')}
                  disabled={!activeTask}
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
                <div className="deliverable-categories">
                  {Object.entries(groupedTasks).map(([category, tasks]) => (
                    <div key={category} className="category-group">
                      <h3 className="category-title">{category}</h3>
                      <div className="task-items-list">
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
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
