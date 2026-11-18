// Boatek Labs — Service Worker
// Cache-first strategy for core shell assets, network-first fallback for everything else.

const CACHE_NAME = 'boatek-labs-v5';
const CORE_ASSETS = [
  '/index.html',
  '/work.html',
  '/games.html',
  '/software.html',
  '/team.html',
  '/journal.html',
  '/journal-post.html',
  '/project.html',
  '/contact.html',
  '/start-a-project.html',
  '/join-the-team.html',
  '/collaborate.html',
  '/general-inquiry.html',
  '/portal.html',
  '/privacy.html',
  '/css/style.css',
  '/js/main.js',
  '/manifest.json',
  '/assets/logo.jpg',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];
// Note: the /admin dashboard is intentionally NOT precached here. It's an
// internal tool, not a public offline-first experience, and it should always
// fetch fresh (auth state, submissions, config) rather than risk serving a
// stale cached copy.

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
