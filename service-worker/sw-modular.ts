/**
 * Modular Service Worker Entry Point
 *
 * Uses plugin architecture for maintainability.
 * Requires bundling (e.g., esbuild, webpack) to generate /public/sw.js
 */

import { logger } from './plugins/metrics-logger';
import { TileCacheStrategy } from './strategies/tile-cache';

// Cache configurations
const CACHE_VERSION = 'v1';
const TILE_CACHE_NAME = `c2c-tiles-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `c2c-images-${CACHE_VERSION}`;

// Initialize strategies
const tileCacheStrategy = new TileCacheStrategy({
  cacheName: TILE_CACHE_NAME,
  maxEntries: 100,
  maxTileSizeKB: 1024,
});

// Image URLs to precache
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

// Install: Precache critical assets
self.addEventListener('install', (event: ExtendableEvent) => {
  logger.info('LIFECYCLE', 'Service Worker installing', { version: CACHE_VERSION });

  event.waitUntil(
    (async () => {
      // Initialize tile cache
      await tileCacheStrategy.init();

      // Precache images
      const imageCache = await caches.open(IMAGE_CACHE_NAME);
      await imageCache.addAll(
        IMAGE_URLS.map(url => new Request(url, { cache: 'reload' }))
      );

      logger.info('INSTALL', 'Precached assets', {
        images: IMAGE_URLS.length,
      });
    })()
  );

  // Wait for user confirmation before activating
  // (Don't call skipWaiting here - controlled by message handler)
});

// Activate: Clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  logger.info('LIFECYCLE', 'Service Worker activating', { version: CACHE_VERSION });

  event.waitUntil(
    (async () => {
      // Enable navigation preload
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }

      // Delete old cache versions
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(
        (name) => !name.endsWith(CACHE_VERSION)
      );

      await Promise.all(oldCaches.map((name) => caches.delete(name)));

      logger.info('ACTIVATE', 'Cleaned old caches', { oldCaches });

      // Take control of all clients
      await self.clients.claim();
    })()
  );
});

// Fetch: Route requests to appropriate strategies
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Strategy 1: Mapbox tiles
  if (url.origin === 'https://api.mapbox.com') {
    event.respondWith(tileCacheStrategy.handle(request));
    return;
  }

  // Strategy 2: App images (cache-first)
  if (request.destination === 'image' && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
          logger.recordCacheHit(request.url, true);
          return cachedResponse;
        }

        logger.recordCacheHit(request.url, false);

        try {
          const response = await fetch(request);
          if (response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          logger.error('IMAGE', 'Fetch failed', {
            url: request.url,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      })()
    );
    return;
  }

  // Strategy 3: HTML navigations (network-first with preload)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Use preloaded response if available
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            logger.debug('NAV', 'Using preloaded response', { url: url.pathname });
            return preloadResponse;
          }

          return await fetch(request);
        } catch (error) {
          logger.error('NAV', 'Navigation failed', { url: url.pathname });
          throw error;
        }
      })()
    );
    return;
  }

  // Default: pass through
  event.respondWith(fetch(request));
});

// Message handler
self.addEventListener('message', async (event: ExtendableMessageEvent) => {
  const { type, payload } = event.data;

  logger.debug('MESSAGE', `Received: ${type}`, payload);

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_METRICS':
      event.ports[0]?.postMessage({
        type: 'METRICS',
        data: logger.getMetrics(),
      });
      break;

    case 'GET_CACHE_INFO':
      const [tileInfo, imageCache] = await Promise.all([
        tileCacheStrategy.getCacheInfo(),
        caches.open(IMAGE_CACHE_NAME),
      ]);

      const imageKeys = await imageCache.keys();

      event.ports[0]?.postMessage({
        type: 'CACHE_INFO',
        data: {
          tiles: tileInfo,
          images: {
            name: IMAGE_CACHE_NAME,
            count: imageKeys.length,
          },
        },
      });
      break;

    case 'CLEAR_CACHE':
      const cacheName = payload?.cacheName || TILE_CACHE_NAME;
      const cleared = await caches.delete(cacheName);
      logger.info('CACHE', `Cleared: ${cacheName}`, { success: cleared });

      event.ports[0]?.postMessage({
        type: 'CACHE_CLEARED',
        data: { cacheName, success: cleared },
      });
      break;

    case 'SET_LOG_LEVEL':
      logger.setLogLevel(payload?.level || 'info');
      event.ports[0]?.postMessage({
        type: 'LOG_LEVEL_CHANGED',
        data: { level: payload?.level },
      });
      break;

    case 'FORCE_METRICS_FLUSH':
      await logger.flush();
      event.ports[0]?.postMessage({
        type: 'METRICS_FLUSHED',
        data: { success: true },
      });
      break;
  }
});

logger.info('LIFECYCLE', 'Service Worker loaded', {
  version: CACHE_VERSION,
  strategies: ['TileCache', 'ImageCache', 'NavigationPreload'],
});
