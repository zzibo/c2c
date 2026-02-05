/**
 * Service Worker Update Hook
 *
 * Provides user-controlled SW updates instead of automatic skipWaiting.
 * Displays a banner when a new version is available.
 *
 * Usage:
 * ```tsx
 * const { needsUpdate, updateServiceWorker } = useServiceWorkerUpdate();
 *
 * {needsUpdate && (
 *   <UpdateBanner onUpdate={updateServiceWorker} />
 * )}
 * ```
 */

'use client';

import { useState, useEffect } from 'react';

interface ServiceWorkerUpdateAPI {
  needsUpdate: boolean;
  updateServiceWorker: () => void;
  isUpdating: boolean;
}

export function useServiceWorkerUpdate(): ServiceWorkerUpdateAPI {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleStateChange = (registration: ServiceWorkerRegistration) => {
      // New SW installed and waiting to activate
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setNeedsUpdate(true);
      }
    };

    // Listen for updates on existing registration
    navigator.serviceWorker.ready.then((registration) => {
      // Check immediately on mount
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setNeedsUpdate(true);
      }

      // Listen for new SW installing
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed but old one is still active
              setWaitingWorker(newWorker);
              setNeedsUpdate(true);
            }
          });
        }
      });
    });

    // Listen for SW controller changes (after skipWaiting)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // New SW has taken control - reload page
      if (!isUpdating) {
        window.location.reload();
      }
    });
  }, [isUpdating]);

  const updateServiceWorker = () => {
    if (!waitingWorker) return;

    setIsUpdating(true);

    // Send SKIP_WAITING message to waiting SW
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    // The controllerchange event will trigger page reload
  };

  return {
    needsUpdate,
    updateServiceWorker,
    isUpdating,
  };
}

/**
 * Example Update Banner Component
 *
 * Place this in your app layout:
 * ```tsx
 * export function UpdateBanner({ onUpdate }: { onUpdate: () => void }) {
 *   return (
 *     <div className="fixed bottom-4 left-4 right-4 bg-c2c-orange text-white p-4 rounded-lg shadow-pixel flex items-center justify-between">
 *       <p className="text-sm">A new version is available!</p>
 *       <button
 *         onClick={onUpdate}
 *         className="bg-white text-c2c-orange px-4 py-2 rounded font-medium hover:bg-gray-100"
 *       >
 *         Update Now
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
