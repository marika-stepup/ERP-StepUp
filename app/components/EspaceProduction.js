import { useEffect, useState, useRef } from 'react';
import { 
  Play, 
  Square, 
  Clock, 
  Briefcase, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';

export default function EspaceProduction({ user, token }) {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading, setLoading] = useState(true);

  // Timer states
  const [activeTask, setActiveTask] = useState(null); // The production task being tracked
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [activeInterruption, setActiveInterruption] = useState(null); // 'slack', 'meeting', 'pause', 'call'
  const [interruptionSeconds, setInterruptionSeconds] = useState(0);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const interruptionStartTimeRef = useRef(null);

  // Fetch clients and their tasks
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/production/clients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
        
        // Retain or select first client
        if (data.clients && data.clients.length > 0) {
          if (selectedClient) {
            const updated = data.clients.find(c => c.id === selectedClient.id);
            setSelectedClient(updated || data.clients[0]);
          } else {
            setSelectedClient(data.clients[0]);
          }
        } else {
          setSelectedClient(null);
        }
      }
    } catch (err) {
      console.error('Error loading production data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Timer Interval Effect
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

  const stopAllTimersLocally = () => {
    setTimerRunning(false);
    setActiveTask(null);
    setActiveInterruption(null);
    setTimerSeconds(0);
    setInterruptionSeconds(0);
  };

  const handleStartTimer = (task) => {
    if (timerRunning && activeTask && activeTask.id !== task.id) {
      handleStopTimer();
    }

    setActiveTask(task);
    setTimerSeconds(0);
    setInterruptionSeconds(0);
    setActiveInterruption(null);
    setTimerRunning(true);
    startTimeRef.current = Date.now();
  };

  const handleStopTimer = async () => {
    if (!activeTask || !timerRunning) return;

    const prodSeconds = timerSeconds;
    const taskToSave = activeTask;
    const interruptionToSave = activeInterruption;
    const interSeconds = interruptionSeconds;

    stopAllTimersLocally();

    try {
      // 1. Save production time log
      if (prodSeconds > 0) {
        await fetch('/api/production/time-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            task_id: taskToSave.id,
            employee_id: user.id,
            employee_name: user.name,
            duration_seconds: prodSeconds,
            log_type: 'production'
          })
        });
      }

      // 2. Save active interruption log if it was active
      if (interruptionToSave && interSeconds > 0) {
        await fetch('/api/production/time-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            task_id: taskToSave.id,
            employee_id: user.id,
            employee_name: user.name,
            duration_seconds: interSeconds,
            log_type: `interruption:${interruptionToSave}`
          })
        });
      }

      // Refresh data to show updated progression bars
      await fetchData();
    } catch (err) {
      console.error('Error saving timer data:', err);
    }
  };

  const handleToggleInterruption = async (type) => {
    if (!activeTask) return;

    if (activeInterruption === type) {
      const interSeconds = interruptionSeconds;
      const taskToSave = activeTask;
      const typeToSave = activeInterruption;

      setActiveInterruption(null);
      setInterruptionSeconds(0);

      // Adjust production start time to account for pause duration
      startTimeRef.current = startTimeRef.current + (Date.now() - interruptionStartTimeRef.current);
      
      try {
        if (interSeconds > 0) {
          await fetch('/api/production/time-logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              task_id: taskToSave.id,
              employee_id: user.id,
              employee_name: user.name,
              duration_seconds: interSeconds,
              log_type: `interruption:${typeToSave}`
            })
          });
        }
      } catch (err) {
        console.error('Error saving interruption:', err);
      }
    } else {
      if (activeInterruption) {
        const interSeconds = interruptionSeconds;
        const taskToSave = activeTask;
        const typeToSave = activeInterruption;
        try {
          if (interSeconds > 0) {
            await fetch('/api/production/time-logs', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                task_id: taskToSave.id,
                employee_id: user.id,
                employee_name: user.name,
                duration_seconds: interSeconds,
                log_type: `interruption:${typeToSave}`
              })
            });
          }
        } catch (err) {
          console.error('Error saving previous interruption:', err);
        }
      }

      setActiveInterruption(type);
      setInterruptionSeconds(0);
      interruptionStartTimeRef.current = Date.now();
    }
  };

  // Format Helper: Seconds to HH:MM:SS
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

  // Group tasks by category
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
                                  ) : isActive ? (
                                    <div className="status-badge en-cours">
                                      En cours
                                    </div>
                                  ) : (
                                    <button 
                                      className="btn-play-task" 
                                      onClick={() => handleStartTimer(task)}
                                      title="Lancer le chronomètre"
                                      disabled={timerRunning && activeTask?.id === task.id}
                                    >
                                      <Play size={14} fill="currentColor" />
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
