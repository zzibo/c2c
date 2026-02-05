# Serwist Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace custom 150-line Service Worker with Serwist for reliable, bug-free Mapbox tile caching.

**Architecture:** Install Serwist + @serwist/next, create a TypeScript SW file with runtime caching config for Mapbox tiles and app images, update next.config.ts to use withSerwist wrapper, remove old custom SW files.

**Tech Stack:** Serwist, @serwist/next, TypeScript, Next.js 16

---

## Task 1: Install Serwist Dependencies

**Files:**
- Modify: `/Users/zibo/c2c/package.json`

**Step 1: Install serwist and @serwist/next**

Run:
```bash
cd /Users/zibo/c2c && npm install serwist @serwist/next
```

Expected: Packages added to dependencies in package.json

**Step 2: Verify installation**

Run:
```bash
cat /Users/zibo/c2c/package.json | grep -A2 "serwist"
```

Expected output should show:
```
"serwist": "^9.x.x",
"@serwist/next": "^9.x.x",
```

**Step 3: Commit**

```bash
cd /Users/zibo/c2c && git add package.json package-lock.json && git commit -m "chore: install serwist and @serwist/next

Replacing custom SW implementation with battle-tested library.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Serwist Service Worker

**Files:**
- Create: `/Users/zibo/c2c/app/sw.ts`

**Step 1: Create the new SW file**

Create `/Users/zibo/c2c/app/sw.ts` with this content:

```typescript
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
      urlPattern: /^\/assets\/.*\.(webp|png|jpg|jpeg|svg|gif)$/i,
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
```

**Step 2: Verify file created**

Run:
```bash
head -20 /Users/zibo/c2c/app/sw.ts
```

Expected: Should show the import statements and type declarations

**Step 3: Commit**

```bash
cd /Users/zibo/c2c && git add app/sw.ts && git commit -m "feat(sw): create Serwist service worker config

- CacheFirst for Mapbox tiles (500 entries, 7 days)
- CacheFirst for Mapbox styles/fonts (30 days)
- CacheFirst for app images (100 entries, 30 days)
- Navigation preload enabled
- Built-in LRU expiration (no custom IndexedDB needed)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Update Next.js Config for Serwist

**Files:**
- Modify: `/Users/zibo/c2c/next.config.ts`

**Step 1: Update next.config.ts to use withSerwist**

Replace the entire content of `/Users/zibo/c2c/next.config.ts` with:

```typescript
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable SW in development to avoid caching issues
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  transpilePackages: ["react-map-gl", "mapbox-gl"],
};

export default withSerwist(nextConfig);
```

**Step 2: Verify config updated**

Run:
```bash
cat /Users/zibo/c2c/next.config.ts
```

Expected: Should show withSerwist wrapper around nextConfig

**Step 3: Commit**

```bash
cd /Users/zibo/c2c && git add next.config.ts && git commit -m "feat(config): integrate Serwist with Next.js build

- SW disabled in development (avoids caching headaches)
- SW built from app/sw.ts to public/sw.js on production build

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Update SW Registration Hook

**Files:**
- Modify: `/Users/zibo/c2c/hooks/useServiceWorker.ts`

**Step 1: Simplify the hook (Serwist handles most logic)**

Replace the entire content of `/Users/zibo/c2c/hooks/useServiceWorker.ts` with:

```typescript
import { useEffect, useState } from "react";

type SWStatus = "loading" | "ready" | "error" | "unsupported";

/**
 * Hook to register Serwist service worker
 * Serwist handles caching, updates, and lifecycle automatically
 */
export function useServiceWorker() {
  const [status, setStatus] = useState<SWStatus>("loading");

  useEffect(() => {
    // Skip in SSR or if SW not supported
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }

    // In development, Serwist is disabled via next.config.ts
    if (process.env.NODE_ENV === "development") {
      setStatus("unsupported");
      return;
    }

    // Register the SW (Serwist builds it to /sw.js)
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("✅ Service Worker registered:", registration.scope);
        setStatus("ready");

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          console.log("🔄 New Service Worker version available");
        });
      })
      .catch((error) => {
        console.error("❌ Service Worker registration failed:", error);
        setStatus("error");
      });
  }, []);

  return status;
}
```

**Step 2: Verify hook updated**

Run:
```bash
wc -l /Users/zibo/c2c/hooks/useServiceWorker.ts
```

Expected: ~45 lines (down from ~70)

**Step 3: Commit**

```bash
cd /Users/zibo/c2c && git add hooks/useServiceWorker.ts && git commit -m "refactor(hook): simplify useServiceWorker for Serwist

