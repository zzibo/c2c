/**
 * Tile Caching Strategy
 *
 * Specialized cache strategy for Mapbox tiles with LRU eviction.
 */

import { LRUCache } from '../plugins/lru-cache';
import { logger } from '../plugins/metrics-logger';

export interface TileCacheOptions {
  cacheName: string;
  maxEntries: number;
  maxTileSizeKB?: number;
}

export class TileCacheStrategy {
  private cacheName: string;
  private lruCache: LRUCache;
  private maxTileSizeKB: number;

  constructor(options: TileCacheOptions) {
    this.cacheName = options.cacheName;
    this.maxTileSizeKB = options.maxTileSizeKB || 1024; // 1MB default
    this.lruCache = new LRUCache({
      maxEntries: options.maxEntries,
      dbName: `${options.cacheName}-lru`,
    });
  }

  async init(): Promise<void> {
    await this.lruCache.init();
    logger.info('TILE_CACHE', 'Initialized', {
      cacheName: this.cacheName,
      maxEntries: this.lruCache['maxEntries'],
    });
  }

  async handle(request: Request): Promise<Response> {
    const cache = await caches.open(this.cacheName);
    const startTime = Date.now();

    // Try cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      logger.recordCacheHit(request.url, true);
      await this.lruCache.recordAccess(request.url);
      return cachedResponse;
    }

    logger.recordCacheHit(request.url, false);

    // Fetch from network
    try {
      const response = await fetch(request);
      const duration = Date.now() - startTime;
      logger.recordNetworkRequest(request.url, response.ok, duration);

      if (response.status === 200) {
        const responseToCache = response.clone();
        const blob = await responseToCache.blob();

        // Check tile size
        if (blob.size > this.maxTileSizeKB * 1024) {
          logger.warn('TILE_CACHE', 'Tile too large to cache', {
            url: request.url,
            size: `${(blob.size / 1024).toFixed(1)}KB`,
            maxSize: `${this.maxTileSizeKB}KB`,
          });
          return response;
        }

        // Evict if cache is full
        if (await this.lruCache.shouldEvict(cache)) {
          const evictedUrl = await this.lruCache.evictLRU(cache);
          if (evictedUrl) {
            logger.recordEviction(evictedUrl);
          }
        }

        // Cache the tile
        await cache.put(request, responseToCache);
        await this.lruCache.recordAccess(request.url);

        logger.debug('TILE_CACHE', 'Cached tile', {
          url: request.url,
          size: `${(blob.size / 1024).toFixed(1)}KB`,
          duration: `${duration}ms`,
        });
      }

      return response;
    } catch (error) {
      logger.error('TILE_CACHE', 'Network fetch failed', {
        url: request.url,
        error: error instanceof Error ? error.message : String(error),
      });

      // Try stale cache as fallback
      const staleResponse = await cache.match(request);
      if (staleResponse) {
        logger.info('TILE_CACHE', 'Serving stale cached tile', {
          url: request.url,
        });
        return staleResponse;
      }

      throw error;
    }
  }

  async getCacheInfo(): Promise<{
    name: string;
    count: number;
    maxSize: number;
    utilization: string;
    totalSizeMB: string;
  }> {
    const cache = await caches.open(this.cacheName);
    const keys = await cache.keys();

    let totalSize = 0;
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }

    return {
      name: this.cacheName,
      count: keys.length,
      maxSize: this.lruCache['maxEntries'],
      utilization: `${((keys.length / this.lruCache['maxEntries']) * 100).toFixed(1)}%`,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    };
  }

  async clear(): Promise<boolean> {
    logger.info('TILE_CACHE', 'Clearing cache', { cacheName: this.cacheName });
    return await caches.delete(this.cacheName);
  }
}
