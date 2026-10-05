// public/sw.js
const CACHE_NAME = 'ashrey-flowops-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install: Cache basic offline app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell app...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Prune stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing legacy cache store:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network first fallback to Cache
self.addEventListener('fetch', (event) => {
  // Let Firebase / API calls bypass service worker cache completely to avoid stale syncs
  const requestUrl = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname.startsWith('/api') ||
    requestUrl.href.includes('firestore.googleapis.com') ||
    requestUrl.href.includes('securetoken.googleapis.com') ||
    requestUrl.href.includes('identitytoolkit.googleapis.com')
  ) {
    return; // Pass through to network natively
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful local resource requests
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache when offline
        console.log('[Service Worker] Network missing, fetching from offline cache:', event.request.url);
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If a page route is missing and we are offline, fallback to index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
