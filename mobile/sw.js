// Simple service worker: caches app shell and responds with cache-first for shell, network-first for data
const CACHE_NAME = 'quran-mobile-shell-v1';
const SHELL_FILES = [
  './index.html',
  './styles.css',
  './app.js',
  './assets/styles.css',
  './assets/app.js',
  './assets/icons/logo.svg',
  './sura-names.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // For data (json files in /data), try network first then fallback to cache
  if(url.pathname.startsWith('/mobile/data') || url.pathname.endsWith('.json')){
    event.respondWith(fetch(req).catch(()=>caches.match(req)));
    return;
  }
  // For shell, cache-first
  event.respondWith(caches.match(req).then(res=>res || fetch(req).then(r=>{ caches.open(CACHE_NAME).then(c=>c.put(req, r.clone())); return r; })));
});