'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient';

export default function Page() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
          setUser(session.user);
        } else {
          // Redirect to login if not logged in
          window.location.href = '/login';
        }
      } catch (err) {
        console.error('Auth verification error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        window.location.href = '/login';
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

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

  const userRole = user?.app_metadata?.role || user?.user_metadata?.role || 'employee';

  return (
    <div className="card">
      <div className="logo-container">
        <span className="logo">ERP.Congés</span>
      </div>
      
      <h1>Espace Personnel</h1>
      <p>Bienvenue sur votre tableau de bord de gestion des congés.</p>

      <div className="routes-list" style={{ marginBottom: '1.5rem' }}>
        <div className="routes-title">Session Active</div>
        <div className="route-item">
          <span style={{ color: 'var(--text-secondary)' }}>Utilisateur :</span>
          <span style={{ fontWeight: '600' }}>{user?.email}</span>
        </div>
        <div className="route-item">
          <span style={{ color: 'var(--text-secondary)' }}>Rôle RBAC :</span>
          <span className="route-method" style={{
            background: userRole === 'hr' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.15)',
            color: userRole === 'hr' ? '#c084fc' : '#818cf8',
            border: userRole === 'hr' ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '6px',
            padding: '0.25rem 0.6rem',
            fontSize: '0.75rem',
            fontWeight: '700'
          }}>
            {userRole.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="routes-list">
        <div className="routes-title">Endpoints d'API Accessibles</div>
        
        <div className="route-item">
          <span className="route-path">/api/leaves/submit</span>
          <span className="route-method method-post">POST</span>
        </div>

        <div className="route-item">
          <span className="route-path">/api/leaves/pending</span>
          <span className="route-method method-get">GET</span>
        </div>

        <div className="route-item">
          <span className="route-path">/api/leaves/validate</span>
          <span className="route-method method-post">POST</span>
        </div>
      </div>

      <button onClick={handleLogout} style={{
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'var(--text-primary)',
        boxShadow: 'none',
        border: '1px solid var(--border-color)',
        marginTop: '0rem',
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
