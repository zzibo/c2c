import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// Serwist global config type declaration
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Initialize Serwist with configuration
const serwist = new Serwist({
  // Precache entries injected at build time
  precacheEntries: self.__SW_MANIFEST,

  // Skip waiting and claim clients immediately
  skipWaiting: true,
  clientsClaim: true,

  // Enable navigation preload for faster page loads
  navigationPreload: true,

  // Runtime caching rules
  runtimeCaching: [
    // Mapbox vector tiles - CacheFirst with LRU
    {
      urlPattern: /^https:\/\/api\.mapbox\.com\/v4\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "mapbox-tiles-v1",
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    // Mapbox styles and sprites - CacheFirst, longer TTL
    {
      urlPattern: /^https:\/\/api\.mapbox\.com\/(styles|sprites)\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "mapbox-styles-v1",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    // Mapbox fonts/glyphs
    {
      urlPattern: /^https:\/\/api\.mapbox\.com\/fonts\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "mapbox-fonts-v1",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    // App images in /assets - CacheFirst
    {
      urlPattern: /\/assets\/.*\.(webp|png|jpg|jpeg|svg|gif)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "app-images-v1",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },

    // Include default Next.js caching rules
    ...defaultCache,
  ],
});

serwist.addEventListeners();
