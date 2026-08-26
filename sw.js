// Minimal offline-cache service worker for the Bloomer PWA shell.
const CACHE = 'bloomer-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/styles.css',
  './js/app.js',
  './js/chord-theory.js',
  './js/chord-state.js',
  './js/voicing.js',
  './js/performance-modes.js',
  './js/audio-engine.js',
  './js/progression.js',
  './js/vendor/tone.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Network-first: an active install always gets the latest deploy without
  // any cache-clearing gymnastics. Cache Storage is only a fallback for
  // when there's no network at all — that's what "works offline" needs,
  // not "serve whatever was cached first."
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
