// Service Worker PWA avec stratégie sécurisée Network-First (Zéro perte de données)

// 1. Phase d'installation : attend d'être sollicité pour basculer en production active
self.addEventListener('install', (event) => {
  // Prêt pour l'activation sans forcer un remplacement brutal des sessions en cours
});

// 2. Phase d'activation : nettoyage des anciens caches si nécessaire
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Nettoie les caches obsolètes
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys.map((key) => {
          if (key !== 'stepup-rh-cache-v1') {
            return caches.delete(key);
          }
        })
      );
    })()
  );
});

// 3. Écoute de messages pour déclencher le skipWaiting de manière contrôlée
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 4. Stratégie réseau en priorité absolue (Network-first)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Ne pas cacher les appels API Supabase ou internes
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
