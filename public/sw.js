const CACHE_NAME = 'kashf-noqoot-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/public/manifest.json',
  'https://cdn-icons-png.flaticon.com/512/11502/11502604.png'
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
  // 1. Only intercept GET requests
  if (e.request.method !== 'GET') {
    return;
  }

  const url = e.request.url;

  // 2. Skip Firestore, Firebase Auth, and other external APIs/SDKs
  if (
    url.includes('/api/') ||
    url.includes('firestore.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('securetoken.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('firebaseapp.com') ||
    url.includes('firebase')
  ) {
    return; // Let browser or Firebase SDK handle these directly
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // If successful, clone and cache same-origin resources or allowed assets
        if (response.status === 200) {
          const isSameOrigin = url.startsWith(self.location.origin);
          const isAllowedExternal = url.includes('cdn-icons-png.flaticon.com');
          
          if (isSameOrigin || isAllowedExternal) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseToCache);
            });
          }
        }
        return response;
      })
      .catch(() => {
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to index.html for navigation requests
          if (e.request.mode === 'navigate') {
            return caches.match('/');
          }
          return null;
        });
      })
  );
});
