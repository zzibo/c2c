/**
 * Background Sync Feature
 *
 * Enables offline rating submission with automatic retry when online.
 *
 * Usage:
 * 1. Register sync in SW: await registerBackgroundSync()
 * 2. Queue requests: await queueRequest('/api/ratings', { method: 'POST', body })
 * 3. SW automatically retries when online
 */

import { logger } from '../plugins/metrics-logger';

const SYNC_QUEUE_NAME = 'c2c-sync-queue';
const SYNC_TAG = 'c2c-rating-sync';

interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  retryCount: number;
}

/**
 * Queue a request for background sync
 */
export async function queueRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<void> {
  const db = await openSyncDB();
  const transaction = db.transaction([SYNC_QUEUE_NAME], 'readwrite');
  const store = transaction.objectStore(SYNC_QUEUE_NAME);

  const queuedRequest: QueuedRequest = {
    id: crypto.randomUUID(),
    url,
    method: options.method || 'GET',
    headers: options.headers || {},
    body: JSON.stringify(options.body),
    timestamp: Date.now(),
    retryCount: 0,
  };

  await store.add(queuedRequest);

  logger.info('SYNC', 'Queued request for background sync', {
    url,
    method: options.method,
  });

  // Register sync event
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(SYNC_TAG);
    logger.info('SYNC', 'Registered background sync', { tag: SYNC_TAG });
  }
}

/**
 * Process all queued requests
 * Called by SW on 'sync' event
 */
export async function processQueue(): Promise<void> {
  const db = await openSyncDB();
  const transaction = db.transaction([SYNC_QUEUE_NAME], 'readonly');
  const store = transaction.objectStore(SYNC_QUEUE_NAME);
  const requests = await store.getAll();

  logger.info('SYNC', `Processing ${requests.length} queued requests`);

  const results = await Promise.allSettled(
    requests.map(async (req: QueuedRequest) => {
      try {
        const response = await fetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body,
        });

        if (response.ok) {
          // Success - remove from queue
          await removeFromQueue(req.id);
          logger.info('SYNC', 'Successfully synced request', {
            url: req.url,
            status: response.status,
          });
          return { success: true, id: req.id };
        } else {
          // HTTP error - retry later
          logger.warn('SYNC', 'Sync failed with HTTP error', {
            url: req.url,
            status: response.status,
          });
          await incrementRetryCount(req.id);
          return { success: false, id: req.id, error: `HTTP ${response.status}` };
        }
      } catch (error) {
        // Network error - will retry on next sync
        logger.error('SYNC', 'Sync failed with network error', {
          url: req.url,
          error: error instanceof Error ? error.message : String(error),
        });
        await incrementRetryCount(req.id);
        return { success: false, id: req.id, error: 'Network error' };
      }
    })
  );

  const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - successful;

  logger.info('SYNC', 'Queue processing complete', {
    total: requests.length,
    successful,
    failed,
  });

  // Notify clients of sync completion
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      data: { successful, failed, total: requests.length },
    });
  });
}

/**
 * Open IndexedDB for sync queue
 */
async function openSyncDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('c2c-background-sync', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SYNC_QUEUE_NAME)) {
        db.createObjectStore(SYNC_QUEUE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Remove successfully synced request from queue
 */
async function removeFromQueue(id: string): Promise<void> {
  const db = await openSyncDB();
  const transaction = db.transaction([SYNC_QUEUE_NAME], 'readwrite');
  const store = transaction.objectStore(SYNC_QUEUE_NAME);
  await store.delete(id);
}

/**
 * Increment retry count for failed request
 */
async function incrementRetryCount(id: string): Promise<void> {
  const db = await openSyncDB();
  const transaction = db.transaction([SYNC_QUEUE_NAME], 'readwrite');
  const store = transaction.objectStore(SYNC_QUEUE_NAME);

  const request = await store.get(id);
  if (request) {
    request.retryCount++;

    // Remove if too many retries (10 max)
    if (request.retryCount > 10) {
      logger.error('SYNC', 'Request exceeded max retries, removing', {
        url: request.url,
        retries: request.retryCount,
      });
      await store.delete(id);
    } else {
      await store.put(request);
    }
  }
}

/**
 * Register sync event handler in Service Worker
 * Add this to your SW:
 *
 * self.addEventListener('sync', (event) => {
 *   if (event.tag === 'c2c-rating-sync') {
 *     event.waitUntil(processQueue());
 *   }
 * });
 */
export function registerSyncHandler(): void {
  self.addEventListener('sync', (event: any) => {
    if (event.tag === SYNC_TAG) {
      logger.info('SYNC', 'Sync event triggered', { tag: event.tag });
      event.waitUntil(processQueue());
    }
  });
}

/**
 * Client-side hook for background sync
 *
 * Usage in React component:
 * ```tsx
 * const { queueRating, isSyncing } = useBackgroundSync();
 *
 * const handleSubmit = async () => {
 *   if (!navigator.onLine) {
 *     await queueRating(ratingData);
 *     toast.success('Rating saved! Will sync when online.');
 *   } else {
 *     await submitRating(ratingData);
 *   }
 * };
 * ```
 */
