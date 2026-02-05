/**
 * Background Sync React Hook
 *
 * Enables offline rating submission with automatic retry.
 *
 * Usage:
 * ```tsx
 * const { queueRating, isSyncing, queuedCount } = useBackgroundSync();
 *
 * const handleSubmit = async () => {
 *   if (!navigator.onLine) {
 *     await queueRating('/api/ratings', { method: 'POST', body: ratingData });
 *     toast.success('Saved offline! Will sync when online.');
 *   } else {
 *     await fetch('/api/ratings', { method: 'POST', body: JSON.stringify(ratingData) });
 *   }
 * };
 * ```
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface BackgroundSyncAPI {
  queueRating: (url: string, options: RequestInit) => Promise<void>;
  isSyncing: boolean;
  queuedCount: number;
  isSupported: boolean;
}

const SYNC_QUEUE_NAME = 'c2c-sync-queue';
const DB_NAME = 'c2c-background-sync';

export function useBackgroundSync(): BackgroundSyncAPI {
  const [isSyncing, setIsSyncing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSupported, setIsSupported] = useState(false);

  // Check browser support
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'SyncManager' in window;

    setIsSupported(supported);
  }, []);

  // Listen for sync completion messages
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'SYNC_COMPLETE') {
        setIsSyncing(false);
        updateQueuedCount();
        console.log('Background sync completed:', event.data.data);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Initial count
    updateQueuedCount();

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Update queued request count
  const updateQueuedCount = useCallback(async () => {
    try {
      const db = await openDB();
      const transaction = db.transaction([SYNC_QUEUE_NAME], 'readonly');
      const store = transaction.objectStore(SYNC_QUEUE_NAME);
      const count = await store.count();
      setQueuedCount(count);
    } catch (error) {
      console.error('Failed to get queued count:', error);
    }
  }, []);

  // Queue a request for background sync
  const queueRating = useCallback(
    async (url: string, options: RequestInit) => {
      if (!isSupported) {
        throw new Error('Background sync not supported');
      }

      try {
        const db = await openDB();
        const transaction = db.transaction([SYNC_QUEUE_NAME], 'readwrite');
        const store = transaction.objectStore(SYNC_QUEUE_NAME);

        const queuedRequest = {
          id: crypto.randomUUID(),
          url,
          method: options.method || 'GET',
          headers: Object.fromEntries(new Headers(options.headers).entries()),
          body: options.body ? String(options.body) : null,
          timestamp: Date.now(),
          retryCount: 0,
        };

        await store.add(queuedRequest);
        await updateQueuedCount();

        // Register sync
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('c2c-rating-sync');

        setIsSyncing(true);

        console.log('Request queued for background sync:', url);
      } catch (error) {
        console.error('Failed to queue request:', error);
        throw error;
      }
    },
    [isSupported, updateQueuedCount]
  );

  return {
    queueRating,
    isSyncing,
    queuedCount,
    isSupported,
  };
}

// Helper: Open IndexedDB
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

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
