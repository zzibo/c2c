/**
 * LRU Cache Plugin
 *
 * Standalone module for Least Recently Used cache eviction.
 * Can be used with raw Service Worker or Workbox.
 */

export interface LRUCacheOptions {
  maxEntries: number;
  dbName?: string;
  storeName?: string;
}

export class LRUCache {
  private lruMap: Map<string, number>;
  private maxEntries: number;
  private dbName: string;
  private storeName: string;

  constructor(options: LRUCacheOptions) {
    this.lruMap = new Map();
    this.maxEntries = options.maxEntries;
    this.dbName = options.dbName || 'c2c-lru-tracker';
    this.storeName = options.storeName || 'lru-timestamps';
  }

  async init(): Promise<void> {
    await this.loadFromIndexedDB();
  }

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'url' });
        }
      };
    });
  }

  private async loadFromIndexedDB(): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const entries = request.result as Array<{ url: string; timestamp: number }>;
          this.lruMap = new Map(entries.map(({ url, timestamp }) => [url, timestamp]));
          console.log(`[LRU] Loaded ${this.lruMap.size} entries from IndexedDB`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('[LRU] Failed to load from IndexedDB, starting fresh', error);
      this.lruMap = new Map();
    }
  }

  async recordAccess(url: string): Promise<void> {
    const timestamp = Date.now();
    this.lruMap.set(url, timestamp);

    // Persist to IndexedDB (fire-and-forget)
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      store.put({ url, timestamp });
    } catch (error) {
      // Silent fail - not critical
    }
  }

  async shouldEvict(cache: Cache): Promise<boolean> {
    const keys = await cache.keys();
    return keys.length >= this.maxEntries;
  }

  async evictLRU(cache: Cache): Promise<string | null> {
    if (this.lruMap.size === 0) {
      // Fallback: evict first entry if LRU map is empty
      const keys = await cache.keys();
      if (keys.length > 0) {
        const evictedUrl = keys[0].url;
        await cache.delete(keys[0]);
        console.warn('[LRU] Evicted entry (fallback mode)', evictedUrl);
        return evictedUrl;
      }
      return null;
    }

    // Find oldest entry
    let oldestUrl: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [url, timestamp] of this.lruMap.entries()) {
      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
        oldestUrl = url;
      }
    }

    if (oldestUrl) {
      const age = Date.now() - oldestTimestamp;
      await cache.delete(new Request(oldestUrl));
      await this.removeEntry(oldestUrl);

      console.log('[LRU] Evicted entry', {
        url: oldestUrl,
        age: `${(age / 1000 / 60).toFixed(1)}m`
      });

      return oldestUrl;
    }

    return null;
  }

  private async removeEntry(url: string): Promise<void> {
    this.lruMap.delete(url);

    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      store.delete(url);
    } catch (error) {
      // Silent fail
    }
  }

  getState(): Array<{ url: string; timestamp: number; age: string }> {
    return Array.from(this.lruMap.entries()).map(([url, timestamp]) => ({
      url,
      timestamp,
      age: `${((Date.now() - timestamp) / 1000 / 60).toFixed(1)}m`
    }));
  }
}

// Usage example:
// const lruCache = new LRUCache({ maxEntries: 100 });
// await lruCache.init();
// await lruCache.recordAccess(request.url);
// if (await lruCache.shouldEvict(cache)) {
//   await lruCache.evictLRU(cache);
// }
