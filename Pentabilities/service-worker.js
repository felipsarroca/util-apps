const CACHE_NAME = 'pentabilities-google-auth-v3';
const APP_SHELL = [
  './',
  './index.html',
  './privacy.html',
  './styles.css',
  './app.js',
  './config.js',
  './manifest.webmanifest',
  './assets/pentabilities-logo.png',
  './assets/pwa-icon-192.png',
  './assets/pwa-icon-512.png',
  './assets/pentabilities.png',
  './assets/ramon-pont.png',
  './assets/google.svg',
  './assets/cc-by-nc-sa.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    const isPrivacyPage = new URL(event.request.url).pathname.endsWith('/privacy.html');
    const cacheKey = isPrivacyPage ? './privacy.html' : './index.html';
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy));
          return response;
        })
        .catch(() => caches.match(cacheKey))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
