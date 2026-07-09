'use client';

import { useState } from 'react';
import { supabaseClient } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { data, error: authError } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Identifiants de connexion invalides. Veuillez réessayer.'
          : authError.message
        );
      } else {
        setSuccess(true);
        // Save token in session storage for debug or API test calls
        const token = data.session?.access_token;
        if (token) {
          sessionStorage.setItem('supabase_token', token);
        }
        // Redirect to dashboard after a brief delay
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Une erreur inattendue est survenue lors de la connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <img
          src="/Logo Step Up.png"
          alt="Step Up Logo"
          className="login-logo-img"
        />

        <h1>Step Hub</h1>
        <p>Portail interne de l'agence. Connectez-vous pour accéder à votre espace de gestion des congés.</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Connexion réussie ! Redirection...</div>}

        <form onSubmit={handleLogin} style={{ border: 'none', background: 'none', padding: 0 }}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="email" style={{ textAlign: 'left', marginBottom: '0.4rem' }}>Adresse Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="votre@mail.pro"
              disabled={loading || success}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label htmlFor="password" style={{ textAlign: 'left', marginBottom: '0.4rem' }}>Mot de passe</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              disabled={loading || success}
            />
          </div>

          <button type="submit" style={{ width: '100%' }} disabled={loading || success}>
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <div className="footer" style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Accès restreint aux collaborateurs autorisés de l'agence Step Up.
        </div>
      </div>
    </div>
  );
}
