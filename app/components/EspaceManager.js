import { useEffect, useState } from 'react';
import { 
  Plus, 
  Trash2, 
  User, 
  Briefcase, 
  PlusCircle, 
  AlertCircle, 
  UserCheck,
  Edit,
  Calendar,
  PenTool,
  Palette,
  Users,
  BarChart3,
  Code
} from 'lucide-react';

export const DELIVERABLE_CATEGORIES = [
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
  const [newClientUnquantifiable, setNewClientUnquantifiable] = useState('');

  // Edit Client States
  const [showEditClient, setShowEditClient] = useState(false);
  const [editClientInput, setEditClientInput] = useState('');
  const [editClientPeriod, setEditClientPeriod] = useState('');
  const [editClientBudget, setEditClientBudget] = useState('20');
  const [editClientStartDate, setEditClientStartDate] = useState('');
  const [editClientEndDate, setEditClientEndDate] = useState('');
  const [editClientUnquantifiable, setEditClientUnquantifiable] = useState('');

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskCategory, setNewTaskCategory] = useState('Rédaction');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskBudget, setNewTaskBudget] = useState('4');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  // Modals d'alerte et confirmation personnalisés
  const [alertModal, setAlertModal] = useState({ show: false, title: '', message: '' });
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null });

  const showAlert = (title, message) => {
    setAlertModal({ show: true, title, message });
  };

  const showConfirm = (title, message, onConfirm) => {
    setConfirmModal({ show: true, title, message, onConfirm });
  };

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

  const [selectedFilter, setSelectedFilter] = useState('Tous');

  useEffect(() => {
    setSelectedFilter('Tous');
  }, [selectedClient?.id]);

  // Actions: Client
  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClientInput || !newClientPeriod) return;

    let code = '';
    let name = newClientInput.trim();

    const match = newClientInput.match(/^([a-zA-Z0-9]+-\d+)\s*[-:]?\s*(.*)$/) || newClientInput.match(/^([a-zA-Z0-9]+)\s*[-:]\s*(.*)$/);
    if (match) {
      code = match[1].trim().toUpperCase();
      name = match[2].trim();
    } else {
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
          unquantifiable_tasks: newClientUnquantifiable || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setNewClientInput('');
        setNewClientStartDate('');
        setNewClientEndDate('');
        setNewClientUnquantifiable('');
        setNewClientBudget('20');
        setShowAddClient(false);
        await refreshData();
        if (data.client) {
          setSelectedClient(data.client);
        }
      } else {
        const errData = await res.json();
        showAlert('Erreur', errData.error || 'Erreur lors de la création du client.');
      }
    } catch (err) {
      console.error('Error adding client:', err);
    }
  };

  const handleStartEditClient = (client) => {
    setEditClientInput(client.code ? `${client.code} - ${client.name}` : client.name);
    setEditClientPeriod(client.contract_period || '');
    setEditClientBudget(String(client.total_budget_hours || 0));
    setEditClientStartDate(client.start_date || '');
    setEditClientEndDate(client.end_date || '');
    setEditClientUnquantifiable(client.unquantifiable_tasks || '');
    setShowEditClient(true);
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    if (!editClientInput || !editClientPeriod || !selectedClient) return;

    let code = '';
    let name = editClientInput.trim();

    const match = editClientInput.match(/^([a-zA-Z0-9]+-\d+)\s*[-:]?\s*(.*)$/) || editClientInput.match(/^([a-zA-Z0-9]+)\s*[-:]\s*(.*)$/);
    if (match) {
      code = match[1].trim().toUpperCase();
      name = match[2].trim();
    } else {
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
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: selectedClient.id,
          name,
          code,
          contract_period: editClientPeriod,
          total_budget_hours: parseFloat(editClientBudget) || 0,
          start_date: editClientStartDate || null,
          end_date: editClientEndDate || null,
          unquantifiable_tasks: editClientUnquantifiable || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setShowEditClient(false);
        await refreshData();
        if (data.client) {
          setSelectedClient(data.client);
        }
      } else {
        const errData = await res.json();
        showAlert('Erreur', errData.error || 'Erreur lors de la modification du client.');
      }
    } catch (err) {
      console.error('Error editing client:', err);
      showAlert('Erreur', 'Erreur lors de la modification du client.');
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
        showAlert('Erreur', errData.error || 'Erreur lors de la création de la tâche.');
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
      } else {
        const errData = await res.json();
        showAlert('Erreur', errData.error || 'Erreur lors de la mise à jour du statut.');
      }
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  const handleUpdateTaskDueDate = async (taskId, newDueDate) => {
    try {
      const res = await fetch(`/api/production/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ due_date: newDueDate || null })
      });

      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error('Error updating task due date:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    showConfirm(
      'Supprimer la tâche',
      'Êtes-vous sûr de vouloir supprimer cette tâche ? Tous les enregistrements de temps associés seront également supprimés.',
      async () => {
        try {
          const res = await fetch(`/api/production/tasks/${taskId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.ok) {
            await refreshData();
          } else {
            const errData = await res.json();
            showAlert('Erreur', errData.error || 'Erreur lors de la suppression de la tâche.');
          }
        } catch (err) {
          console.error('Error deleting task:', err);
        }
      }
    );
  };

  const handleDeleteLog = async (logId) => {
    showConfirm(
      'Supprimer l\'enregistrement',
      'Êtes-vous sûr de vouloir supprimer cet enregistrement de temps ?',
      async () => {
        try {
          const res = await fetch(`/api/production/time-logs/${logId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.ok) {
            setTimeLogs(prev => prev.filter(l => l.id !== logId));
            await refreshData();
          } else {
            const errData = await res.json();
            showAlert('Erreur', errData.error || 'Erreur lors de la suppression du log.');
          }
        } catch (err) {
          console.error('Error deleting log:', err);
        }
      }
    );
  };

  const formatSecondsToHMText = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h${String(minutes).padStart(2, '0')}`;
    }
    return `${minutes} min`;
  };

  // Group logs by collaborator to calculate total time spent per person
  const getCollaboratorSummaries = () => {
    const summaryMap = {};
    timeLogs.forEach(log => {
      if (log.log_type === 'production') {
        const empName = log.employee_name || 'Inconnu';
        if (!summaryMap[empName]) {
          summaryMap[empName] = 0;
        }
        summaryMap[empName] += log.duration_seconds;
      }
    });

    return Object.entries(summaryMap).map(([name, duration]) => ({
      name,
      duration
    })).sort((a, b) => b.duration - a.duration);
  };

  const collaboratorSummaries = getCollaboratorSummaries();

  return (
    <div className="espace-manager">
      {/* HEADER CONTROLS */}
      <div className="prod-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 className="prod-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Briefcase size={24} style={{ color: 'var(--brand-orange)' }} />
              Pilotage Client :
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
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setShowAddClient(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PlusCircle size={16} /> Nouveau Client
            </button>
          </div>
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
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Progression globale : <strong>{selectedClient.total_spent_hours}h / {selectedClient.total_budget_hours}h ({selectedClient.progression_percent}%)</strong>
                </div>
              </div>
              
              <button 
                className="btn btn-outline btn-sm" 
                onClick={() => handleStartEditClient(selectedClient)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                <Edit size={14} /> Modifier le contrat
              </button>
            </div>

            {/* 5 Deliverables header summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {DELIVERABLE_CATEGORIES.map(card => {
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
          
          {/* LIVRABLES / TÂCHES */}
          <div className="panel deliverables-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                LIVRABLES / TÂCHES
                {selectedClient && (
                  <span style={{ 
                    fontSize: '0.85rem', 
                    fontWeight: '600', 
                    color: 'var(--brand-orange)', 
                    backgroundColor: 'rgba(234, 88, 12, 0.12)', 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '12px' 
                  }}>
                    {selectedClient.name}
                  </span>
                )}
              </h2>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddTask(true)}>
                <Plus size={14} /> Nouvelle Tâche
              </button>
            </div>
            <p className="panel-subtitle">Administrez et mettez à jour les livrables du client organisés selon les 5 catégories.</p>

            <div className="deliverables-5-container" style={{ marginTop: '1.25rem' }}>
              {DELIVERABLE_CATEGORIES.map(card => {
                const IconComp = card.icon;
                const catTasks = (selectedClient.tasks || []).filter(
                  t => t.category?.toLowerCase() === card.categoryKey.toLowerCase() ||
                       t.name?.toLowerCase() === card.title.toLowerCase() ||
                       t.category?.toLowerCase() === card.id.toLowerCase()
                );

                let catSpentSec = 0;
                let catBudgetHours = 0;
                catTasks.forEach(t => {
                  catSpentSec += (t.time_spent_seconds || 0);
                  catBudgetHours += (t.budget_hours || 0);
                });

                return (
                  <div 
                    key={card.id}
                    className="deliverable-card-item"
                    style={{ borderLeft: `4px solid ${card.themeColor}` }}
                  >
                    <div className="deliverable-card-header">
                      <div className="deliverable-card-title-group">
                        <div 
                          className="deliverable-card-icon-badge"
                          style={{ backgroundColor: `${card.themeColor}15`, color: card.themeColor }}
                        >
                          <IconComp size={20} />
                        </div>
                        <div>
                          <h3 className="deliverable-card-title">{card.title}</h3>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {formatSecondsToHMText(catSpentSec)}
                            {catBudgetHours > 0 ? ` / ${catBudgetHours}h budgétées` : ' passées au total'}
                          </span>
                        </div>
                      </div>

                      <button 
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setNewTaskCategory(card.categoryKey);
                          setShowAddTask(true);
                        }}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      >
                        <Plus size={12} /> Ajouter une tâche
                      </button>
                    </div>

                    {/* Activities Tags */}
                    <div className="deliverable-activities-tags">
                      {card.activities.map(act => (
                        <span key={act} className="activity-pill">
                          {act}
                        </span>
                      ))}
                    </div>

                    {/* Sub-tasks List if any */}
                    {catTasks.length > 0 && (
                      <div className="task-items-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                        {catTasks.map(task => {
                          const budgetSec = task.budget_hours * 3600;
                          const spentSec = task.time_spent_seconds || 0;
                          const isCompleted = task.status === 'Fait';
                          const progressPercent = budgetSec > 0 ? Math.round((spentSec / budgetSec) * 100) : 0;

                          return (
                            <div key={task.id} className={`task-item-card ${isCompleted ? 'completed' : ''}`}>
                              <div className="task-item-header">
                                <div className="task-item-details">
                                  <h4 className="task-item-name">{task.name}</h4>
                                  <span className="task-item-budget" style={{ display: 'block' }}>
                                    {formatSecondsToHMText(spentSec)} / {task.budget_hours}h00 budgété
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'nowrap' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>Échéance :</span>
                                    <input 
                                      type="date"
                                      value={task.due_date ? task.due_date.split('T')[0] : ''}
                                      onChange={(e) => handleUpdateTaskDueDate(task.id, e.target.value)}
                                      style={{
                                        fontSize: '0.7rem',
                                        padding: '0.1rem 0.25rem',
                                        borderRadius: '4px',
                                        border: '1px solid var(--border-light)',
                                        backgroundColor: 'var(--panel-white)',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        width: '115px',
                                        flexShrink: 0
                                      }}
                                    />
                                  </div>
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* TEMPS TOTAL PAR COLLABORATEUR */}
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

          {/* HISTORIQUE DES ENREGISTREMENTS */}
          <div className="panel history-log-card">
            <h2 className="panel-title">HISTORIQUE DES ENREGISTREMENTS</h2>
            
            <div className="time-logs-history">
              {timeLogs.length === 0 ? (
                <p className="no-data-text">Aucun log enregistré.</p>
              ) : (
                <div className="history-table-container">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Collaborateur</th>
                        <th>Tâche / Livrable</th>
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

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Tâches inquantifiables et notes</label>
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

      {/* MODAL: EDIT CLIENT */}
      {showEditClient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
            <h2 className="modal-title" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Modifier le contrat</h2>
            <form onSubmit={handleEditClient}>
              <div className="form-group">
                <label>Nom du client (avec code facultatif)</label>
                <input 
                  type="text" 
                  value={editClientInput} 
                  onChange={(e) => setEditClientInput(e.target.value)} 
                  placeholder="ex: SD-000 - STEP UP" 
                  required 
                />
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Période du contrat</label>
                  <input 
                    type="text" 
                    value={editClientPeriod} 
                    onChange={(e) => setEditClientPeriod(e.target.value)} 
                    placeholder="ex: Août 2026" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Budget total (heures)</label>
                  <input 
                    type="number" 
                    value={editClientBudget} 
                    onChange={(e) => setEditClientBudget(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                <div className="form-group">
                  <label>Date de début du contrat</label>
                  <input 
                    type="date" 
                    value={editClientStartDate} 
                    onChange={(e) => setEditClientStartDate(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Date de fin du contrat</label>
                  <input 
                    type="date" 
                    value={editClientEndDate} 
                    onChange={(e) => setEditClientEndDate(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Tâches inquantifiables et notes</label>
                <textarea 
                  value={editClientUnquantifiable} 
                  onChange={(e) => setEditClientUnquantifiable(e.target.value)} 
                  placeholder="Saisissez ici les tâches inquantifiables ou notes particulières..."
                  style={{ width: '100%', minHeight: '80px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" style={{ minWidth: '120px' }} onClick={() => setShowEditClient(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ minWidth: '150px' }}>Enregistrer</button>
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
                <label>Catégorie de livrable</label>
                <select 
                  value={newTaskCategory} 
                  onChange={(e) => setNewTaskCategory(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}
                >
                  {DELIVERABLE_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.categoryKey}>{cat.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Nom du livrable / de la tâche</label>
                <input 
                  type="text" 
                  value={newTaskName} 
                  onChange={(e) => setNewTaskName(e.target.value)} 
                  placeholder="ex: Rédaction newsletter de lancement" 
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
