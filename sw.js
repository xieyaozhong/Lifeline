const CACHE = 'lifeline-suite-cache-v5';
const BASE = new URL('./', self.location.href);
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './features.css',
  './app.js',
  './app-loader.js',
  './app-v2.01.part',
  './app-v2.02.part',
  './app-v2.03.part',
  './app-v2.04.part',
  './app-v2.05.part',
  './app-v2.06.part',
  './app-v2.07.part',
  './manifest.webmanifest',
  './icon.svg',
  './shared/project-shell.css',
  './shared/project-shell.js',
  './portal/',
  './portal/index.html',
  './portal/style.css',
  './portal/app.js',
  './schedule-studio/',
  './schedule-studio/index.html',
  './schedule-studio/style.css',
  './schedule-studio/app.js',
  './schedule-studio/child-day.css',
  './schedule-studio/child-day.js',
  './self-training-checklist/',
  './self-training-checklist/index.html',
  './self-training-checklist/style.css',
  './self-training-checklist/app.js',
  './appointment-generator/',
  './appointment-generator/index.html',
  './appointment-generator/style.css',
  './appointment-generator/app.js',
  './404.html'
].map((path) => new URL(path, BASE).toString());

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function offlineFallback(requestUrl) {
  const path = new URL(requestUrl).pathname;
  if (path.includes('/appointment-generator/')) return new URL('./appointment-generator/index.html', BASE).toString();
  if (path.includes('/self-training-checklist/')) return new URL('./self-training-checklist/index.html', BASE).toString();
  if (path.includes('/schedule-studio/')) return new URL('./schedule-studio/index.html', BASE).toString();
  if (path.includes('/portal/')) return new URL('./portal/index.html', BASE).toString();
  return new URL('./index.html', BASE).toString();
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => (
          await caches.match(event.request)
          || await caches.match(offlineFallback(event.request.url))
        ))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
