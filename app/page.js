'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient';

export default function Page() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');

  // Business Data States
  const [balance, setBalance] = useState({ initial_balance: 0, taken_days: 0, remaining_balance: 0 });
  const [myRequests, setMyRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  // Form States (Submit Leave)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('CP');
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // HR Action States
  const [hrComments, setHrComments] = useState({}); // key: request_id, value: comment
  const [hrError, setHrError] = useState(null);
  const [hrSuccess, setHrSuccess] = useState(null);

  // 1. Authenticate and retrieve token on mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
          setUser(session.user);
          setToken(session.access_token);
          // Store token locally for debug
          sessionStorage.setItem('supabase_token', session.access_token);
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
      } else {
        window.location.href = '/login';
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // 2. Fetch Business Data when user & token are loaded
  const userRole = user?.app_metadata?.role || user?.user_metadata?.role || 'employee';

  const fetchData = async () => {
    if (!token) return;
    try {
      // All roles fetch their balance
      const balanceRes = await fetch('/api/leaves/balance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalance(balanceData);
      }

      if (userRole === 'hr') {
        // HR fetches all pending requests
        const pendingRes = await fetch('/api/leaves/pending', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          setPendingRequests(pendingData.requests || []);
        }
      } else {
        // Employees fetch their own history
        const myRequestsRes = await fetch('/api/leaves/my-requests', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (myRequestsRes.ok) {
          const myRequestsData = await myRequestsRes.json();
          setMyRequests(myRequestsData.requests || []);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchData();
    }
  }, [user, token, userRole]);

  // 3. Handle Leave Submission
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
          leave_type: leaveType
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Erreur lors de la soumission de la demande.');
      } else {
        setSubmitSuccess(true);
        setStartDate('');
        setEndDate('');
        // Refresh local data (balance and request list)
        fetchData();
      }
    } catch (err) {
      setSubmitError('Une erreur réseau est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Handle HR Validation (Approve or Reject)
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
          action: action, // 'Approuver' or 'Refuser'
          hr_comment: comment
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setHrError(data.error || 'Erreur lors de la validation de la demande.');
      } else {
        setHrSuccess(`Demande ${action === 'Approuver' ? 'approuvée' : 'refusée'} avec succès.`);
        // Clear comment for this row
        setHrComments(prev => {
          const updated = { ...prev };
          delete updated[requestId];
          return updated;
        });
        // Refresh dashboard data
        fetchData();
      }
    } catch (err) {
      setHrError('Une erreur réseau est survenue lors de la validation.');
    }
  };

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    sessionStorage.removeItem('supabase_token');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="card">
        <span className="logo">ERP.Congés</span>
        <h1 style={{ marginTop: '1.5rem' }}>Chargement...</h1>
        <div className="status-badge" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#9ca3af', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="status-dot" style={{ backgroundColor: '#9ca3af', boxShadow: 'none' }}></div>
          <span>Vérification de session</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="logo-container">
        <span className="logo">ERP.Congés</span>
      </div>

      <h1>Espace Personnel</h1>
      <p style={{ marginBottom: '1.5rem' }}>Bienvenue sur votre tableau de bord de gestion des congés.</p>

      {/* --- Section : User Info Header --- */}
      <div className="routes-list" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>Utilisateur connecté</span>
            <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>{user?.email}</div>
          </div>
          <div>
            <span className="route-method" style={{
              background: userRole === 'hr' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              color: userRole === 'hr' ? '#c084fc' : '#818cf8',
              border: userRole === 'hr' ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '6px',
              padding: '0.3rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: '700'
            }}>
              RÔLE : {userRole.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* --- Section : Leave Balance Grid --- */}
      <div className="balance-grid">
        <div className="balance-card initial">
          <span className="balance-value">{balance.initial_balance}</span>
          <span className="balance-label">Solde Initial</span>
        </div>
        <div className="balance-card taken">
          <span className="balance-value">{balance.taken_days}</span>
          <span className="balance-label">Jours Pris</span>
        </div>
        <div className="balance-card remaining">
          <span className="balance-value">{balance.remaining_balance}</span>
          <span className="balance-label">Solde Restant</span>
        </div>
      </div>

      {/* --- ROLE : EMPLOYEE DASHBOARD --- */}
      {userRole !== 'hr' && (
        <>
          {/* Form Section */}
          <div className="dashboard-section">
            <h2 className="section-title">Soumettre une Demande</h2>
            
            {submitError && <div className="error-message">{submitError}</div>}
            {submitSuccess && <div className="success-message">Votre demande a été soumise avec succès et est en attente de validation.</div>}

            <form onSubmit={handleSubmitLeave}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="startDate">Date de Début</label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="endDate">Date de Fin (inclus)</label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="leaveType">Type de congé</label>
                <select
                  id="leaveType"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  disabled={submitting}
                >
                  <option value="CP">Congé Payé (CP)</option>
                  <option value="RTT">Réduction du Temps de Travail (RTT)</option>
                  <option value="Maladie">Congé Maladie</option>
                  <option value="SansSolde">Congé Sans Solde</option>
                </select>
              </div>

              <button type="submit" disabled={submitting}>
                {submitting ? 'Traitement en cours...' : 'Déposer la demande'}
              </button>
            </form>
          </div>

          {/* History Section */}
          <div className="dashboard-section">
            <h2 className="section-title">Historique de vos Demandes</h2>
            {myRequests.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
                Aucune demande déposée pour le moment.
              </p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Dates</th>
                      <th>Durée</th>
                      <th>Type</th>
                      <th>Statut</th>
                      <th>Commentaire RH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myRequests.map((req) => (
                      <tr key={req.request_id}>
                        <td>
                          Du <strong>{req.start_date}</strong><br />
                          Au <strong>{req.end_date}</strong>
                        </td>
                        <td>{req.business_days} jours ouvrés</td>
                        <td><span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{req.leave_type}</span></td>
                        <td>
                          <span className={`status-badge ${
                            req.status === 'Pending' ? 'status-pending' :
                            req.status === 'Approved' ? 'status-approved' : 'status-rejected'
                          }`}>
                            {req.status === 'Pending' ? 'En attente' :
                             req.status === 'Approved' ? 'Approuvé' : 'Refusé'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {req.hr_comment || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* --- ROLE : HR DASHBOARD --- */}
      {userRole === 'hr' && (
        <div className="dashboard-section">
          <h2 className="section-title">Demandes en Attente de Validation</h2>
          
          {hrError && <div className="error-message">{hrError}</div>}
          {hrSuccess && <div className="success-message">{hrSuccess}</div>}

          {pendingRequests.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1.5rem' }}>
              Aucune demande en attente. Bon travail ! 🎉
            </p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Dates</th>
                    <th>Jours</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((req) => (
                    <tr key={req.request_id}>
                      <td>
                        <strong>{req.employee_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Type: {req.leave_type}</div>
                      </td>
                      <td>
                        Du {req.start_date}<br />
                        Au {req.end_date}
                      </td>
                      <td><strong>{req.business_days} j</strong></td>
                      <td>
                        <div className="hr-actions-container">
                          <input
                            type="text"
                            placeholder="Commentaire optionnel..."
                            className="hr-comment-input"
                            value={hrComments[req.request_id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setHrComments(prev => ({ ...prev, [req.request_id]: val }));
                            }}
                          />
                          <div className="hr-buttons">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Logout Button */}
      <button onClick={handleLogout} style={{
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'var(--text-primary)',
        boxShadow: 'none',
        border: '1px solid var(--border-color)',
        marginTop: '1.5rem',
        padding: '0.8rem',
        width: '100%'
      }}>
        Se déconnecter
      </button>

      <div className="footer" style={{ marginTop: '1.5rem' }}>
        © {new Date().getFullYear()} - MVP ERP 50 Collaborateurs. Propriété Interne.
      </div>
    </div>
  );
}
