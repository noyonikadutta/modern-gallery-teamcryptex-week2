const CACHE_NAME = 'mg-cache-v1';
const urlsToCache = ['/', '/index.html', '/gallery.html', '/upload.html', '/login.html', '/register.html', '/profile.html', '/app.js'];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function(event) {
  // network-first for API requests, cache-first for app shell
  if (event.request.url.includes('/api/') || event.request.url.includes('/upload') || event.request.url.includes('/auth')) {
    event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
