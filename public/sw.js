// Service Worker for caching Mapbox tiles
// IMPORTANT: This constant must match lib/constants/cacheNames.ts CACHE_NAME
// If you change this value, update lib/constants/cacheNames.ts as well
const CACHE_NAME = 'c2c-map-cache-v1';
const MAPBOX_TILE_PATTERN = /^https:\/\/api\.mapbox\.com/;
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
        console.log('[SW] 📦 Loaded LRU state:', lruMap.size, 'entries');
        resolve(lruMap);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[SW] ⚠️ Failed to load LRU state:', error);
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
    console.warn('[SW] ⚠️ Failed to persist LRU timestamp:', error);
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
    console.warn('[SW] ⚠️ Failed to remove LRU entry:', error);
  }
}

// Find and evict the least recently used entry
async function evictLRUEntry(cache) {
  if (lruMap.size === 0) {
    // Fallback: if LRU map is empty, get all keys and delete first one
    const keys = await cache.keys();
    if (keys.length > 0) {
      await cache.delete(keys[0]);
      console.log('[SW] 🗑️ Evicted entry (fallback):', keys[0].url);
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
    console.log('[SW] 🗑️ Evicted LRU entry:', oldestUrl);
  }
}

// Install event - cache map resources
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches and load LRU state
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
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

  // Only cache Mapbox tiles
  if (MAPBOX_TILE_PATTERN.test(url.href)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const requestUrl = event.request.url;
        
        // Try to match from cache
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          // Update LRU timestamp on cache hit
          await updateLRUTimestamp(requestUrl);
          console.log('[SW] ✅ Serving cached tile:', url.pathname);
          return cachedResponse;
        }

        // Fetch from network
        console.log('[SW] 🌐 Fetching tile from network:', url.pathname);
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
            
            // Add to cache and update LRU
            await cache.put(event.request, responseToCache);
            await updateLRUTimestamp(requestUrl);
            console.log('[SW] 💾 Cached tile:', url.pathname, `(${keys.length}/${MAX_CACHE_SIZE})`);
          }
          
          return response;
        } catch (error) {
          // Network fetch failed - try to serve from cache
          console.error('[SW] ❌ Network fetch failed:', url.pathname, error);
          
          // Try to get any cached version of this request
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) {
            console.log('[SW] 🔄 Serving stale cached tile:', url.pathname);
            return cachedResponse;
          }
          
          // Try to get a generic offline tile
          const offlineTileResponse = await cache.match('/offline-tile.png');
          if (offlineTileResponse) {
            console.log('[SW] 🔄 Serving offline tile fallback');
            return offlineTileResponse;
          }
          
          // Last resort: return a minimal error response
          console.warn('[SW] ⚠️ No cached fallback available, returning error response');
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

