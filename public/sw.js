// Service Worker for caching Mapbox tiles
const CACHE_NAME = 'c2c-map-cache-v1';
const MAPBOX_TILE_PATTERN = /^https:\/\/api\.mapbox\.com/;
const MAX_CACHE_SIZE = 100; // Maximum number of tiles to cache

// Install event - cache map resources
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only cache Mapbox tiles
  if (MAPBOX_TILE_PATTERN.test(url.href)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version immediately
            console.log('[SW] ✅ Serving cached tile:', url.pathname);
            return cachedResponse;
          }

          // Fetch from network
          console.log('[SW] 🌐 Fetching tile from network:', url.pathname);
          return fetch(event.request).then((response) => {
            // Only cache successful responses
            if (response.status === 200) {
              // Clone the response before caching
              const responseToCache = response.clone();
              
              // Limit cache size
              cache.keys().then((keys) => {
                if (keys.length >= MAX_CACHE_SIZE) {
                  // Remove oldest entry (first in array)
                  cache.delete(keys[0]);
                }
                cache.put(event.request, responseToCache);
                console.log('[SW] 💾 Cached tile:', url.pathname, `(${keys.length + 1}/${MAX_CACHE_SIZE})`);
              });
            }
            return response;
          });
        });
      })
    );
  }
});

