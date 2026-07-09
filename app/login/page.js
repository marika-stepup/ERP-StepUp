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
    <div className="card">
      <div className="logo-container">
        <span className="logo">ERP.Congés</span>
      </div>
      
      <h1>Connexion Espace Interne</h1>
      <p>Connectez-vous avec vos identifiants Supabase pour accéder au module de gestion des congés.</p>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">Connexion réussie ! Redirection vers le dashboard...</div>}

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="email">Adresse Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="collaborateur@entreprise.com"
            disabled={loading || success}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Mot de passe</label>
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

        <button type="submit" disabled={loading || success}>
          {loading ? 'Connexion en cours...' : 'Se connecter'}
        </button>
      </form>

      <div className="footer">
        Accès restreint au personnel autorisé. Sécurisé par Supabase RBAC.
      </div>
    </div>
  );
}
