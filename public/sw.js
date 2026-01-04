// Service Worker for caching Mapbox tiles and images
// IMPORTANT: This constant must match lib/constants/cacheNames.ts CACHE_NAME
// If you change this value, update lib/constants/cacheNames.ts as well
const CACHE_NAME = 'c2c-map-cache-v1';
const IMAGE_CACHE_NAME = 'c2c-images-v1';
const MAPBOX_TILE_PATTERN = /^https:\/\/api\.mapbox\.com/;
const IMAGE_URLS = [
  '/assets/c2c-icon.webp',
  '/assets/cafe-icon.webp',
  '/assets/coffee.webp',
  '/assets/vibes.webp',
  '/assets/wifi.webp',
  '/assets/plugs.webp',
  '/assets/seats.webp',
  '/assets/noise.webp',
  '/assets/full_star.webp',
  '/assets/half_star.webp',
  '/assets/zero_star.webp',
];
const MAX_CACHE_SIZE = 100; // Maximum number of tiles to cache
const LRU_DB_NAME = 'c2c-lru-tracker';
const LRU_DB_VERSION = 1;
const LRU_STORE_NAME = 'lru-timestamps';

// In-memory LRU tracker: Map<requestUrl, lastAccessTimestamp>
let lruMap = new Map();

// Initialize IndexedDB for LRU persistence
async function initLRUDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LRU_DB_NAME, LRU_DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(LRU_STORE_NAME)) {
        db.createObjectStore(LRU_STORE_NAME, { keyPath: 'url' });
      }
    };
  });
}

// Load LRU state from IndexedDB
async function loadLRUState() {
  try {
    const db = await initLRUDB();
    const transaction = db.transaction([LRU_STORE_NAME], 'readonly');
    const store = transaction.objectStore(LRU_STORE_NAME);
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const entries = request.result;
        lruMap = new Map(entries.map(entry => [entry.url, entry.timestamp]));
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.log('[SW] 📦 Loaded LRU state:', lruMap.size, 'entries');
        }
        resolve(lruMap);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    // Silent fail - not critical
    lruMap = new Map();
    return lruMap;
  }
}

// Update LRU timestamp for a URL (both in-memory and IndexedDB)
async function updateLRUTimestamp(url) {
  const timestamp = Date.now();
  lruMap.set(url, timestamp);
  
  try {
    const db = await initLRUDB();
    const transaction = db.transaction([LRU_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(LRU_STORE_NAME);
    await store.put({ url, timestamp });
  } catch (error) {
    // Silent fail - not critical for functionality
  }
}

// Remove LRU entry (both in-memory and IndexedDB)
async function removeLRUEntry(url) {
  lruMap.delete(url);
  
  try {
    const db = await initLRUDB();
    const transaction = db.transaction([LRU_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(LRU_STORE_NAME);
    await store.delete(url);
  } catch (error) {
    // Silent fail - not critical
  }
}

// Find and evict the least recently used entry
async function evictLRUEntry(cache) {
  if (lruMap.size === 0) {
    // Fallback: if LRU map is empty, get all keys and delete first one
    const keys = await cache.keys();
    if (keys.length > 0) {
      await cache.delete(keys[0]);
    }
    return;
  }
  
  // Find the entry with the oldest timestamp
  let oldestUrl = null;
  let oldestTimestamp = Infinity;
  
  for (const [url, timestamp] of lruMap.entries()) {
    if (timestamp < oldestTimestamp) {
      oldestTimestamp = timestamp;
      oldestUrl = url;
    }
  }
  
  if (oldestUrl) {
    // Create a Request object from the URL for cache.delete()
    const requestToDelete = new Request(oldestUrl);
    await cache.delete(requestToDelete);
    await removeLRUEntry(oldestUrl);
  }
}

// Install event - cache map resources and images
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache images on install
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.addAll(IMAGE_URLS.map(url => new Request(url, { cache: 'reload' })));
      }).catch((error) => {
        // Silent fail - images will be cached on first fetch
      })
    ])
  );
  self.skipWaiting();
});

// Activate event - clean up old caches and load LRU state
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== IMAGE_CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
      loadLRUState() // Load persisted LRU state
    ])
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle image requests
  if (event.request.destination === 'image' && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        // Try cache first
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Fetch from network and cache
        try {
          const response = await fetch(event.request);
          if (response.status === 200) {
            // Only cache if response is small enough (images should be small)
            const clonedResponse = response.clone();
            const blob = await clonedResponse.blob();
            // Only cache if under 1MB to prevent memory issues
            if (blob.size < 1024 * 1024) {
              await cache.put(event.request, clonedResponse);
            }
          }
          return response;
        } catch (error) {
          // Return error response instead of throwing
          return new Response('Image unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      })
    );
    return;
  }

  // Only cache Mapbox tiles
  if (MAPBOX_TILE_PATTERN.test(url.href)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const requestUrl = event.request.url;
        
        // Try to match from cache
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          // Update LRU timestamp on cache hit (fire and forget to avoid blocking)
          updateLRUTimestamp(requestUrl).catch(() => {});
          return cachedResponse;
        }

        // Fetch from network
        try {
          const response = await fetch(event.request);
          
          // Only cache successful responses
          if (response.status === 200) {
            // Clone the response before caching
            const responseToCache = response.clone();
            
            // Check cache size and evict if needed
            const keys = await cache.keys();
            if (keys.length >= MAX_CACHE_SIZE) {
              await evictLRUEntry(cache);
            }
            
            // Add to cache and update LRU (fire and forget)
            cache.put(event.request, responseToCache).catch(() => {});
            updateLRUTimestamp(requestUrl).catch(() => {});
          }
          
          return response;
        } catch (error) {
          // Network fetch failed - try to serve from cache
          const staleCachedResponse = await cache.match(event.request);
          if (staleCachedResponse) {
            return staleCachedResponse;
          }
          
          // Try to get a generic offline tile
          const offlineTileResponse = await cache.match('/offline-tile.webp');
          if (offlineTileResponse) {
            return offlineTileResponse;
          }
          
          // Last resort: return a minimal error response
          return new Response('Tile unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      })
    );
  }
});

