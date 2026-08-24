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

export default function EspaceManager({ user, token, allMembers, clients, loading, refreshData }) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [timeLogs, setTimeLogs] = useState([]);
  
  // Modals / Form states
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientInput, setNewClientInput] = useState('');
  const [newClientPeriod, setNewClientPeriod] = useState(() => {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const d = new Date();
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  });
  const [newClientBudget, setNewClientBudget] = useState('20');
  const [newClientStartDate, setNewClientStartDate] = useState('');
  const [newClientEndDate, setNewClientEndDate] = useState('');
  const [newClientFB, setNewClientFB] = useState('0');
  const [newClientIG, setNewClientIG] = useState('0');
  const [newClientLI, setNewClientLI] = useState('0');
  const [newClientGP, setNewClientGP] = useState('0');
  const [newClientNL, setNewClientNL] = useState('0');
  const [newClientBlog, setNewClientBlog] = useState('0');
  const [newClientUnquantifiable, setNewClientUnquantifiable] = useState('');

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

  // Sync selected client when props update
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
    if (selectedClient) {
      fetchLogs(selectedClient.id);
    } else {
      setTimeLogs([]);
    }
  }, [selectedClient, token]);

  // Actions: Client
  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClientInput || !newClientPeriod) return;

    let code = '';
    let name = newClientInput.trim();

    // Try to match prefix code like "SD-000 - STEP UP" or "SD-000 STEP UP"
    const match = newClientInput.match(/^([a-zA-Z0-9]+-\d+)\s*[-:]?\s*(.*)$/) || newClientInput.match(/^([a-zA-Z0-9]+)\s*[-:]\s*(.*)$/);
    if (match) {
      code = match[1].trim().toUpperCase();
      name = match[2].trim();
    } else {
      // Fallback unique code generation
      code = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).map(w => w[0]).join('').toUpperCase();
      if (code.length < 3) {
        code = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
      }
      if (code.length < 3) {
        code = code + Math.floor(100 + Math.random() * 900);
      }
    }

    try {
      const res = await fetch('/api/production/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          code,
          contract_period: newClientPeriod,
          total_budget_hours: parseFloat(newClientBudget) || 0,
          start_date: newClientStartDate || null,
          end_date: newClientEndDate || null,
          posts_facebook: parseInt(newClientFB) || 0,
          posts_instagram: parseInt(newClientIG) || 0,
          posts_linkedin: parseInt(newClientLI) || 0,
          posts_google: parseInt(newClientGP) || 0,
          newsletter_count: parseInt(newClientNL) || 0,
          blog_count: parseInt(newClientBlog) || 0,
          unquantifiable_tasks: newClientUnquantifiable || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setNewClientInput('');
        setNewClientStartDate('');
        setNewClientEndDate('');
        setNewClientFB('0');
        setNewClientIG('0');
        setNewClientLI('0');
        setNewClientGP('0');
        setNewClientNL('0');
        setNewClientBlog('0');
        setNewClientUnquantifiable('');
        setNewClientBudget('20');
        setShowAddClient(false);
        await refreshData();
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
        await refreshData();
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
        await refreshData();
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
        await refreshData();
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
          logged_at: new Date(manualDate).toISOString(),
          start_time: new Date(manualDate).toISOString(),
          end_time: new Date(manualDate).toISOString()
        })
      });

      if (res.ok) {
        setManualHours('1');
        setManualMinutes('0');
        await refreshData();
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
        await refreshData();
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
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <h2 className="modal-title" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Nouveau Client de Production</h2>
            <form onSubmit={handleAddClient}>
              <div className="form-group">
                <label>Nom du client (avec code facultatif)</label>
                <input 
                  type="text" 
                  value={newClientInput} 
                  onChange={(e) => setNewClientInput(e.target.value)} 
                  placeholder="ex: SD-000 - STEP UP" 
                  required 
                />
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                  <label>Budget total (heures)</label>
                  <input 
                    type="number" 
                    value={newClientBudget} 
                    onChange={(e) => setNewClientBudget(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                <div className="form-group">
                  <label>Date de début du contrat</label>
                  <input 
                    type="date" 
                    value={newClientStartDate} 
                    onChange={(e) => setNewClientStartDate(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Date de fin du contrat</label>
                  <input 
                    type="date" 
                    value={newClientEndDate} 
                    onChange={(e) => setNewClientEndDate(e.target.value)} 
                  />
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                <h3 className="form-sub-title" style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem', color: 'var(--brand-orange)' }}>Délivrables par mois</h3>
                <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', marginTop: '0.5rem' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Facebook Posts</label>
                    <input type="number" min="0" value={newClientFB} onChange={(e) => setNewClientFB(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Instagram Posts</label>
                    <input type="number" min="0" value={newClientIG} onChange={(e) => setNewClientIG(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>LinkedIn Posts</label>
                    <input type="number" min="0" value={newClientLI} onChange={(e) => setNewClientLI(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Google Posts</label>
                    <input type="number" min="0" value={newClientGP} onChange={(e) => setNewClientGP(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Newsletters</label>
                    <input type="number" min="0" value={newClientNL} onChange={(e) => setNewClientNL(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Billets Blog</label>
                    <input type="number" min="0" value={newClientBlog} onChange={(e) => setNewClientBlog(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label>Tâches inquantifiables (ex: modération, rédaction web...)</label>
                <textarea 
                  value={newClientUnquantifiable} 
                  onChange={(e) => setNewClientUnquantifiable(e.target.value)} 
                  placeholder="Saisissez ici les tâches inquantifiables ou notes particulières..."
                  style={{ width: '100%', minHeight: '80px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" style={{ minWidth: '120px' }} onClick={() => setShowAddClient(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ minWidth: '150px' }}>Créer le client</button>
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
