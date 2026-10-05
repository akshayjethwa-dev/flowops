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
<<<<<<< HEAD
  // Let Firebase / API calls bypass service worker cache completely to avoid stale syncs
  const requestUrl = new URL(event.request.url);
=======
  const requestUrl = new URL(event.request.url);

  // Let Firebase / API calls / Auth endpoints bypass service worker cache completely to avoid stale syncs
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
  if (
    event.request.method !== 'GET' ||
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname.startsWith('/api') ||
<<<<<<< HEAD
=======
    requestUrl.pathname.startsWith('/__/auth') || // Explicitly bypass Firebase auth handler path
    requestUrl.href.includes('firebase') || // Catch-all for subdomains/paths containing firebase
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
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
<<<<<<< HEAD
          // If a page route is missing and we are offline, fallback to index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
=======
          
          // If a page route is missing and we are offline, fallback to index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/').then((cachedIndex) => {
              if (cachedIndex) {
                return cachedIndex;
              }
              // FIX: Guarantee a Response object even if the cache is empty
              return new Response(
                'You are offline and the application could not be loaded from cache.', 
                { status: 503, statusText: 'Service Unavailable', headers: new Headers({ 'Content-Type': 'text/plain' }) }
              );
            });
          }

          // FIX: Ultimate fallback to prevent "TypeError: Failed to convert value to 'Response'"
          return new Response(
            'Resource not found in offline cache.', 
            { status: 404, statusText: 'Not Found', headers: new Headers({ 'Content-Type': 'text/plain' }) }
          );
        });
      })
  );
});
>>>>>>> 978af1b45531d5d8c7c4bfd41dd51fd2989cd145
