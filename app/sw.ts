/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, ExpirationPlugin, CacheableResponsePlugin } from "serwist";

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
      matcher: ({ url }) => /^https:\/\/api\.mapbox\.com\/v4\//.test(url.href),
      handler: new CacheFirst({
        cacheName: "mapbox-tiles-v1",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 3 * 24 * 60 * 60, // 3 days
          }),
          new CacheableResponsePlugin({
            statuses: [0, 200],
          }),
        ],
      }),
    },

    // Mapbox styles and sprites - CacheFirst, longer TTL
    {
      matcher: ({ url }) => /^https:\/\/api\.mapbox\.com\/(styles|sprites)\//.test(url.href),
      handler: new CacheFirst({
        cacheName: "mapbox-styles-v1",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
          new CacheableResponsePlugin({
            statuses: [0, 200],
          }),
        ],
      }),
    },

    // Mapbox fonts/glyphs
    {
      matcher: ({ url }) => /^https:\/\/api\.mapbox\.com\/fonts\//.test(url.href),
      handler: new CacheFirst({
        cacheName: "mapbox-fonts-v1",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
          new CacheableResponsePlugin({
            statuses: [0, 200],
          }),
        ],
      }),
    },

    // App images in /assets - CacheFirst
    {
      matcher: ({ url }) => /\/assets\/.*\.(webp|png|jpg|jpeg|svg|gif)$/.test(url.pathname),
      handler: new CacheFirst({
        cacheName: "app-images-v1",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },

    // Include default Next.js caching rules
    ...defaultCache,
  ],
});

serwist.addEventListeners();
