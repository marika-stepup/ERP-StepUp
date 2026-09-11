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
  Code,
  Repeat,
  Search,
  Filter,
  CheckCircle,
  Sparkles,
  Layers,
  CheckSquare,
  Square
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
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('');
  const [newTaskAssignedToName, setNewTaskAssignedToName] = useState('');
  const [newTaskIsRecurring, setNewTaskIsRecurring] = useState(false);

  // Edit Task States
  const [showEditTask, setShowEditTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editTaskCategory, setEditTaskCategory] = useState('Rédaction');
  const [editTaskName, setEditTaskName] = useState('');
  const [editTaskBudget, setEditTaskBudget] = useState('4');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskAssignedTo, setEditTaskAssignedTo] = useState('');
  const [editTaskAssignedToName, setEditTaskAssignedToName] = useState('');
  const [editTaskIsRecurring, setEditTaskIsRecurring] = useState(false);

  // Filtres pour le nettoyage des anciennes tâches (posts/articles)
  const [legacyFilterClientId, setLegacyFilterClientId] = useState('ALL');
  const [legacySearchQuery, setLegacySearchQuery] = useState('');

  // Sélection multiple de tâches pour suppression groupée
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

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
          due_date: newTaskDueDate || null,
          assigned_to: newTaskAssignedTo || null,
          assigned_to_name: newTaskAssignedToName || null,
          is_recurring: newTaskIsRecurring
        })
      });

      if (res.ok) {
        setNewTaskName('');
        setNewTaskBudget('4');
        setNewTaskDueDate('');
        setNewTaskAssignedTo('');
        setNewTaskAssignedToName('');
        setNewTaskIsRecurring(false);
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

  const handleStartEditTask = (task) => {
    setEditingTask(task);
    setEditTaskCategory(task.category || 'Rédaction');
    setEditTaskName(task.name || '');
    setEditTaskBudget(task.budget_hours !== undefined && task.budget_hours !== null ? String(task.budget_hours) : '4');
    setEditTaskDueDate(task.due_date ? task.due_date.split('T')[0] : '');
    setEditTaskAssignedTo(task.assigned_to || '');
    setEditTaskAssignedToName(task.assigned_to_name || '');
    setEditTaskIsRecurring(!!task.is_recurring);
    setShowEditTask(true);
  };

  const handleSaveEditTask = async (e) => {
    e.preventDefault();
    if (!editingTask || !editTaskName || !editTaskCategory) return;

    try {
      const res = await fetch(`/api/production/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          category: editTaskCategory,
          name: editTaskName,
          budget_hours: parseFloat(editTaskBudget) || 0,
          due_date: editTaskDueDate || null,
          assigned_to: editTaskAssignedTo || null,
          assigned_to_name: editTaskAssignedToName || null,
          is_recurring: editTaskIsRecurring
        })
      });

      if (res.ok) {
        setShowEditTask(false);
        setEditingTask(null);
        await refreshData();
      } else {
        const errData = await res.json();
        showAlert('Erreur', errData.error || 'Erreur lors de la modification de la tâche.');
      }
    } catch (err) {
      console.error('Error saving edited task:', err);
      showAlert('Erreur', 'Erreur réseau lors de la modification de la tâche.');
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
            setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
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

  // Gestion de la sélection multiple et suppression groupée
  const handleToggleSelectTask = (taskId) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAllFilteredLegacyTasks = () => {
    const filteredIds = filteredLegacyTasks.map(t => t.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedTaskIds.includes(id));
    if (allSelected) {
      setSelectedTaskIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedTaskIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleClearSelectedTasks = () => {
    setSelectedTaskIds([]);
  };

  const handleDeleteSelectedTasks = () => {
    if (selectedTaskIds.length === 0) return;
    showConfirm(
      'Suppression multiple',
      `Êtes-vous sûr de vouloir supprimer définitivement les ${selectedTaskIds.length} tâche(s) sélectionnée(s) ? Tous les temps associés seront également supprimés.`,
      async () => {
        try {
          const res = await fetch('/api/production/tasks', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ taskIds: selectedTaskIds })
          });

          if (res.ok) {
            setSelectedTaskIds([]);
            await refreshData();
          } else {
            const errData = await res.json();
            showAlert('Erreur', errData.error || 'Erreur lors de la suppression groupée.');
          }
        } catch (err) {
          console.error('Error deleting multiple tasks:', err);
          showAlert('Erreur', 'Erreur réseau lors de la suppression multiple.');
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

  // Identification de toutes les tâches de posts/articles créées dans la précédente version pour tous les clients
  const allLegacyTasks = [];
  (clients || []).forEach(c => {
    (c.tasks || []).forEach(t => {
      const cat = (t.category || '').toLowerCase();
      const name = (t.name || '').toLowerCase();
      
      const keywords = ['post', 'article', 'linkedin', 'facebook', 'instagram', 'tiktok', 'twitter', 'bb', 'visuel', 'carrousel', 'story', 'reels', 'août', 'aout', 'septembre', 'octobre', 'novembre', 'décembre', 'decembre', 'janvier', 'février', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet'];
      const matchesKeyword = keywords.some(k => cat.includes(k) || name.includes(k));
      
      const isStandardDeliverable = ['rédaction', 'redaction', 'créa graphique', 'crea graphique', 'créa', 'crea', 'réunion', 'reunion', 'data', 'tech'].includes(cat) &&
        ['rédaction', 'redaction', 'créa graphique', 'crea graphique', 'réunion', 'reunion', 'data', 'tech'].includes(name.trim().toLowerCase());

      if (matchesKeyword || (!isStandardDeliverable && (cat.includes('août') || cat.includes('aout') || name.toLowerCase().startsWith('post') || name.toLowerCase().startsWith('article')))) {
        allLegacyTasks.push({
          ...t,
          clientId: c.id,
          clientName: c.name,
          clientCode: c.code
        });
      }
    });
  });

  const filteredLegacyTasks = allLegacyTasks.filter(t => {
    if (legacyFilterClientId !== 'ALL' && t.clientId !== legacyFilterClientId) return false;
    if (legacySearchQuery.trim()) {
      const q = legacySearchQuery.toLowerCase();
      const matchName = (t.name || '').toLowerCase().includes(q);
      const matchCat = (t.category || '').toLowerCase().includes(q);
      const matchClient = (t.clientName || '').toLowerCase().includes(q) || (t.clientCode || '').toLowerCase().includes(q);
      return matchName || matchCat || matchClient;
    }
    return true;
  });

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
          
          {/* ANCIENNES TÂCHES / POSTS & ARTICLES À NETTOYER (POUR TOUS LES CLIENTS) */}
          {allLegacyTasks.length > 0 && (
            <div className="panel legacy-cleanup-card" style={{ 
              border: '1.5px solid #f97316', 
              background: 'linear-gradient(180deg, #fff7ed 0%, var(--panel-white) 100%)',
              padding: '1.25rem 1.5rem',
              borderRadius: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h2 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c2410c' }}>
                      <Layers size={20} />
                      ANCIENNES TÂCHES : POSTS & ARTICLES (VERSION PRÉCÉDENTE)
                    </h2>
                    <span style={{ 
                      background: '#ea580c', 
                      color: '#ffffff', 
                      fontSize: '0.8rem', 
                      fontWeight: '800', 
                      padding: '0.2rem 0.65rem', 
                      borderRadius: '9999px' 
                    }}>
                      {allLegacyTasks.length} tâches à nettoyer
                    </span>
                  </div>
                  <p className="panel-subtitle" style={{ margin: '0.25rem 0 0 0', color: '#9a3412' }}>
                    Retrouvez ci-dessous toutes les cartes unitaires générées dans la précédente version pour tous les clients afin de les supprimer un par un.
                  </p>
                </div>

                {/* Filtres client et recherche */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--panel-white)', border: '1px solid var(--border-light)', padding: '0.35rem 0.65rem', borderRadius: '6px' }}>
                    <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
                    <select 
                      value={legacyFilterClientId} 
                      onChange={(e) => setLegacyFilterClientId(e.target.value)}
                      style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="ALL">-- Tous les clients ({allLegacyTasks.length}) --</option>
                      {clients.map(c => {
                        const count = allLegacyTasks.filter(t => t.clientId === c.id).length;
                        if (count === 0) return null;
                        return (
                          <option key={c.id} value={c.id}>
                            {c.code ? `${c.code} - ` : ''}{c.name} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--panel-white)', border: '1px solid var(--border-light)', padding: '0.35rem 0.65rem', borderRadius: '6px' }}>
                    <Search size={14} style={{ color: 'var(--text-secondary)' }} />
                    <input 
                      type="text" 
                      value={legacySearchQuery} 
                      onChange={(e) => setLegacySearchQuery(e.target.value)}
                      placeholder="Filtrer par nom..."
                      style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', width: '130px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Barre d'action pour suppression groupée */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: selectedTaskIds.length > 0 ? '#ffedd5' : 'rgba(255, 255, 255, 0.7)',
                border: `1px solid ${selectedTaskIds.length > 0 ? '#f97316' : 'var(--border-light)'}`,
                borderRadius: '8px',
                padding: '0.6rem 0.9rem',
                marginTop: '0.5rem',
                flexWrap: 'wrap',
                gap: '0.65rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', userSelect: 'none' }}>
                    <input 
                      type="checkbox"
                      checked={filteredLegacyTasks.length > 0 && filteredLegacyTasks.every(t => selectedTaskIds.includes(t.id))}
                      onChange={handleSelectAllFilteredLegacyTasks}
                      style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#ea580c' }}
                    />
                    <span>Tout sélectionner ({filteredLegacyTasks.length})</span>
                  </label>
                  {selectedTaskIds.length > 0 && (
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: '800', 
                      color: '#ea580c', 
                      background: '#ffffff', 
                      padding: '0.15rem 0.6rem', 
                      borderRadius: '12px', 
                      border: '1px solid #fed7aa' 
                    }}>
                      {selectedTaskIds.length} sélectionnée(s)
                    </span>
                  )}
                </div>

                {selectedTaskIds.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleClearSelectedTasks}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        padding: '0.3rem 0.5rem',
                        textDecoration: 'underline'
                      }}
                    >
                      Désélectionner tout
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedTasks}
                      style={{
                        background: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.84rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#ef4444'; }}
                    >
                      <Trash2 size={15} /> Supprimer les {selectedTaskIds.length} éléments sélectionnés
                    </button>
                  </div>
                )}
              </div>

              {/* Grid of Legacy Tasks */}
              {filteredLegacyTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9a3412', fontSize: '0.88rem' }}>
                  Aucune tâche ne correspond aux filtres sélectionnés.
                </div>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                  gap: '0.85rem', 
                  marginTop: '1rem',
                  maxHeight: '480px',
                  overflowY: 'auto',
                  paddingRight: '0.25rem'
                }}>
                  {filteredLegacyTasks.map(task => {
                    const spentSec = task.time_spent_seconds || 0;
                    const isCompleted = task.status === 'Fait';
                    const isSelected = selectedTaskIds.includes(task.id);

                    return (
                      <div 
                        key={task.id} 
                        className={`task-item-card ${isCompleted ? 'completed' : ''}`}
                        style={{
                          background: isSelected ? '#fff7ed' : 'var(--panel-white)',
                          border: isSelected ? '2px solid #ea580c' : '1px solid #fed7aa',
                          borderRadius: '8px',
                          padding: '0.75rem 0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                          boxShadow: isSelected ? '0 2px 8px rgba(234, 88, 12, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectTask(task.id)}
                              style={{ 
                                width: '16px', 
                                height: '16px', 
                                cursor: 'pointer', 
                                accentColor: '#ea580c', 
                                marginTop: '0.2rem',
                                flexShrink: 0
                              }}
                              title="Sélectionner pour suppression"
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Client & Category Badge */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                                <span style={{ 
                                  fontSize: '0.68rem', 
                                  fontWeight: '700', 
                                  color: '#178FCB', 
                                  background: 'rgba(23, 143, 203, 0.1)', 
                                  padding: '0.1rem 0.4rem', 
                                  borderRadius: '4px' 
                                }}>
                                  {task.clientCode ? `${task.clientCode} • ` : ''}{task.clientName}
                                </span>
                                {task.category && (
                                  <span style={{ 
                                    fontSize: '0.68rem', 
                                    fontWeight: '700', 
                                    color: '#ea580c', 
                                    background: '#ffedd5', 
                                    padding: '0.1rem 0.4rem', 
                                    borderRadius: '4px' 
                                  }}>
                                    {task.category}
                                  </span>
                                )}
                              </div>

                              {/* Task Name */}
                              <h4 style={{ 
                                fontSize: '0.92rem', 
                                fontWeight: '800', 
                                color: isCompleted ? '#338855' : '#0f172a', 
                                margin: '0 0 0.2rem 0',
                                textDecoration: isCompleted ? 'line-through' : 'none'
                              }}>
                                {task.name}
                              </h4>

                              {/* Meta: time, due date, assignee */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                <span style={{ fontWeight: '600' }}>
                                  {formatSecondsToHMText(spentSec)} / {task.budget_hours}h00 budgété
                                </span>
                                {task.due_date && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                    <Calendar size={11} />
                                    <span>{new Date(task.due_date).toLocaleDateString('fr-FR')}</span>
                                  </div>
                                )}
                                {task.assigned_to_name && (
                                  <span style={{ background: 'rgba(100, 116, 139, 0.1)', padding: '0.05rem 0.35rem', borderRadius: '4px', fontSize: '0.68rem' }}>
                                    {task.assigned_to_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Delete & Edit buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                            <select 
                              className="task-status-selector"
                              value={task.status} 
                              onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem' }}
                            >
                              <option value="Non démarré">À faire</option>
                              <option value="En cours">En cours</option>
                              <option value="Fait">Fait</option>
                            </select>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                              <button 
                                type="button"
                                className="btn-icon-edit" 
                                onClick={() => handleStartEditTask(task)} 
                                title={`Modifier « ${task.name} »`}
                                style={{
                                  background: '#ffedd5',
                                  color: '#ea580c',
                                  border: '1px solid #fed7aa',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.35rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#ffedd5'; e.currentTarget.style.color = '#ea580c'; }}
                              >
                                <Edit size={12} />
                              </button>

                              <button 
                                className="btn-icon-delete" 
                                onClick={() => handleDeleteTask(task.id)} 
                                title={`Supprimer « ${task.name} »`}
                                style={{
                                  background: '#fee2e2',
                                  color: '#ef4444',
                                  border: '1px solid #fca5a5',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.35rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          
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

            {/* Barre d'action sélection multiple pour livrables du client */}
            {selectedTaskIds.length > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fee2e2',
                border: '1.5px solid #f87171',
                borderRadius: '8px',
                padding: '0.65rem 1rem',
                marginTop: '1rem',
                flexWrap: 'wrap',
                gap: '0.75rem',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#991b1b' }}>
                    {selectedTaskIds.length} tâche(s) sélectionnée(s)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={handleClearSelectedTasks}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', background: '#fff' }}
                  >
                    Annuler la sélection
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelectedTasks}
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.45rem 0.9rem',
                      fontSize: '0.84rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)'
                    }}
                  >
                    <Trash2 size={14} /> Supprimer les {selectedTaskIds.length} éléments sélectionnés
                  </button>
                </div>
              </div>
            )}

            <div className="deliverables-5-container" style={{ marginTop: '1.25rem' }}>
              {DELIVERABLE_CATEGORIES.map(card => {
                const IconComp = card.icon;
                const catTasks = (selectedClient.tasks || []).filter(t => {
                  const cat = (t.category || '').toLowerCase();
                  const name = (t.name || '').toLowerCase();

                  if (card.id === 'redaction') {
                    return cat === 'rédaction' || cat === 'redaction' || cat.includes('post') || cat.includes('article') || cat.includes('bb') || cat.includes('linkedin') || cat.includes('facebook') || cat.includes('instagram') || name.includes('post') || name.includes('article') || cat === card.id.toLowerCase() || name === card.title.toLowerCase();
                  }
                  if (card.id === 'crea_graphique') {
                    return cat === 'créa graphique' || cat === 'crea graphique' || cat === 'créa' || cat === 'crea' || cat.includes('visuel') || cat.includes('video') || cat.includes('vidéo') || cat.includes('maquette') || cat === card.id.toLowerCase() || name === card.title.toLowerCase();
                  }
                  if (card.id === 'reunion') {
                    return cat === 'réunion' || cat === 'reunion' || cat.includes('reunion') || cat.includes('réunion') || cat.includes('brief') || cat.includes('meeting') || cat === card.id.toLowerCase() || name === card.title.toLowerCase();
                  }
                  if (card.id === 'data') {
                    return cat === 'data' || cat.includes('reporting') || cat.includes('rapport') || cat.includes('rh') || cat.includes('comptabilite') || cat.includes('comptabilité') || cat === card.id.toLowerCase() || name === card.title.toLowerCase();
                  }
                  if (card.id === 'tech') {
                    return cat === 'tech' || cat.includes('web') || cat.includes('ia') || cat.includes('dev') || cat.includes('tma') || cat === card.id.toLowerCase() || name === card.title.toLowerCase();
                  }
                  return t.category?.toLowerCase() === card.categoryKey.toLowerCase() || t.name?.toLowerCase() === card.title.toLowerCase();
                });

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
                          const isSelected = selectedTaskIds.includes(task.id);

                          return (
                            <div 
                              key={task.id} 
                              className={`task-item-card ${isCompleted ? 'completed' : ''}`}
                              style={{
                                border: isSelected ? '2px solid #ea580c' : undefined,
                                background: isSelected ? '#fff7ed' : undefined,
                                boxShadow: isSelected ? '0 2px 8px rgba(234, 88, 12, 0.15)' : undefined
                              }}
                            >
                              <div className="task-item-header">
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                  <input 
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectTask(task.id)}
                                    style={{ 
                                      width: '15px', 
                                      height: '15px', 
                                      cursor: 'pointer', 
                                      accentColor: '#ea580c', 
                                      marginTop: '0.2rem',
                                      flexShrink: 0
                                    }}
                                    title="Sélectionner pour suppression"
                                  />
                                  <div className="task-item-details" style={{ flex: 1, minWidth: 0 }}>
                                    <h4 className="task-item-name">{task.name}</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', margin: '0.2rem 0' }}>
                                      <span className="task-item-budget">
                                        {formatSecondsToHMText(spentSec)} / {task.budget_hours}h00 budgété
                                      </span>
                                      {task.assigned_to_name && (
                                        <span style={{ fontSize: '0.68rem', background: 'rgba(23, 143, 203, 0.1)', color: '#178FCB', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                          <User size={10} /> {task.assigned_to_name}
                                        </span>
                                      )}
                                      {task.is_recurring && (
                                        <span style={{ fontSize: '0.68rem', background: 'rgba(51, 136, 85, 0.1)', color: '#338855', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                          <Repeat size={10} /> Récurrente
                                        </span>
                                      )}
                                    </div>
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
                                </div>

                                <div className="task-item-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                  <select 
                                    className="task-status-selector"
                                    value={task.status} 
                                    onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                                  >
                                    <option value="Non démarré">À faire</option>
                                    <option value="En cours">En cours</option>
                                    <option value="Fait">Fait</option>
                                  </select>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                                    <button 
                                      type="button"
                                      className="btn-icon-edit" 
                                      onClick={() => handleStartEditTask(task)} 
                                      title="Modifier la tâche"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#64748b',
                                        cursor: 'pointer',
                                        padding: '0.2rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '4px',
                                        transition: 'all 0.15s ease'
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ea580c'; e.currentTarget.style.backgroundColor = 'rgba(234, 88, 12, 0.1)'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                      <Edit size={12} />
                                    </button>

                                    <button className="btn-icon-delete" onClick={() => handleDeleteTask(task.id)} title="Supprimer la tâche">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
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

            {/* Autres tâches spécifiques du client */}
            {(() => {
              const otherClientTasks = (selectedClient.tasks || []).filter(t => {
                const cat = (t.category || '').toLowerCase();
                const name = (t.name || '').toLowerCase();
                const isRedaction = cat === 'rédaction' || cat === 'redaction' || cat.includes('post') || cat.includes('article') || cat.includes('bb') || cat.includes('linkedin') || cat.includes('facebook') || cat.includes('instagram') || name.includes('post') || name.includes('article') || cat === 'redaction';
                const isCrea = cat === 'créa graphique' || cat === 'crea graphique' || cat === 'créa' || cat === 'crea' || cat.includes('visuel') || cat.includes('video') || cat.includes('vidéo') || cat.includes('maquette') || cat === 'crea_graphique';
                const isReunion = cat === 'réunion' || cat === 'reunion' || cat.includes('reunion') || cat.includes('réunion') || cat.includes('brief') || cat.includes('meeting') || cat === 'reunion';
                const isData = cat === 'data' || cat.includes('reporting') || cat.includes('rapport') || cat.includes('rh') || cat.includes('comptabilite') || cat.includes('comptabilité');
                const isTech = cat === 'tech' || cat.includes('web') || cat.includes('ia') || cat.includes('dev') || cat.includes('tma');
                return !isRedaction && !isCrea && !isReunion && !isData && !isTech;
              });

              if (otherClientTasks.length === 0) return null;

              return (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.2rem', borderTop: '1px solid var(--border-light)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Layers size={16} style={{ color: 'var(--brand-orange)' }} />
                    Autres tâches du client ({otherClientTasks.length})
                  </h3>
                  <div className="task-items-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {otherClientTasks.map(task => {
                      const budgetSec = task.budget_hours * 3600;
                      const spentSec = task.time_spent_seconds || 0;
                      const isCompleted = task.status === 'Fait';
                      const isSelected = selectedTaskIds.includes(task.id);

                      return (
                        <div 
                          key={task.id} 
                          className={`task-item-card ${isCompleted ? 'completed' : ''}`}
                          style={{
                            border: isSelected ? '2px solid #ea580c' : undefined,
                            background: isSelected ? '#fff7ed' : undefined,
                            boxShadow: isSelected ? '0 2px 8px rgba(234, 88, 12, 0.15)' : undefined
                          }}
                        >
                          <div className="task-item-header">
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectTask(task.id)}
                                style={{ 
                                  width: '15px', 
                                  height: '15px', 
                                  cursor: 'pointer', 
                                  accentColor: '#ea580c', 
                                  marginTop: '0.2rem',
                                  flexShrink: 0
                                }}
                                title="Sélectionner pour suppression"
                              />
                              <div className="task-item-details" style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--brand-orange)', background: 'rgba(249, 115, 22, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-block', marginBottom: '0.2rem' }}>
                                  {task.category || 'Non catégorisé'}
                                </span>
                                <h4 className="task-item-name">{task.name}</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', margin: '0.2rem 0' }}>
                                  <span className="task-item-budget">
                                    {formatSecondsToHMText(spentSec)} / {task.budget_hours}h00 budgété
                                  </span>
                                  {task.assigned_to_name && (
                                    <span style={{ fontSize: '0.68rem', background: 'rgba(23, 143, 203, 0.1)', color: '#178FCB', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '600' }}>
                                      {task.assigned_to_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="task-item-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                                <button 
                                  type="button"
                                  className="btn-icon-edit" 
                                  onClick={() => handleStartEditTask(task)} 
                                  title="Modifier la tâche"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    padding: '0.2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px',
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ea580c'; e.currentTarget.style.backgroundColor = 'rgba(234, 88, 12, 0.1)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                  <Edit size={12} />
                                </button>

                                <button className="btn-icon-delete" onClick={() => handleDeleteTask(task.id)} title="Supprimer la tâche">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Nouvelle Tâche de Production</h2>
              {selectedClient && (
                <span style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: '700', 
                  color: 'var(--brand-orange)', 
                  backgroundColor: 'rgba(234, 88, 12, 0.12)', 
                  padding: '0.25rem 0.75rem', 
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <Briefcase size={14} /> {selectedClient.code ? `${selectedClient.code} - ` : ''}{selectedClient.name}
                </span>
              )}
            </div>

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

              <div className="form-group">
                <label>Collaborateur assigné (facultatif)</label>
                {(() => {
                  const getFirstName = (m) => {
                    if (m.employee_first_name && m.employee_first_name.trim()) {
                      return m.employee_first_name.trim();
                    }
                    if (m.employee_name && m.employee_name.trim()) {
                      return m.employee_name.trim().split(' ')[0];
                    }
                    return 'Collaborateur';
                  };

                  const selectableMembers = (allMembers || [])
                    .filter(m => (m.service || '').trim().toLowerCase() !== 'pointeur')
                    .sort((a, b) => {
                      const nameA = getFirstName(a);
                      const nameB = getFirstName(b);
                      return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
                    });

                  return (
                    <select 
                      value={newTaskAssignedTo} 
                      onChange={(e) => {
                        const memberId = e.target.value;
                        setNewTaskAssignedTo(memberId);
                        const m = selectableMembers.find(mem => (mem.employee_id || mem.id) === memberId);
                        setNewTaskAssignedToName(m ? getFirstName(m) : '');
                      }}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}
                    >
                      <option value="">-- Tous les collaborateurs (Partagée) --</option>
                      {selectableMembers.map(m => {
                        const firstName = getFirstName(m);
                        const label = m.service ? `${firstName} (${m.service})` : firstName;
                        return (
                          <option key={m.employee_id || m.id} value={m.employee_id || m.id}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  );
                })()}
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Si vous sélectionnez un collaborateur, cette tâche n'apparaîtra que dans son espace de production.
                </p>
              </div>

              <div className="form-group" style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--background-light)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={newTaskIsRecurring} 
                    onChange={(e) => setNewTaskIsRecurring(e.target.checked)} 
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-orange)', cursor: 'pointer' }}
                  />
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Transformer en tâche récurrente</strong>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      La tâche se renouvelle chaque mois pour ce client.
                    </p>
                  </div>
                </label>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddTask(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>Créer la tâche</span>
                  {selectedClient && (
                    <span style={{ 
                      background: 'rgba(255, 255, 255, 0.25)', 
                      padding: '0.1rem 0.45rem', 
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: '700'
                    }}>
                      pour {selectedClient.name}
                    </span>
                  )}
                </button>
                {selectedClient && (
                  <span style={{ 
                    fontSize: '0.82rem', 
                    fontWeight: '700', 
                    color: 'var(--brand-orange)', 
                    backgroundColor: 'rgba(234, 88, 12, 0.1)', 
                    padding: '0.35rem 0.7rem', 
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    <Briefcase size={13} /> {selectedClient.name}
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TASK */}
      {showEditTask && editingTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Modifier la Tâche</h2>
              {(editingTask.clientName || selectedClient) && (
                <span style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: '700', 
                  color: 'var(--brand-orange)', 
                  backgroundColor: 'rgba(234, 88, 12, 0.12)', 
                  padding: '0.25rem 0.75rem', 
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <Briefcase size={14} /> {editingTask.clientCode ? `${editingTask.clientCode} - ` : (selectedClient?.code ? `${selectedClient.code} - ` : '')}{editingTask.clientName || selectedClient?.name}
                </span>
              )}
            </div>

            <form onSubmit={handleSaveEditTask}>
              <div className="form-group">
                <label>Catégorie de livrable</label>
                <select 
                  value={editTaskCategory} 
                  onChange={(e) => setEditTaskCategory(e.target.value)} 
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
                  value={editTaskName} 
                  onChange={(e) => setEditTaskName(e.target.value)} 
                  placeholder="ex: Rédaction newsletter de lancement" 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Budget d'heures pour cette tâche</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={editTaskBudget} 
                  onChange={(e) => setEditTaskBudget(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Date d'échéance (optionnelle)</label>
                <input 
                  type="date" 
                  value={editTaskDueDate} 
                  onChange={(e) => setEditTaskDueDate(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label>Collaborateur assigné (facultatif)</label>
                {(() => {
                  const getFirstName = (m) => {
                    if (m.employee_first_name && m.employee_first_name.trim()) {
                      return m.employee_first_name.trim();
                    }
                    if (m.employee_name && m.employee_name.trim()) {
                      return m.employee_name.trim().split(' ')[0];
                    }
                    return 'Collaborateur';
                  };

                  const selectableMembers = (allMembers || [])
                    .filter(m => (m.service || '').trim().toLowerCase() !== 'pointeur')
                    .sort((a, b) => {
                      const nameA = getFirstName(a);
                      const nameB = getFirstName(b);
                      return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
                    });

                  return (
                    <select 
                      value={editTaskAssignedTo} 
                      onChange={(e) => {
                        const memberId = e.target.value;
                        setEditTaskAssignedTo(memberId);
                        const m = selectableMembers.find(mem => (mem.employee_id || mem.id) === memberId);
                        setEditTaskAssignedToName(m ? getFirstName(m) : '');
                      }}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}
                    >
                      <option value="">-- Tous les collaborateurs (Partagée) --</option>
                      {selectableMembers.map(m => {
                        const firstName = getFirstName(m);
                        const label = m.service ? `${firstName} (${m.service})` : firstName;
                        return (
                          <option key={m.employee_id || m.id} value={m.employee_id || m.id}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  );
                })()}
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Si vous sélectionnez un collaborateur, cette tâche n'apparaîtra que dans son espace de production.
                </p>
              </div>

              <div className="form-group" style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--background-light)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={editTaskIsRecurring} 
                    onChange={(e) => setEditTaskIsRecurring(e.target.checked)} 
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-orange)', cursor: 'pointer' }}
                  />
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Transformer en tâche récurrente</strong>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      La tâche se renouvelle chaque mois pour ce client.
                    </p>
                  </div>
                </label>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline" onClick={() => { setShowEditTask(false); setEditingTask(null); }}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Edit size={14} />
                  <span>Enregistrer les modifications</span>
                </button>
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
