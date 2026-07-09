'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient';

export default function Page() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  
  // Navigation
  const [activeTab, setActiveTab] = useState('mySpace'); // 'mySpace', 'globalDashboard', 'adminRH'

  // Simulating/switching accounts list (matching Supabase test accounts)
  const [sessionEmail, setSessionEmail] = useState('');

  // Business Data States
  const [balance, setBalance] = useState({ 
    initial_balance: 0, taken_days: 0, remaining_balance: 0,
    initial_perm: 0, taken_perm: 0, remaining_perm: 0 
  });
  const [myRequests, setMyRequests] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]); // for global planning

  // Form States (Submit Leave)
  const [leaveType, setLeaveType] = useState('CP'); // 'CP' or 'Perm'
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('17:00');
  const [daysRequested, setDaysRequested] = useState('');
  const [reason, setReason] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form States (Add Member)
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('employee');
  const [newMemberManager, setNewMemberManager] = useState('Aucun');
  const [newMemberCP, setNewMemberCP] = useState('25');
  const [newMemberPerm, setNewMemberPerm] = useState('5');
  const [memberError, setMemberError] = useState(null);
  const [memberSuccess, setMemberSuccess] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);

  // Adjustments & HR Actions
  const [hrComments, setHrComments] = useState({});
  const [hrError, setHrError] = useState(null);
  const [hrSuccess, setHrSuccess] = useState(null);
  const [adjustingId, setAdjustingId] = useState(null);

  // 1. Initial Session Check
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
          setUser(session.user);
          setToken(session.access_token);
          setSessionEmail(session.user.email);
        } else {
          window.location.href = '/login';
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        setToken(session.access_token);
        setSessionEmail(session.user.email);
      } else {
        window.location.href = '/login';
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const userRole = user?.app_metadata?.role || user?.user_metadata?.role || 'employee';

  // 2. Fetch all required data dynamically based on active tab and role
  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      // 2a. Fetch personal balance
      const balanceRes = await fetch('/api/leaves/balance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalance(balanceData);
      }

      // 2b. Fetch personal requests
      const myRequestsRes = await fetch('/api/leaves/my-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (myRequestsRes.ok) {
        const myRequestsData = await myRequestsRes.json();
        setMyRequests(myRequestsData.requests || []);
      }

      // 2c. Fetch admin/global data if HR
      if (userRole === 'hr') {
        // Members list
        const membersRes = await fetch('/api/admin/members', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setAllMembers(membersData.members || []);
        }

        // Pending requests
        const pendingRes = await fetch('/api/leaves/pending', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          setPendingRequests(pendingData.requests || []);
        }

        // Get all requests for global planning (simulated from reading history or API)
        // For planning, we merge pending + approved requests
        const sheetRes = await fetch('/api/admin/members', { // dummy fetch to reload, we can read raw requests if we have an endpoint
          headers: { Authorization: `Bearer ${token}` }
        });
        // We will mock/render the planning based on the members and pending requests for now
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchDashboardData();
    }
  }, [user, token, userRole]);

  // 3. Switch User Session (for prototype testing)
  const handleSessionChange = async (e) => {
    const selectedEmail = e.target.value;
    setSessionEmail(selectedEmail);
    setLoading(true);

    let password = '';
    if (selectedEmail === 'employee@entreprise.com') {
      password = 'passEmployee123';
    } else if (selectedEmail === 'hr@entreprise.com') {
      password = 'passHR123';
    }

    try {
      if (password) {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: selectedEmail,
          password: password
        });
        if (error) {
          alert('Erreur lors du changement de session: ' + error.message);
        } else {
          // Force active tab to Mon Espace upon switching
          setActiveTab('mySpace');
        }
      } else {
        // Log out if they select something else
        await supabaseClient.auth.signOut();
        window.location.href = '/login';
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 4. Submit Leave Request
  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);
    setSubmitting(true);

    try {
      const res = await fetch('/api/leaves/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          leave_type: leaveType,
          reason: reason,
          // Custom field: hours/days can be sent if required, but business_days is calculated on server
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Erreur lors de la soumission de la demande.');
      } else {
        setSubmitSuccess(true);
        setStartDate('');
        setEndDate('');
        setDaysRequested('');
        setReason('');
        fetchDashboardData();
      }
    } catch (err) {
      setSubmitError('Une erreur réseau est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Create new member (HR Admin)
  const handleCreateMember = async (e) => {
    e.preventDefault();
    setMemberError(null);
    setMemberSuccess(false);
    setMemberLoading(true);

    try {
      const res = await fetch('/api/admin/create-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newMemberEmail,
          name: newMemberName,
          role: newMemberRole,
          manager_name: newMemberManager,
          initial_balance: parseFloat(newMemberCP || 0),
          initial_perm: parseFloat(newMemberPerm || 0)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setMemberError(data.error || 'Erreur lors de la création du membre.');
      } else {
        setMemberSuccess(true);
        setNewMemberName('');
        setNewMemberEmail('');
        setNewMemberCP('25');
        setNewMemberPerm('5');
        setNewMemberManager('Aucun');
        fetchDashboardData();
      }
    } catch (err) {
      setMemberError('Une erreur réseau est survenue.');
    } finally {
      setMemberLoading(false);
    }
  };

  // 6. Adjust Balance (HR Admin Table)
  const handleAdjustBalance = async (employeeId, type, value) => {
    setAdjustingId(employeeId);
    setHrError(null);
    setHrSuccess(null);

    try {
      const res = await fetch('/api/admin/adjust-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          employee_id: employeeId,
          type,
          value: parseFloat(value || 0)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setHrError(data.error || 'Erreur lors de l\'ajustement du solde.');
      } else {
        setHrSuccess(`Solde mis à jour pour ${data.balance?.employee_name}.`);
        fetchDashboardData();
      }
    } catch (err) {
      setHrError('Une erreur réseau est survenue.');
    } finally {
      setAdjustingId(null);
    }
  };

  // 7. Credit +2.5j CP to all members
  const handleCreditAll = async () => {
    if (!confirm('Voulez-vous vraiment créditer de +2.5j de CP TOUS les collaborateurs du système ?')) return;
    setHrError(null);
    setHrSuccess(null);

    try {
      const res = await fetch('/api/admin/credit-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) {
        setHrError(data.error || 'Erreur lors du crédit global.');
      } else {
        setHrSuccess(data.message);
        fetchDashboardData();
      }
    } catch (err) {
      setHrError('Une erreur réseau est survenue.');
    }
  };

  // 8. Approve/Reject Leave Request
  const handleValidateLeave = async (requestId, action) => {
    setHrError(null);
    setHrSuccess(null);
    const comment = hrComments[requestId] || '';

    try {
      const res = await fetch('/api/leaves/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          request_id: requestId,
          action: action, // 'Approuver' ou 'Refuser'
          hr_comment: comment
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setHrError(data.error || 'Erreur lors de la validation.');
      } else {
        setHrSuccess(`La demande a été ${action === 'Approuver' ? 'approuvée' : 'refusée'} avec succès.`);
        setHrComments(prev => {
          const updated = { ...prev };
          delete updated[requestId];
          return updated;
        });
        fetchDashboardData();
      }
    } catch (err) {
      setHrError('Une erreur réseau est survenue.');
    }
  };

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    sessionStorage.removeItem('supabase_token');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="card" style={{ marginTop: '5rem' }}>
        <span className="logo">CongésApp</span>
        <h1 style={{ marginTop: '1.5rem' }}>Chargement de l'espace de travail...</h1>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* --- TOP HEADER NAVIGATION BAR --- */}
      <header className="app-header">
        <div className="logo-container">
          <span className="logo-icon">📅</span>
          <span className="logo-text">CongésApp</span>
        </div>
        <div className="session-badge">
          <span>Session de :</span>
          <select 
            value={sessionEmail} 
            onChange={handleSessionChange} 
            className="session-select"
          >
            <option value="employee@entreprise.com">Alice Martin (RH/Salarié)</option>
            <option value="hr@entreprise.com">Bob Dupont (HR)</option>
            {user?.email && user.email !== 'employee@entreprise.com' && user.email !== 'hr@entreprise.com' && (
              <option value={user.email}>{user.email} (Connecté)</option>
            )}
            <option value="logout">-- Se Déconnecter --</option>
          </select>
        </div>
      </header>

      <div className="app-container">
        {/* --- TABS SELECTOR --- */}
        <div className="nav-tabs">
          <button 
            className={`tab-button ${activeTab === 'mySpace' ? 'active' : ''}`}
            onClick={() => setActiveTab('mySpace')}
          >
            Mon Espace
          </button>
          <button 
            className={`tab-button ${activeTab === 'globalDashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('globalDashboard')}
          >
            📊 Tableau de Bord Global
          </button>
          {userRole === 'hr' && (
            <button 
              className={`tab-button ${activeTab === 'adminRH' ? 'active' : ''}`}
              onClick={() => setActiveTab('adminRH')}
            >
              💼 Administration RH
            </button>
          )}
        </div>

        {/* ==================================================== */}
        {/* 1. TAB CONTENT: MON ESPACE                          */}
        {/* ==================================================== */}
        {activeTab === 'mySpace' && (
          <div className="split-layout">
            {/* Sidebar with Balance & Request Form */}
            <div className="sidebar">
              <div className="panel">
                <h2 className="panel-title">📋 Mes Soldes Restants</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="balance-card-mini cp">
                    <span className="balance-card-title">Congés Payés</span>
                    <span className="balance-card-value">
                      {balance.remaining_balance} <span>jours</span>
                    </span>
                  </div>
                  <div className="balance-card-mini perm">
                    <span className="balance-card-title">Permissions</span>
                    <span className="balance-card-value">
                      {balance.remaining_perm || 5} <span>jours</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="panel">
                <h2 className="panel-title">➕ Déposer une demande</h2>
                
                {submitError && <div className="error-message">{submitError}</div>}
                {submitSuccess && <div className="success-message">Votre demande a été soumise.</div>}

                <form onSubmit={handleSubmitLeave} style={{ padding: 0, border: 'none', background: 'none' }}>
                  <div className="form-group">
                    <label>Type de congé</label>
                    <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                      <option value="CP">Congé Payé</option>
                      <option value="RTT">RTT</option>
                      <option value="Maladie">Congé Maladie</option>
                      <option value="Permission">Permission Spéciale</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date Début</label>
                      <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Heure Début</label>
                      <input 
                        type="time" 
                        value={startTime} 
                        onChange={(e) => setStartTime(e.target.value)} 
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date Fin</label>
                      <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Heure Fin</label>
                      <input 
                        type="time" 
                        value={endTime} 
                        onChange={(e) => setEndTime(e.target.value)} 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Nombre de jours déduits (facultatif)</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 1 ou 2.5" 
                      step="0.5"
                      value={daysRequested}
                      onChange={(e) => setDaysRequested(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Motif / Justification</label>
                    <textarea 
                      placeholder="Raison..." 
                      value={reason} 
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn-accent" disabled={submitting}>
                    {submitting ? 'Envoi...' : 'Soumettre la demande'}
                  </button>
                </form>
              </div>
            </div>

            {/* Main Content with request history */}
            <div className="main-content">
              <div className="panel">
                <h2 className="panel-title">🕒 Suivi de mes demandes</h2>
                
                {myRequests.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                    Aucune demande enregistrée.
                  </p>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Dates</th>
                          <th>Durée</th>
                          <th>Statut</th>
                          <th>Commentaire RH</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myRequests.map((req) => (
                          <tr key={req.request_id}>
                            <td>
                              <strong style={{ color: 'var(--accent-color)' }}>{req.leave_type}</strong>
                            </td>
                            <td>
                              Du {req.start_date}<br />
                              Au {req.end_date}
                            </td>
                            <td><strong>{req.business_days} j</strong></td>
                            <td>
                              <span className={`status-badge ${
                                req.status === 'Pending' ? 'status-pending' :
                                req.status === 'Approved' ? 'status-approved' : 'status-rejected'
                              }`}>
                                {req.status === 'Pending' ? 'En attente' :
                                 req.status === 'Approved' ? 'Approuvé' : 'Refusé'}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              {req.hr_comment || '-'}
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

        {/* ==================================================== */}
        {/* 2. TAB CONTENT: GLOBAL DASHBOARD                     */}
        {/* ==================================================== */}
        {activeTab === 'globalDashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* KPIs grids */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <span className="kpi-val">{allMembers.length || 2}</span>
                <span className="kpi-lbl">Total Collaborateurs</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-val">
                  {allMembers.reduce((sum, m) => sum + parseFloat(m.remaining_balance || 0), 0).toFixed(1)}j
                </span>
                <span className="kpi-lbl">Soldes CP Cumulés</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-val">0</span>
                <span className="kpi-lbl">Salariés Absents ce jour</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-val">{pendingRequests.length}</span>
                <span className="kpi-lbl">Demandes en attente</span>
              </div>
            </div>

            {/* Soldes Globaux Table */}
            <div className="panel">
              <h2 className="panel-title">📊 Soldes Globaux & Responsables (N+1)</h2>
              <p className="panel-subtitle">Visualisation en temps réel des congés restants et de l'organigramme.</p>

              {allMembers.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Activez la session RH pour afficher la liste des collaborateurs.
                </p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Membre</th>
                        <th>N+1 (Manager)</th>
                        <th>Solde CP Restant</th>
                        <th>Solde Perm. Restant</th>
                        <th>Statut Général</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allMembers.map((m) => (
                        <tr key={m.employee_id}>
                          <td>
                            <strong>{m.employee_name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.employee_email}</div>
                          </td>
                          <td>{m.manager_name || 'Aucun'}</td>
                          <td><strong style={{ color: 'var(--accent-color)' }}>{m.remaining_balance}j</strong> / {m.initial_balance}j</td>
                          <td><strong>{m.remaining_perm || 5}j</strong> / {m.initial_perm || 5}j</td>
                          <td>
                            <span className="status-badge status-approved" style={{ fontSize: '0.7rem' }}>
                              Actif
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Planning Simplifié */}
            <div className="panel">
              <h2 className="panel-title">📅 Planning des congés & Absences</h2>
              <p className="panel-subtitle">Visualisation chronologique des départs.</p>
              <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '12px', border: '1px dashed var(--border-light)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Aucune absence planifiée pour les 30 prochains jours.
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 3. TAB CONTENT: ADMINISTRATION RH                    */}
        {/* ==================================================== */}
        {activeTab === 'adminRH' && userRole === 'hr' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Header Actions Alerts */}
            {hrError && <div className="error-message">{hrError}</div>}
            {hrSuccess && <div className="success-message">{hrSuccess}</div>}

            {/* Validation Panel */}
            <div className="panel" style={{ borderTop: '4px solid var(--accent-color)' }}>
              <h2 className="panel-title">🛡️ Suivi et Validation Finale RH</h2>
              <p className="panel-subtitle">Valider ou refuser les demandes de congé de l'entreprise.</p>

              {pendingRequests.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>
                  Aucune demande en attente de traitement RH.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {pendingRequests.map((req) => (
                    <div key={req.request_id} className="validation-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <strong style={{ fontSize: '1.1rem' }}>{req.employee_name}</strong>
                          <span className="badge-role employee" style={{ marginLeft: '0.5rem' }}>Salarié</span>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Type: <strong>{req.leave_type}</strong> | Jours demandés: <strong>{req.business_days} j</strong>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>Période de congé :</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Du {req.start_date} au {req.end_date}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Commentaire de validation..."
                          style={{ flexGrow: 1 }}
                          value={hrComments[req.request_id] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHrComments(prev => ({ ...prev, [req.request_id]: val }));
                          }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn-small btn-approve"
                            onClick={() => handleValidateLeave(req.request_id, 'Approuver')}
                          >
                            Accepter
                          </button>
                          <button
                            className="btn-small btn-reject"
                            onClick={() => handleValidateLeave(req.request_id, 'Refuser')}
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Split creation form & adjustment table */}
            <div className="split-layout">
              {/* Add user form */}
              <div className="sidebar" style={{ width: '350px' }}>
                <div className="panel">
                  <h2 className="panel-title">👤 Ajouter un Membre</h2>
                  
                  {memberError && <div className="error-message">{memberError}</div>}
                  {memberSuccess && <div className="success-message">Compte enregistré dans le Google Sheet !</div>}

                  <form onSubmit={handleCreateMember} style={{ padding: 0, border: 'none', background: 'none' }}>
                    <div className="form-group">
                      <label>Nom Complet</label>
                      <input
                        type="text"
                        placeholder="Ex: Jean Dupont"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        required
                        disabled={memberLoading}
                      />
                    </div>

                    <div className="form-group">
                      <label>Adresse Email</label>
                      <input
                        type="email"
                        placeholder="jean.dupont@entreprise.com"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        required
                        disabled={memberLoading}
                      />
                    </div>

                    <div className="form-group">
                      <label>Rôle dans le système</label>
                      <select value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)}>
                        <option value="employee">Collaborateur</option>
                        <option value="hr">Administrateur RH</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Responsable Hiérarchique N+1</label>
                      <select value={newMemberManager} onChange={(e) => setNewMemberManager(e.target.value)}>
                        <option value="Aucun">Aucun (Directeur / RH)</option>
                        {allMembers.map(m => (
                          <option key={m.employee_id} value={m.employee_name}>{m.employee_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Solde Initial CP</label>
                        <input
                          type="number"
                          value={newMemberCP}
                          onChange={(e) => setNewMemberCP(e.target.value)}
                          disabled={memberLoading}
                        />
                      </div>
                      <div className="form-group">
                        <label>Solde Initial Perm.</label>
                        <input
                          type="number"
                          value={newMemberPerm}
                          onChange={(e) => setNewMemberPerm(e.target.value)}
                          disabled={memberLoading}
                        />
                      </div>
                    </div>

                    <button type="submit" className="btn-accent" disabled={memberLoading}>
                      {memberLoading ? 'Enregistrement...' : 'Enregistrer le compte'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Adjust balances table */}
              <div className="main-content">
                <div className="panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 className="panel-title" style={{ marginBottom: 0 }}>⚙️ Configuration des équipes & Droits</h2>
                    <button 
                      onClick={handleCreditAll} 
                      className="btn-secondary btn-small"
                      style={{ color: '#7c3aed', borderColor: '#e9d5ff', background: '#f5f3ff' }}
                    >
                      📅 Créditer +2.5j CP (Début de mois)
                    </button>
                  </div>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Membre</th>
                          <th>Rôle</th>
                          <th>N+1 (Manager)</th>
                          <th>Ajuster CP</th>
                          <th>Ajuster Perm.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allMembers.map((m) => (
                          <tr key={m.employee_id}>
                            <td>
                              <strong>{m.employee_name}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.employee_email}</div>
                            </td>
                            <td>
                              <span className={`badge-role ${m.employee_email.includes('hr@') ? 'hr' : 'employee'}`}>
                                {m.employee_email.includes('hr@') ? 'HR' : 'Salarié'}
                              </span>
                            </td>
                            <td>{m.manager_name || 'Aucun'}</td>
                            <td>
                              <input
                                type="number"
                                className="adjust-input"
                                defaultValue={m.initial_balance}
                                onBlur={(e) => handleAdjustBalance(m.employee_id, 'cp', e.target.value)}
                                disabled={adjustingId === m.employee_id}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="adjust-input"
                                defaultValue={m.initial_perm || 5}
                                onBlur={(e) => handleAdjustBalance(m.employee_id, 'perm', e.target.value)}
                                disabled={adjustingId === m.employee_id}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Global Footer Controls */}
        <div style={{ marginTop: '2rem', textAlign: 'center', width: '100%' }}>
          <button 
            onClick={handleLogout} 
            className="btn-secondary"
            style={{ width: '200px', display: 'inline-flex' }}
          >
            Se déconnecter de la session
          </button>
        </div>
      </div>
    </div>
  );
}