Serwist handles caching, LRU, and lifecycle internally.
Hook now just registers and reports status.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Remove Old SW Files

**Files:**
- Delete: `/Users/zibo/c2c/public/sw.js`
- Delete: `/Users/zibo/c2c/public/sw-logger.js`
- Delete: `/Users/zibo/c2c/public/sw-improved.js`
- Delete: `/Users/zibo/c2c/public/sw-controlled-update.js`
- Delete: `/Users/zibo/c2c/public/sw-navigation-preload.js`
- Delete: `/Users/zibo/c2c/public/sw-workbox-example.js`
- Delete: `/Users/zibo/c2c/lib/constants/cacheNames.ts` (if exists)

**Step 1: Backup old SW (optional, for reference)**

Run:
```bash
mkdir -p /Users/zibo/c2c/.archive && cp /Users/zibo/c2c/public/sw.js /Users/zibo/c2c/.archive/sw-legacy.js
```

**Step 2: Delete old SW files**

Run:
```bash
cd /Users/zibo/c2c && rm -f public/sw.js public/sw-logger.js public/sw-improved.js public/sw-controlled-update.js public/sw-navigation-preload.js public/sw-workbox-example.js
```

**Step 3: Check for cacheNames.ts and remove import if needed**

Run:
```bash
ls /Users/zibo/c2c/lib/constants/cacheNames.ts 2>/dev/null && rm /Users/zibo/c2c/lib/constants/cacheNames.ts || echo "File not found, skipping"
```

**Step 4: Verify files deleted**

Run:
```bash
ls /Users/zibo/c2c/public/sw*.js 2>/dev/null || echo "All old SW files removed"
```

Expected: "All old SW files removed"

**Step 5: Commit**

```bash
cd /Users/zibo/c2c && git add -A && git commit -m "chore: remove legacy custom SW implementation

Replaced by Serwist. Old files archived to .archive/sw-legacy.js

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Build and Test

**Files:** None (testing only)

**Step 1: Run production build**

Run:
```bash
cd /Users/zibo/c2c && npm run build
```

Expected: Build succeeds, should see Serwist output like:
```
> Using Serwist
> Compiling Service Worker...
```

**Step 2: Check generated SW exists**

Run:
```bash
ls -la /Users/zibo/c2c/public/sw.js && head -5 /Users/zibo/c2c/public/sw.js
```

Expected: File exists and starts with Serwist-generated code (minified)

**Step 3: Start production server and test**

Run:
```bash
cd /Users/zibo/c2c && npm run start &
sleep 3
echo "Open http://localhost:3000 in browser"
```

**Step 4: Manual verification in browser**

1. Open http://localhost:3000
2. Open DevTools → Application → Service Workers
3. Verify SW is "activated and running"
4. Pan the map around
5. Check DevTools → Application → Cache Storage
6. Should see caches: `mapbox-tiles-v1`, `mapbox-styles-v1`, `app-images-v1`

**Step 5: Stop the server**

Run:
```bash
pkill -f "next start" || true
```

**Step 6: Commit verification (optional tag)**

```bash
cd /Users/zibo/c2c && git tag -a v1.1.0-serwist -m "Migrated to Serwist for SW caching"
```

---

## Task 7: Update .gitignore (if needed)

**Files:**
- Modify: `/Users/zibo/c2c/.gitignore`

**Step 1: Check if public/sw.js should be gitignored**

Since Serwist generates `public/sw.js` at build time, it should be in .gitignore.

Run:
```bash
grep "public/sw.js" /Users/zibo/c2c/.gitignore || echo "public/sw.js" >> /Users/zibo/c2c/.gitignore
```

**Step 2: Also ignore the workbox files Serwist might generate**

Run:
```bash
grep "public/workbox" /Users/zibo/c2c/.gitignore || echo "public/workbox-*.js" >> /Users/zibo/c2c/.gitignore
```

**Step 3: Commit**

```bash
cd /Users/zibo/c2c && git add .gitignore && git commit -m "chore: gitignore generated SW files

Serwist generates these at build time.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary of Changes

| Before | After |
|--------|-------|
| 500+ lines custom SW code | ~60 lines Serwist config |
| Manual LRU with IndexedDB | Built-in ExpirationPlugin |
| Race conditions | Battle-tested internals |
| Custom logging | Serwist devtools |
| 6 SW files | 1 SW file (generated) |

**Total estimated time:** 30-45 minutes

**Rollback plan:** Restore from `.archive/sw-legacy.js` and revert next.config.ts changes.
