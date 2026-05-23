// Auto-versioning: changes every time the file is updated (GitHub Actions will modify this)
const CACHE_VERSION = '2026-05-23';
const CACHE_NAME = `luckyai-${CACHE_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/lotto-history.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install: cache all assets
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for HTML/JS, cache-fallback for offline
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip caching for API calls and Netlify functions
  if (url.pathname.startsWith('/.netlify/') ||
      url.hostname !== location.hostname ||
      url.pathname.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Network-first: always try to get latest, fallback to cache
  e.respondWith(
    fetch(e.request).then(response => {
      if (response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(e.request).then(cached => {
        return cached || caches.match('./index.html');
      });
    })
  );
});
