import { useEffect, useState } from 'react';

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

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered successfully:', registration.scope);
        console.log('📦 Map tiles will now be cached for faster loading');
        setStatus('registered');
        
        // Log cache status
        if ('caches' in window) {
          caches.open('c2c-map-cache-v1').then((cache) => {
            cache.keys().then((keys) => {
              console.log(`🗺️  Cached ${keys.length} map tiles`);
            });
          });
        }
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          console.log('🔄 Service Worker update found');
        });
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
        setStatus('error');
      });
  }, []);

  return status;
}

