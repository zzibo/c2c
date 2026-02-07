// Service Worker for caching Mapbox tiles and images
// IMPORTANT: This constant must match lib/constants/cacheNames.ts CACHE_NAME
// If you change this value, update lib/constants/cacheNames.ts as well

// Import logger
importScripts('/sw-logger.js');

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

// Health check tracking
let lastHealthCheck = Date.now();
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

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
  const startTime = Date.now();
  try {
    const db = await initLRUDB();
    const transaction = db.transaction([LRU_STORE_NAME], 'readonly');
    const store = transaction.objectStore(LRU_STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const entries = request.result;
        lruMap = new Map(entries.map(entry => [entry.url, entry.timestamp]));
        const duration = Date.now() - startTime;

        logger.info('LRU', 'Loaded LRU state from IndexedDB', {
          entries: lruMap.size,
          duration: `${duration}ms`
        });

        resolve(lruMap);
      };
      request.onerror = () => {
        logger.error('LRU', 'Failed to load LRU state', { error: request.error });
        reject(request.error);
      };
    });
  } catch (error) {
    logger.warn('LRU', 'LRU state initialization failed, starting fresh', { error: error.message });
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
  const startTime = Date.now();

  if (lruMap.size === 0) {
    // Fallback: if LRU map is empty, get all keys and delete first one
    const keys = await cache.keys();
    if (keys.length > 0) {
      const evictedUrl = keys[0].url;
      await cache.delete(keys[0]);
      logger.warn('LRU', 'Evicted entry (fallback mode)', {
        url: evictedUrl,
        duration: `${Date.now() - startTime}ms`
      });
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
    const age = Date.now() - oldestTimestamp;
    const requestToDelete = new Request(oldestUrl);
    await cache.delete(requestToDelete);
    await removeLRUEntry(oldestUrl);

    logger.recordEviction(oldestUrl);
    logger.info('LRU', 'Evicted LRU entry', {
      url: oldestUrl,
      age: `${(age / 1000 / 60).toFixed(1)}m`,
      duration: `${Date.now() - startTime}ms`
    });
  }
}

// Install event - cache map resources and images
self.addEventListener('install', (event) => {
  const startTime = Date.now();
  logger.info('LIFECYCLE', 'Service Worker installing', { version: CACHE_NAME });

  event.waitUntil(
    Promise.all([
      // Cache images on install
      caches.open(IMAGE_CACHE_NAME).then((cache) => {
        return cache.addAll(IMAGE_URLS.map(url => new Request(url, { cache: 'reload' })));
      }).then(() => {
        const duration = Date.now() - startTime;
        logger.info('INSTALL', 'Precached images', {
          count: IMAGE_URLS.length,
          duration: `${duration}ms`
        });
      }).catch((error) => {
        logger.error('INSTALL', 'Failed to precache images', {
          error: error.message,
          duration: `${Date.now() - startTime}ms`
        });
      })
    ])
  );
  self.skipWaiting();
});

// Activate event - clean up old caches and load LRU state
self.addEventListener('activate', (event) => {
  const startTime = Date.now();
  logger.info('LIFECYCLE', 'Service Worker activating', { version: CACHE_NAME });

  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        const oldCaches = cacheNames.filter((name) => name !== CACHE_NAME && name !== IMAGE_CACHE_NAME);
        logger.info('ACTIVATE', 'Cleaning old caches', { oldCaches });

        return Promise.all(
          oldCaches.map((name) => caches.delete(name))
        );
      }),
      loadLRUState() // Load persisted LRU state
    ]).then(() => {
      const duration = Date.now() - startTime;
      logger.info('LIFECYCLE', 'Service Worker activated', {
        duration: `${duration}ms`,
        version: CACHE_NAME
      });
    })
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
        const startTime = Date.now();

        // Try cache first
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          logger.recordCacheHit(url.pathname, true);
          return cachedResponse;
        }

        logger.recordCacheHit(url.pathname, false);

        // Fetch from network and cache
        try {
          const response = await fetch(event.request);
          const duration = Date.now() - startTime;
          logger.recordNetworkRequest(url.pathname, response.ok, duration);

          if (response.status === 200) {
            const clonedResponse = response.clone();
            const blob = await clonedResponse.blob();

            if (blob.size < 1024 * 1024) {
              await cache.put(event.request, clonedResponse);
              logger.debug('IMAGE', 'Cached image', {
                url: url.pathname,
                size: `${(blob.size / 1024).toFixed(1)}KB`
              });
            } else {
              logger.warn('IMAGE', 'Image too large to cache', {
                url: url.pathname,
                size: `${(blob.size / 1024 / 1024).toFixed(1)}MB`
              });
            }
          }
          return response;
        } catch (error) {
          logger.error('IMAGE', 'Failed to fetch image', {
            url: url.pathname,
            error: error.message
          });
          logger.recordNetworkRequest(url.pathname, false, Date.now() - startTime);

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
        const startTime = Date.now();

        // Try to match from cache
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          logger.recordCacheHit(requestUrl, true);
          // Update LRU timestamp on cache hit (fire and forget to avoid blocking)
          updateLRUTimestamp(requestUrl).catch(() => {});
          return cachedResponse;
        }

        logger.recordCacheHit(requestUrl, false);

        // Fetch from network
        try {
          const response = await fetch(event.request);
          const duration = Date.now() - startTime;
          logger.recordNetworkRequest(requestUrl, response.ok, duration);

          // Only cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();

            // Check cache size and evict if needed
            const keys = await cache.keys();
            if (keys.length >= MAX_CACHE_SIZE) {
              logger.debug('CACHE', 'Cache full, evicting LRU entry', {
                currentSize: keys.length,
                maxSize: MAX_CACHE_SIZE
              });
              await evictLRUEntry(cache);
            }

            // Add to cache and update LRU (fire and forget)
            cache.put(event.request, responseToCache).catch(() => {});
            updateLRUTimestamp(requestUrl).catch(() => {});

            logger.debug('TILE', 'Cached Mapbox tile', {
              url: requestUrl,
              cacheSize: keys.length,
              duration: `${duration}ms`
            });
          }

          return response;
        } catch (error) {
          logger.error('TILE', 'Network fetch failed', {
            url: requestUrl,
            error: error.message,
            duration: `${Date.now() - startTime}ms`
          });
          logger.recordNetworkRequest(requestUrl, false, Date.now() - startTime);

          // Network fetch failed - try to serve from cache
          const staleCachedResponse = await cache.match(event.request);
          if (staleCachedResponse) {
            logger.info('TILE', 'Serving stale cached tile', { url: requestUrl });
            return staleCachedResponse;
          }

          // Try to get a generic offline tile
          const offlineTileResponse = await cache.match('/offline-tile.webp');
          if (offlineTileResponse) {
            logger.debug('TILE', 'Serving offline tile fallback', { url: requestUrl });
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

// Message handler for communication with the app
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  logger.debug('MESSAGE', `Received message: ${type}`, payload);

  switch (type) {
    case 'GET_METRICS':
      // Return current metrics
      event.ports[0].postMessage({
        type: 'METRICS',
        data: logger.getMetrics()
      });
      break;

    case 'GET_CACHE_INFO':
      // Return cache information
      const cacheInfo = await getCacheInfo();
      event.ports[0].postMessage({
        type: 'CACHE_INFO',
        data: cacheInfo
      });
      break;

    case 'GET_LRU_STATE':
      // Return LRU map state
      const lruState = Array.from(lruMap.entries()).map(([url, timestamp]) => ({
        url,
        timestamp,
        age: `${((Date.now() - timestamp) / 1000 / 60).toFixed(1)}m`
      }));
      event.ports[0].postMessage({
        type: 'LRU_STATE',
        data: lruState
      });
      break;

    case 'CLEAR_CACHE':
      // Clear specific cache
      const cacheName = payload?.cacheName || CACHE_NAME;
      const cleared = await caches.delete(cacheName);
      logger.info('CACHE', `Cache cleared: ${cacheName}`, { success: cleared });
      event.ports[0].postMessage({
        type: 'CACHE_CLEARED',
        data: { cacheName, success: cleared }
      });
      break;

    case 'HEALTH_CHECK':
      // Health check ping
      lastHealthCheck = Date.now();
      event.ports[0].postMessage({
        type: 'HEALTH_CHECK_RESPONSE',
        data: {
          status: 'healthy',
          uptime: logger.getMetrics().uptime,
          timestamp: new Date().toISOString()
        }
      });
      break;

    case 'SET_LOG_LEVEL':
      // Change log level dynamically
      logger.logLevel = payload?.level || 'info';
      logger.info('CONFIG', `Log level changed to: ${logger.logLevel}`);
      event.ports[0].postMessage({
        type: 'LOG_LEVEL_CHANGED',
        data: { level: logger.logLevel }
      });
      break;

    case 'FORCE_METRICS_FLUSH':
      // Force flush logs to analytics
      await logger.flush();
      event.ports[0].postMessage({
        type: 'METRICS_FLUSHED',
        data: { success: true }
      });
      break;

    default:
      logger.warn('MESSAGE', `Unknown message type: ${type}`);
  }
});

