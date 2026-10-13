// Service worker : tout est mis en cache pour que l'app marche hors ligne.
// Incrémenter VERSION à chaque modification des fichiers.
const VERSION = 'carnet-v8';
const ASSETS = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/swipe.js',
  'js/countries.js',
  'vendor/d3.min.js',
  'vendor/topojson-client.min.js',
  'vendor/countries-50m.json',
  'fonts/JasmineBloom.otf',
  'fonts/CabinetGrotesk-Regular.otf',
  'fonts/CabinetGrotesk-Medium.otf',
  'fonts/CabinetGrotesk-Bold.otf',
  'fonts/CabinetGrotesk-Extrabold.otf',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Réseau d'abord (pour récupérer les mises à jour), cache en secours hors ligne
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
