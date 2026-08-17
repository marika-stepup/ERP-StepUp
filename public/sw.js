self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // simple pass-through network-first service worker to satisfy PWA criteria
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
