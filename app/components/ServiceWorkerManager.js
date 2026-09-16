'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerManager
 * Composant global chargé de l'enregistrement et de l'application immédiate
 * des mises à jour du Service Worker sans intervention de l'utilisateur.
 */
export default function ServiceWorkerManager() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let refreshing = false;

    // 1. Écouteur sur controllerchange : dès qu'un nouveau SW prend le contrôle,
    // on recharge immédiatement la page pour forcer l'exécution de la nouvelle version.
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // 2. Enregistrement du Service Worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Déclenche une vérification immédiate de mise à jour au montage
        registration.update().catch((err) => {
          console.debug('Vérification de mise à jour du SW:', err);
        });

        // Si un SW est déjà en attente, lui demander de s'installer directement
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Détecter si un nouveau SW commence à s'installer
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nouveau Service Worker disponible et installé -> activation forcée
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch((err) => {
        console.error('Échec de l\'enregistrement du Service Worker:', err);
      });

    // 3. Vérification des mises à jour dès que l'application redevient visible (changement d'onglet / réouverture)
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
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
