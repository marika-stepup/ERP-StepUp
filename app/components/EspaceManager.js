import { useEffect, useState } from 'react';
import { 
  Plus, 
  Trash2, 
  User, 
  Briefcase, 
  PlusCircle, 
  AlertCircle, 
  UserCheck 
} from 'lucide-react';

export default function EspaceManager({ user, token, allMembers }) {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLogs, setTimeLogs] = useState([]);
  
  // Modals / Form states
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [newClientPeriod, setNewClientPeriod] = useState(() => {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const d = new Date();
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  });
  const [newClientBudget, setNewClientBudget] = useState('20');

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskCategory, setNewTaskCategory] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskBudget, setNewTaskBudget] = useState('4');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // Manual log state
  const [manualMemberId, setManualMemberId] = useState('');
  const [manualTaskId, setManualTaskId] = useState('');
  const [manualHours, setManualHours] = useState('1');
  const [manualMinutes, setManualMinutes] = useState('0');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Fetch initial data
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

  const fetchLogs = async (clientId) => {
    if (!token || !clientId) return;
    try {
      const res = await fetch(`/api/production/time-logs?clientId=${clientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTimeLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    if (selectedClient) {
      fetchLogs(selectedClient.id);
    } else {
      setTimeLogs([]);
    }
  }, [selectedClient, token]);

  // Actions: Client
  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClientName || !newClientCode || !newClientPeriod) return;

    try {
      const res = await fetch('/api/production/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newClientName,
          code: newClientCode,
          contract_period: newClientPeriod,
          total_budget_hours: parseFloat(newClientBudget) || 0
        })
      });

      if (res.ok) {
        const data = await res.json();
        setNewClientName('');
        setNewClientCode('');
        setNewClientBudget('20');
        setShowAddClient(false);
        await fetchData();
        if (data.client) {
          setSelectedClient(data.client);
        }
      } else {
        const errData = await res.json();
        alert(errData.error || 'Erreur lors de la création du client.');
      }
    } catch (err) {
      console.error('Error adding client:', err);
    }
  };

  // Actions: Task
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskCategory || !newTaskName || !selectedClient) return;

    try {
      const res = await fetch('/api/production/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: selectedClient.id,
          category: newTaskCategory,
          name: newTaskName,
          budget_hours: parseFloat(newTaskBudget) || 0,
          due_date: newTaskDueDate || null
        })
      });

      if (res.ok) {
        setNewTaskName('');
        setNewTaskBudget('4');
        setNewTaskDueDate('');
        setShowAddTask(false);
        await fetchData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Erreur lors de la création de la tâche.');
      }
    } catch (err) {
      console.error('Error adding task:', err);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch(`/api/production/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Voulez-vous vraiment supprimer cette tâche ? Tous les logs associés seront supprimés.')) return;
    try {
      const res = await fetch(`/api/production/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Actions: Manual Entry
  const handleAddManualLog = async (e) => {
    e.preventDefault();
    if (!manualTaskId || !manualMemberId || !token) return;

    const totalSeconds = (parseInt(manualHours) || 0) * 3600 + (parseInt(manualMinutes) || 0) * 60;
    if (totalSeconds <= 0) {
      alert('Veuillez spécifier une durée valide.');
      return;
    }

    const member = allMembers.find(m => m.employee_id === manualMemberId);
    if (!member) return;

    try {
      const res = await fetch('/api/production/time-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          task_id: manualTaskId,
          employee_id: member.employee_id,
          employee_name: `${member.employee_first_name} ${member.employee_name}`,
          duration_seconds: totalSeconds,
          log_type: 'production',
          logged_at: new Date(manualDate).toISOString()
        })
      });

      if (res.ok) {
        setManualHours('1');
        setManualMinutes('0');
        await fetchData();
        if (selectedClient) {
          await fetchLogs(selectedClient.id);
        }
      } else {
        const errData = await res.json();
        alert(errData.error || 'Erreur lors de la création du log manuel.');
      }
    } catch (err) {
      console.error('Error adding manual log:', err);
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!confirm('Voulez-vous vraiment supprimer cet enregistrement de temps ?')) return;
    try {
      const res = await fetch(`/api/production/time-logs/${logId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchData();
        if (selectedClient) {
          await fetchLogs(selectedClient.id);
        }
      }
    } catch (err) {
      console.error('Error deleting log:', err);
    }
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

  // Get collaborator summaries
  const getCollaboratorSummaries = () => {
    const summary = {};
    timeLogs.forEach(log => {
      if (log.log_type === 'production') {
        if (!summary[log.employee_id]) {
          summary[log.employee_id] = { name: log.employee_name, duration: 0 };
        }
        summary[log.employee_id].duration += log.duration_seconds;
      }
    });
    return Object.values(summary);
  };

  const groupedTasks = getGroupedTasks();
  const collaboratorSummaries = getCollaboratorSummaries();

  return (
    <div className="espace-production">
      {/* HEADER CONTROLS */}
      <div className="prod-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 className="prod-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={24} style={{ color: 'var(--brand-orange)' }} />
            Gestion Client :
          </h1>
          <select 
            className="client-selector"
            value={selectedClient?.id || ''}
            onChange={(e) => {
              const client = clients.find(c => c.id === e.target.value);
              setSelectedClient(client || null);
            }}
          >
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
            ))}
            {clients.length === 0 && <option value="">Aucun client</option>}
          </select>

          <button 
            className="btn btn-outline" 
            onClick={() => setShowAddClient(true)}
          >
            <Plus size={16} /> Nouveau Client
          </button>
        </div>

        {selectedClient && (
          <div className="contract-progression">
            <div className="progression-text">
              <span>Progression globale ({selectedClient.contract_period}) :</span>
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
          Chargement de l'espace de gestion...
        </div>
      ) : !selectedClient ? (
        <div className="empty-state panel" style={{ padding: '3rem', textAlign: 'center', marginTop: '1rem' }}>
          <AlertCircle size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
          <h3>Aucun client configuré</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Commencez par ajouter votre premier client.</p>
          <button className="btn btn-primary" onClick={() => setShowAddClient(true)}>Ajouter un client</button>
        </div>
      ) : (
        <div className="prod-grid">
          {/* LEFT COLUMN: COLLABORATORS & TASKS LIST */}
          <div className="prod-left-column">
            
            {/* TASKS LIST & MANAGER CREATION */}
            <div className="panel deliverables-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="panel-title" style={{ margin: 0 }}>LIVRABLES / TÂCHES</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddTask(true)}>
                  <Plus size={14} /> Nouvelle Tâche
                </button>
              </div>
              <p className="panel-subtitle">Administrez et mettez à jour les tâches du client.</p>

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
                          const progressPercent = budgetSec > 0 ? Math.round((spentSec / budgetSec) * 100) : 0;

                          return (
                            <div key={task.id} className={`task-item-card ${isCompleted ? 'completed' : ''}`}>
                              <div className="task-item-header">
                                <div className="task-item-details">
                                  <h4 className="task-item-name">{task.name}</h4>
                                  <span className="task-item-budget">
                                    {formatSecondsToHMText(spentSec)} / {task.budget_hours}h00 budgété
                                    {task.due_date && ` (Échéance: ${new Date(task.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })})`}
                                  </span>
                                </div>

                                <div className="task-item-actions">
                                  <select 
                                    className="task-status-selector"
                                    value={task.status} 
                                    onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                                  >
                                    <option value="Non démarré">À faire</option>
                                    <option value="En cours">En cours</option>
                                    <option value="Fait">Fait</option>
                                  </select>

                                  <button className="btn-icon-delete" onClick={() => handleDeleteTask(task.id)} title="Supprimer la tâche">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              <div className="task-item-progress">
                                <div className="progress-bar-container">
                                  <div 
                                    className={`progress-bar-fill ${isCompleted ? 'green' : 'blue'}`}
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

            {/* COLLABORATORS OVERVIEW */}
            <div className="panel collaborators-summary-card">
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={18} style={{ color: 'var(--brand-orange)' }} />
                TEMPS TOTAL PAR COLLABORATEUR
              </h2>
              
              {collaboratorSummaries.length === 0 ? (
                <p className="no-data-text">Aucun temps enregistré sur ce contrat.</p>
              ) : (
                <div className="collaborator-list">
                  {collaboratorSummaries.map(col => (
                    <div key={col.name} className="collaborator-row">
                      <div className="col-user-info">
                        <User size={16} style={{ color: 'var(--text-secondary)' }} />
                        <span>{col.name}</span>
                      </div>
                      <span className="col-time-badge">{formatSecondsToHMText(col.duration)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: MANUAL ENTRY & HISTORY */}
          <div className="prod-right-column">
            
            <div className="panel manual-and-history-card">
              <h2 className="panel-title">SAISIE MANUELLE & HISTORIQUE</h2>
              
              {/* Manual Entry Form */}
              <form onSubmit={handleAddManualLog} className="manual-log-form">
                <h3 className="form-sub-title">Saisir du temps</h3>
                <div className="manual-form-grid">
                  <div className="form-group">
                    <label>Collaborateur</label>
                    <select 
                      value={manualMemberId} 
                      onChange={(e) => setManualMemberId(e.target.value)}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {allMembers.map(m => (
                        <option key={m.employee_id} value={m.employee_id}>
                          {m.employee_first_name} {m.employee_name} ({m.service})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tâche</label>
                    <select 
                      value={manualTaskId} 
                      onChange={(e) => setManualTaskId(e.target.value)}
                      required
                    >
                      <option value="">Sélectionner...</option>
                      {selectedClient.tasks && selectedClient.tasks.map(t => (
                        <option key={t.id} value={t.id}>
                          [{t.category}] {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group row-fields">
                    <div>
                      <label>Heures</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="24"
                        value={manualHours} 
                        onChange={(e) => setManualHours(e.target.value)} 
                        required 
                      />
                    </div>
                    <div>
                      <label>Minutes</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="59"
                        value={manualMinutes} 
                        onChange={(e) => setManualMinutes(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Date</label>
                    <input 
                      type="date" 
                      value={manualDate} 
                      onChange={(e) => setManualDate(e.target.value)} 
                      required 
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem', width: '100%' }}>
                  Enregistrer le temps
                </button>
              </form>

              {/* History Table */}
              <div className="time-logs-history">
                <h3 className="form-sub-title" style={{ marginTop: '1.5rem' }}>Derniers enregistrements</h3>
                {timeLogs.length === 0 ? (
                  <p className="no-data-text">Aucun log enregistré.</p>
                ) : (
                  <div className="history-table-container">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Collaborateur</th>
                          <th>Tâche</th>
                          <th>Durée</th>
                          <th>Type</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeLogs.map(log => (
                          <tr key={log.id}>
                            <td>{new Date(log.logged_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
                            <td>{log.employee_name}</td>
                            <td>{log.task_name}</td>
                            <td>{formatSecondsToHMText(log.duration_seconds)}</td>
                            <td>
                              <span className={`log-type-tag ${log.log_type.startsWith('interruption') ? 'interruption' : 'production'}`}>
                                {log.log_type === 'production' ? 'Prod' : 'Inter.'}
                              </span>
                            </td>
                            <td>
                              <button className="btn-icon-delete" onClick={() => handleDeleteLog(log.id)} title="Supprimer">
                                <Trash2 size={12} />
                              </button>
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
        </div>
      )}

      {/* MODAL: ADD CLIENT */}
      {showAddClient && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Nouveau Client de Production</h2>
            <form onSubmit={handleAddClient}>
              <div className="form-group">
                <label>Nom du client</label>
                <input 
                  type="text" 
                  value={newClientName} 
                  onChange={(e) => setNewClientName(e.target.value)} 
                  placeholder="ex: STEP UP" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Code client</label>
                <input 
                  type="text" 
                  value={newClientCode} 
                  onChange={(e) => setNewClientCode(e.target.value)} 
                  placeholder="ex: SD-000" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Période du contrat</label>
                <input 
                  type="text" 
                  value={newClientPeriod} 
                  onChange={(e) => setNewClientPeriod(e.target.value)} 
                  placeholder="ex: Août 2026" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Budget total du contrat (heures)</label>
                <input 
                  type="number" 
                  value={newClientBudget} 
                  onChange={(e) => setNewClientBudget(e.target.value)} 
                  required 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddClient(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Créer le client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD TASK */}
      {showAddTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Nouvelle Tâche de Production</h2>
            <form onSubmit={handleAddTask}>
              <div className="form-group">
                <label>Catégorie / Groupe</label>
                <input 
                  type="text" 
                  value={newTaskCategory} 
                  onChange={(e) => setNewTaskCategory(e.target.value)} 
                  placeholder="ex: Social Media (12 Posts) ou Rédaction Web" 
                  list="categories-list"
                  required 
                />
                <datalist id="categories-list">
                  {Object.keys(groupedTasks).map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label>Nom du livrable / de la tâche</label>
                <input 
                  type="text" 
                  value={newTaskName} 
                  onChange={(e) => setNewTaskName(e.target.value)} 
                  placeholder="ex: Post #1 (FB/IG/LI) - Créa Visuel" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Budget d'heures pour cette tâche</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={newTaskBudget} 
                  onChange={(e) => setNewTaskBudget(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Date d'échéance (optionnelle)</label>
                <input 
                  type="date" 
                  value={newTaskDueDate} 
                  onChange={(e) => setNewTaskDueDate(e.target.value)} 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddTask(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Créer la tâche</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
