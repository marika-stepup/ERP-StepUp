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
  Globe,
  Mail,
  BookOpen
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

  // Edit Client States
  const [showEditClient, setShowEditClient] = useState(false);
  const [editClientInput, setEditClientInput] = useState('');
  const [editClientPeriod, setEditClientPeriod] = useState('');
  const [editClientBudget, setEditClientBudget] = useState('20');
  const [editClientStartDate, setEditClientStartDate] = useState('');
  const [editClientEndDate, setEditClientEndDate] = useState('');
  const [editClientFB, setEditClientFB] = useState('0');
  const [editClientIG, setEditClientIG] = useState('0');
  const [editClientLI, setEditClientLI] = useState('0');
  const [editClientGP, setEditClientGP] = useState('0');
  const [editClientNL, setEditClientNL] = useState('0');
  const [editClientBlog, setEditClientBlog] = useState('0');
  const [editClientUnquantifiable, setEditClientUnquantifiable] = useState('');

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
    setEditClientFB(String(client.posts_facebook || 0));
    setEditClientIG(String(client.posts_instagram || 0));
    setEditClientLI(String(client.posts_linkedin || 0));
    setEditClientGP(String(client.posts_google || 0));
    setEditClientNL(String(client.newsletter_count || 0));
    setEditClientBlog(String(client.blog_count || 0));
    setEditClientUnquantifiable(client.unquantifiable_tasks || '');
    setShowEditClient(true);
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    if (!editClientInput || !editClientPeriod || !selectedClient) return;

    let code = '';
    let name = editClientInput.trim();

    // Try to match prefix code like "SD-000 - STEP UP" or "SD-000 STEP UP"
    const match = editClientInput.match(/^([a-zA-Z0-9]+-\d+)\s*[-:]?\s*(.*)$/) || editClientInput.match(/^([a-zA-Z0-9]+)\s*[-:]\s*(.*)$/);
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
          posts_facebook: parseInt(editClientFB) || 0,
          posts_instagram: parseInt(editClientIG) || 0,
          posts_linkedin: parseInt(editClientLI) || 0,
          posts_google: parseInt(editClientGP) || 0,
          newsletter_count: parseInt(editClientNL) || 0,
          blog_count: parseInt(editClientBlog) || 0,
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
      }
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    showConfirm(
      "Supprimer la tâche",
      "Voulez-vous vraiment supprimer cette tâche ? Tous les logs associés seront supprimés.",
      async () => {
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
      }
    );
  };

  // Actions: Manual Entry
  const handleAddManualLog = async (e) => {
    e.preventDefault();
    if (!manualTaskId || !manualMemberId || !token) return;

    const totalSeconds = (parseInt(manualHours) || 0) * 3600 + (parseInt(manualMinutes) || 0) * 60;
    if (totalSeconds <= 0) {
      showAlert('Durée non valide', 'Veuillez spécifier une durée valide.');
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
        showAlert('Erreur', errData.error || 'Erreur lors de la création du log manuel.');
      }
    } catch (err) {
      console.error('Error adding manual log:', err);
    }
  };

  const handleDeleteLog = async (logId) => {
    showConfirm(
      "Supprimer l'enregistrement",
      "Voulez-vous vraiment supprimer cet enregistrement de temps ?",
      async () => {
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

  return (
    <div className="espace-production">
      {/* HEADER CONTROLS */}
      <div className="prod-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 className="prod-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={24} style={{ color: 'var(--brand-orange)' }} />
                Gestion Client :
              </h1>
              <button 
                className="btn btn-outline" 
                onClick={() => setShowAddClient(true)}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', height: 'fit-content' }}
              >
                <Plus size={14} /> Nouveau Client
              </button>
            </div>
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
              
              <button 
                className="btn btn-outline btn-sm" 
                onClick={() => handleStartEditClient(selectedClient)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                <Edit size={14} /> Modifier le contrat
              </button>
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
          
          {/* MIDDLE SECTION: LIVRABLES / TÂCHES (Full Width) */}
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
            <p className="panel-subtitle">Administrez et mettez à jour les tâches du client.</p>

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
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* TEMPS TOTAL PAR COLLABORATEUR (Full Width) */}
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

          {/* BOTTOM SECTION: HISTORIQUE DES ENREGISTREMENTS (Full Width) */}
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

              <div style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                <h3 className="form-sub-title" style={{ fontSize: '0.95rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem', color: 'var(--brand-orange)' }}>Délivrables par mois</h3>
                <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', marginTop: '0.5rem' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Facebook Posts</label>
                    <input type="number" min="0" value={editClientFB} onChange={(e) => setEditClientFB(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Instagram Posts</label>
                    <input type="number" min="0" value={editClientIG} onChange={(e) => setEditClientIG(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>LinkedIn Posts</label>
                    <input type="number" min="0" value={editClientLI} onChange={(e) => setEditClientLI(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Google Posts</label>
                    <input type="number" min="0" value={editClientGP} onChange={(e) => setEditClientGP(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Newsletters</label>
                    <input type="number" min="0" value={editClientNL} onChange={(e) => setEditClientNL(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem' }}>Billets Blog</label>
                    <input type="number" min="0" value={editClientBlog} onChange={(e) => setEditClientBlog(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label>Tâches inquantifiables (ex: modération, rédaction web...)</label>
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
