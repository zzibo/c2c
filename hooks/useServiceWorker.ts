import { useEffect, useState } from 'react';
import { CACHE_NAME } from '@/lib/constants/cacheNames';

/**
 * Hook to register service worker for map tile caching
 * Returns registration status for debugging
 */
export function useServiceWorker() {
  const [status, setStatus] = useState<'registering' | 'registered' | 'error' | 'unsupported'>('registering');

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported in this browser');
      setStatus('unsupported');
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let registration: ServiceWorkerRegistration | null = null;
    let updateFoundListener: (() => void) | null = null;

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;
        console.log('✅ Service Worker registered successfully:', reg.scope);
        console.log('📦 Map tiles will now be cached for faster loading');
        setStatus('registered');
        
        // Log cache status
        if ('caches' in window) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.keys().then((keys) => {
              console.log(`🗺️  Cached ${keys.length} map tiles`);
            });
          });
        }
        
        // Check for updates periodically
        intervalId = setInterval(() => {
          reg.update();
        }, 60000); // Check every minute
        
        // Listen for updates
        updateFoundListener = () => {
          console.log('🔄 Service Worker update found');
        };
        reg.addEventListener('updatefound', updateFoundListener);
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
        setStatus('error');
      });

    // Cleanup function
    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      if (registration && updateFoundListener) {
        registration.removeEventListener('updatefound', updateFoundListener);
      }
    };
  }, []);

  return status;
}