// Helper function to get cache info
async function getCacheInfo() {
  const [tileCache, imageCache] = await Promise.all([
    caches.open(CACHE_NAME),
    caches.open(IMAGE_CACHE_NAME)
  ]);

  const [tileKeys, imageKeys] = await Promise.all([
    tileCache.keys(),
    imageCache.keys()
  ]);

  // Calculate total cache size (approximate)
  let totalSize = 0;
  for (const cache of [tileCache, imageCache]) {
    const keys = await cache.keys();
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }
  }

  return {
    tiles: {
      name: CACHE_NAME,
      count: tileKeys.length,
      maxSize: MAX_CACHE_SIZE,
      utilization: `${((tileKeys.length / MAX_CACHE_SIZE) * 100).toFixed(1)}%`
    },
    images: {
      name: IMAGE_CACHE_NAME,
      count: imageKeys.length
    },
    lru: {
      entries: lruMap.size
    },
    totalSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
    timestamp: new Date().toISOString()
  };
}

// Periodic health check
setInterval(() => {
  const timeSinceLastCheck = Date.now() - lastHealthCheck;
  if (timeSinceLastCheck > HEALTH_CHECK_INTERVAL * 2) {
    logger.warn('HEALTH', 'No health check received in a while', {
      lastCheck: `${(timeSinceLastCheck / 1000).toFixed(0)}s ago`
    });
  }
}, HEALTH_CHECK_INTERVAL);

logger.info('LIFECYCLE', 'Service Worker script loaded', {
  version: CACHE_NAME,
  maxCacheSize: MAX_CACHE_SIZE
});

