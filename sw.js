/* ŻPA Żyrardów PWA Service Worker - v6 CLEAN - outdated pins removed */
const CACHE_NAME = 'zpa-v6-2026-08-08-clean';
const SHELL_ASSETS = [
  './',
  '/',
  './index.html',
  '/index.html',
  './manifest.json',
  './timetables.json',
  './stops_gps.json',
  './stops_gps.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/icon-180.png'
];

// Install - precache shell
self.addEventListener('install', (event) => {
  console.log('[SW] Install', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch(err => {
        console.warn('[SW] Precache failed, continuing', err);
        // fallback: cache at least index + json
        return cache.addAll(['./index.html', './timetables.json', './manifest.json']);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch strategies
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET and chrome extensions
  if (req.method !== 'GET') return;
  if (url.protocol.startsWith('chrome-extension')) return;

  // Strategy for timetables.json: NETWORK FIRST with cache fallback + update cache
  if (url.pathname.endsWith('timetables.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          return caches.match(req).then(cached => cached || caches.match('./timetables.json'));
        })
    );
    return;
  }

  // For CDN tailwind and fonts: STALE-WHILE-REVALIDATE
  if (url.hostname.includes('cdn.tailwindcss.com') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('unpkg.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(req).then(cached => {
          const network = fetch(req).then(res => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // For shell (index, manifest, icons): CACHE FIRST, then network
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // update in background
        fetch(req).then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(req, res));
        }).catch(()=>{});
        return cached;
      }
      return fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => {
        // offline fallback for navigation - try multiple cache keys
        if (req.mode === 'navigate') {
          return caches.match('./index.html')
            .then(r => r || caches.match('/index.html'))
            .then(r => r || caches.match('./'))
            .then(r => r || caches.match('/'));
        }
      });
    })
  );
});

// Optional: background sync for future
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
