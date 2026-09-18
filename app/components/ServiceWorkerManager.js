'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';

/**
 * ServiceWorkerManager
 * Composant de gestion sécurisée des mises à jour du Service Worker (PWA).
 * RÈGLE D'OR : Ne force JAMAIS de rechargement brutal automatique de la page
 * pour ne jamais interrompre une saisie de formulaire ou un chronomètre en cours.
 */
export default function ServiceWorkerManager() {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [showUpdateToast, setShowUpdateToast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // 1. Enregistrement du Service Worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Vérifier si un SW est déjà en attente d'activation
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdateToast(true);
        }

        // Détecter si un nouveau SW termine son installation
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nouveau worker prêt : on propose la mise à jour sans l'imposer
                setWaitingWorker(newWorker);
                setShowUpdateToast(true);
              }
            });
          }
        });
      })
      .catch((err) => {
        console.debug('Service Worker non enregistré:', err);
      });

    // 2. Vérification silencieuse lors du retour sur l'onglet
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then((registration) => {
          if (registration) {
            registration.update().catch(() => {});
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleApplyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowUpdateToast(false);
    // Rechargement contrôlé et consenti par l'utilisateur
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowUpdateToast(false);
  };

  if (!showUpdateToast) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        zIndex: 99999,
        background: 'var(--brand-navy, #1e293b)',
        color: '#ffffff',
        padding: '0.85rem 1.15rem',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        fontSize: '0.85rem',
        maxWidth: '420px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        animation: 'slideUpToast 0.3s ease-out'
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(234, 88, 12, 0.2)',
          color: 'var(--brand-orange, #ea580c)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <Sparkles size={16} />
      </div>

      <div style={{ flex: 1, lineHeight: '1.3' }}>
        <div style={{ fontWeight: 600, color: '#f8fafc' }}>Mise à jour disponible</div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Une nouvelle version est prête.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={handleApplyUpdate}
          style={{
            background: 'var(--brand-orange, #ea580c)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '0.35rem 0.65rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            transition: 'background 0.2s'
          }}
        >
          <RefreshCw size={12} /> Actualiser
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          title="Plus tard"
          style={{
            background: 'transparent',
            color: '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            padding: '0.35rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
