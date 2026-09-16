// Service Worker avec politique de mise à jour immédiate et forcée (Sécurité RH / PWA)

// 1. Phase d'installation : prise en charge immédiate sans file d'attente (skipWaiting)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. Phase d'activation : prise de contrôle immédiate de tous les clients / onglets ouverts
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
    })()
  );
});

// 3. Écoute de messages pour forcer le skipWaiting si sollicité depuis le client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 4. Stratégie réseau en priorité (Network-first)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
