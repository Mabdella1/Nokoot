const CACHE_NAME = 'kashf-noqoot-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/public/manifest.json',
  'https://cdn-icons-png.flaticon.com/512/2184/2184742.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Simple network-first or cache fallback strategy for non-API calls
  if (e.request.url.includes('/api/') || e.request.url.includes('firestore.googleapis.com')) {
    return; // Let Firebase SDK handle Firestore caching
  }
  
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // If successful, clone and cache
        if (response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
