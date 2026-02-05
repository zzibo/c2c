# Service Worker Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical SW bugs (cross-project contamination, broken env detection, LRU race conditions) and add user-controlled updates.

**Architecture:** Minimal changes to existing sw.js - add origin validation at fetch handler entry, replace process.env with hostname check, wrap cache writes in a queue, and convert skipWaiting to message-triggered.

**Tech Stack:** Vanilla JS (Service Worker), React hooks (TypeScript)

---

## Task 1: Add Origin Validation to Prevent Cross-Project Contamination

**Files:**
- Modify: `/Users/zibo/c2c/public/sw.js:214-220`

**Problem:** SW intercepts ALL requests on localhost:3000, even from other projects.

**Step 1: Add origin check at top of fetch handler**

Open `/Users/zibo/c2c/public/sw.js` and add this right after line 216 (`const url = new URL(event.request.url);`):

```javascript
// SECURITY: Only handle requests from this app's origin
// This prevents the SW from intercepting requests from other localhost projects
if (!url.href.startsWith(self.location.origin) && !MAPBOX_TILE_PATTERN.test(url.href)) {
  return; // Let the request pass through without SW handling
}
```

**Step 2: Verify the change**

Run: `grep -n "self.location.origin" /Users/zibo/c2c/public/sw.js`
Expected: Line ~218 should show the new origin check

**Step 3: Test manually**

1. Run `npm run dev` in c2c folder
2. Open http://localhost:3000 - map should load, tiles should cache
3. Stop c2c, start another project on localhost:3000
4. Other project should NOT have SW interference (check DevTools > Application > Service Workers)

**Step 4: Commit**

```bash
git add public/sw.js
git commit -m "fix(sw): add origin validation to prevent cross-project contamination

SW now only handles requests from its own origin + Mapbox tiles.
Other localhost:3000 projects won't be affected.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Fix Broken Environment Detection

**Files:**
- Modify: `/Users/zibo/c2c/public/sw-logger.js` (if exists) OR `/Users/zibo/c2c/public/sw.js`

**Problem:** `process.env.NODE_ENV` doesn't exist in Service Worker context - it's not bundled.

**Step 1: Check if sw-logger.js exists and how it detects environment**

Run: `head -30 /Users/zibo/c2c/public/sw-logger.js`

If it uses `process.env`, we need to fix it.

**Step 2: Replace process.env with hostname detection**

In `/Users/zibo/c2c/public/sw-logger.js`, find any `process.env.NODE_ENV` checks and replace with:

```javascript
// Detect environment from hostname (process.env doesn't work in SW context)
const IS_LOCALHOST = self.location.hostname === 'localhost' ||
                     self.location.hostname === '127.0.0.1';
```

Then replace conditionals:
- `process.env.NODE_ENV === 'development'` → `IS_LOCALHOST`
- `process.env.NODE_ENV === 'production'` → `!IS_LOCALHOST`

**Step 3: Verify the fix**

Run: `grep -n "process.env" /Users/zibo/c2c/public/sw-logger.js /Users/zibo/c2c/public/sw.js`
Expected: No matches (all replaced)

**Step 4: Test logging works**

1. Run `npm run dev`
2. Open DevTools > Console
3. Pan the map to trigger tile requests
4. Should see `[SW ...]` log messages (previously silent)

**Step 5: Commit**

```bash
git add public/sw-logger.js public/sw.js
git commit -m "fix(sw): replace process.env with hostname detection

process.env doesn't exist in SW context. Now using
self.location.hostname === 'localhost' for environment detection.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Fix LRU Race Condition with Queue-Based Writes

**Files:**
- Modify: `/Users/zibo/c2c/public/sw.js:274-320`

**Problem:** Multiple concurrent tile requests can exceed MAX_CACHE_SIZE because they all check size before any eviction completes.

**Step 1: Add cache write queue after the constants (around line 30)**

```javascript
// Queue for serializing cache writes to prevent race conditions
const cacheWriteQueue = [];
let isProcessingQueue = false;

async function queueCacheWrite(cache, request, response, requestUrl) {
  return new Promise((resolve) => {
    cacheWriteQueue.push({ cache, request, response, requestUrl, resolve });
    processCacheQueue();
  });
}

async function processCacheQueue() {
  if (isProcessingQueue || cacheWriteQueue.length === 0) return;
  isProcessingQueue = true;

  while (cacheWriteQueue.length > 0) {
    const { cache, request, response, requestUrl, resolve } = cacheWriteQueue.shift();

    try {
      // Check cache size and evict if needed (now atomic)
      const keys = await cache.keys();
      if (keys.length >= MAX_CACHE_SIZE) {
        await evictLRUEntry(cache);
      }

      // Add to cache
      await cache.put(request, response);
      await updateLRUTimestamp(requestUrl);

      logger.debug('TILE', 'Cached Mapbox tile (queued)', {
        url: requestUrl,
        cacheSize: keys.length,
        queueLength: cacheWriteQueue.length
      });
    } catch (error) {
      logger.error('CACHE', 'Failed to write to cache', { error: error.message });
    }

    resolve();
  }

  isProcessingQueue = false;
}
```

**Step 2: Update the Mapbox tile caching logic (around line 298-320)**

Replace the fire-and-forget cache writes:

```javascript
// OLD (race condition):
// cache.put(event.request, responseToCache).catch(() => {});
// updateLRUTimestamp(requestUrl).catch(() => {});

// NEW (queued, atomic):
queueCacheWrite(cache, event.request, responseToCache, requestUrl);
```

Find this block in the Mapbox tile handler and replace:

```javascript
// Only cache successful responses
if (response.status === 200) {
  const responseToCache = response.clone();

  // Queue the cache write to prevent race conditions
  queueCacheWrite(cache, event.request, responseToCache, requestUrl);
}
```

**Step 3: Verify queue is used**

Run: `grep -n "queueCacheWrite" /Users/zibo/c2c/public/sw.js`
Expected: Should show the function definition and usage in tile handler

**Step 4: Test under load**

1. Run `npm run dev`
2. Open DevTools > Application > Cache Storage
3. Note current tile count
4. Pan map rapidly (zoom out, pan around quickly)
5. Check tile count never exceeds 100

**Step 5: Commit**

```bash
git add public/sw.js
git commit -m "fix(sw): add queue-based cache writes to prevent LRU race condition

Multiple concurrent tile requests no longer exceed MAX_CACHE_SIZE.
Cache writes are serialized through a queue, ensuring atomic check-and-evict.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Convert to User-Controlled Updates

**Files:**
- Modify: `/Users/zibo/c2c/public/sw.js:184` (remove skipWaiting)
- Modify: `/Users/zibo/c2c/public/sw.js:359-441` (add SKIP_WAITING message handler)
- Create: `/Users/zibo/c2c/components/ui/ServiceWorkerUpdateBanner.tsx`
- Modify: `/Users/zibo/c2c/hooks/useServiceWorker.ts`

**Problem:** `skipWaiting()` activates new SW mid-session, potentially breaking active pages.

**Step 1: Remove automatic skipWaiting from install handler**

In `/Users/zibo/c2c/public/sw.js`, find line ~184:

```javascript
// REMOVE THIS LINE:
self.skipWaiting();
```

**Step 2: Add SKIP_WAITING to message handler**

Find the `switch (type)` block (around line 364) and add this case:

```javascript
    case 'SKIP_WAITING':
      // User-triggered update - activate the waiting SW
      logger.info('LIFECYCLE', 'User triggered SW update');
      self.skipWaiting();
      event.ports[0]?.postMessage({
        type: 'SKIP_WAITING_ACKNOWLEDGED',
        data: { success: true }
      });
      break;
```

**Step 3: Update useServiceWorker hook to detect waiting SW**

Replace `/Users/zibo/c2c/hooks/useServiceWorker.ts` with:

```typescript
import { useEffect, useState, useCallback } from 'react';
import { CACHE_NAME } from '@/lib/constants/cacheNames';

interface ServiceWorkerState {
  status: 'registering' | 'registered' | 'error' | 'unsupported';
  updateAvailable: boolean;
  applyUpdate: () => void;
}

/**
 * Hook to register service worker for map tile caching
 * Returns registration status and update controls
 */
export function useServiceWorker(): ServiceWorkerState {
  const [status, setStatus] = useState<ServiceWorkerState['status']>('registering');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;

    // Send message to waiting SW to skip waiting
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = () => {
      // Reload page after SW activates
      window.location.reload();
    };

    waitingWorker.postMessage({ type: 'SKIP_WAITING' }, [messageChannel.port2]);
  }, [waitingWorker]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported in this browser');
      setStatus('unsupported');
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let registration: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;
        console.log('✅ Service Worker registered:', reg.scope);
        setStatus('registered');

        // Check if there's already a waiting worker
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setUpdateAvailable(true);
        }

        // Listen for new updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed, waiting to activate
              console.log('🔄 New Service Worker version available');
              setWaitingWorker(newWorker);
              setUpdateAvailable(true);
            }
          });
        });

        // Check for updates periodically
        intervalId = setInterval(() => reg.update(), 60000);

        // Log cache status
        if ('caches' in window) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.keys().then((keys) => {
              console.log(`🗺️  Cached ${keys.length} map tiles`);
            });
          });
        }
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
        setStatus('error');
      });

    // Handle controller change (new SW activated)
    const handleControllerChange = () => {
      console.log('🔄 Service Worker controller changed');
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return { status, updateAvailable, applyUpdate };
}
```

**Step 4: Create update banner component**

Create `/Users/zibo/c2c/components/ui/ServiceWorkerUpdateBanner.tsx`:

```tsx
'use client';

import { useServiceWorker } from '@/hooks/useServiceWorker';

export function ServiceWorkerUpdateBanner() {
  const { updateAvailable, applyUpdate } = useServiceWorker();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white border-2 border-gray-900 rounded-lg shadow-lg p-4 z-50">
      <p className="text-sm font-medium text-gray-900 mb-2">
        A new version is available
      </p>
      <div className="flex gap-2">
        <button
          onClick={applyUpdate}
          className="flex-1 bg-c2c-orange hover:bg-c2c-orange-dark text-white text-sm font-medium py-2 px-4 rounded transition-colors"
        >
          Update now
        </button>
        <button
          onClick={() => {/* dismiss logic if needed */}}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Later
        </button>
      </div>
    </div>
  );
}
```

**Step 5: Verify changes**

Run: `grep -n "skipWaiting" /Users/zibo/c2c/public/sw.js`
Expected: Only in message handler case, NOT in install handler

**Step 6: Test update flow**

1. Run `npm run dev`
2. Make a small change to sw.js (e.g., add a comment)
3. Refresh page
4. Should see "New version available" banner (may take a minute)
5. Click "Update now" → page reloads with new SW

**Step 7: Commit**

```bash
git add public/sw.js hooks/useServiceWorker.ts components/ui/ServiceWorkerUpdateBanner.tsx
git commit -m "feat(sw): convert to user-controlled updates

- Remove automatic skipWaiting() from install handler
- Add SKIP_WAITING message handler for user-triggered updates
- Update useServiceWorker hook to detect waiting workers
- Add ServiceWorkerUpdateBanner component for UX

Users now control when SW updates are applied, preventing
mid-session breakage.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Update Banner to App Layout

**Files:**
- Modify: `/Users/zibo/c2c/app/layout.tsx`

**Step 1: Import and add the banner component**

In `/Users/zibo/c2c/app/layout.tsx`, add the import:

```tsx
import { ServiceWorkerUpdateBanner } from '@/components/ui/ServiceWorkerUpdateBanner';
```

**Step 2: Add banner inside ToastProvider**

Find the return statement and add the banner after `<AppHeader />`:

```tsx
<ToastProvider>
  <WelcomeBackHandler />
  <AppHeader />
  <ServiceWorkerUpdateBanner />  {/* ADD THIS LINE */}
  {children}
</ToastProvider>
```

**Step 3: Verify placement**

Run: `grep -n "ServiceWorkerUpdateBanner" /Users/zibo/c2c/app/layout.tsx`
Expected: Shows import and usage

**Step 4: Test visually**

1. Run `npm run dev`
2. Modify sw.js to trigger an update
3. Verify banner appears at bottom of screen
4. Verify it doesn't obstruct main content

**Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(layout): add ServiceWorkerUpdateBanner to app layout

Banner appears when a new SW version is available,
giving users control over when to apply updates.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Final Integration Test

**Files:** None (testing only)

**Step 1: Clear all SW state**

1. Open Chrome DevTools > Application > Service Workers
2. Click "Unregister" on any existing SW
3. Go to Application > Storage > Clear site data

**Step 2: Fresh registration test**

1. Run `npm run dev`
2. Open http://localhost:3000
3. Verify in DevTools > Application > Service Workers:
   - Status: "activated and running"
   - Scope: "http://localhost:3000/"
4. Pan the map
5. Verify in DevTools > Application > Cache Storage:
   - `c2c-map-cache-v1` shows tiles
   - Count stays ≤ 100

**Step 3: Cross-project isolation test**

1. Stop c2c server
2. Create a test file: `echo '<h1>Test</h1>' > /tmp/test.html`
3. Run: `npx serve /tmp -p 3000`
4. Open http://localhost:3000/test.html
5. Verify NO c2c SW is active (DevTools > Application > Service Workers)

**Step 4: Update flow test**

1. Stop test server, restart c2c
2. Add a comment to sw.js: `// version 2`
3. Save and wait 60 seconds (or manually trigger: `registration.update()`)
4. Verify "New version available" banner appears
5. Click "Update now"
6. Verify page reloads and new SW is active

**Step 5: Document results**

If all tests pass, the SW fixes are complete. If any fail, debug and fix before merging.

---

## Summary of Changes

| File | Change |
|------|--------|
| `public/sw.js` | + Origin validation, + Cache queue, - skipWaiting() |
| `public/sw-logger.js` | Replace process.env with hostname detection |
| `hooks/useServiceWorker.ts` | + Update detection, + applyUpdate() |
| `components/ui/ServiceWorkerUpdateBanner.tsx` | New component |
| `app/layout.tsx` | + Banner integration |

**Total estimated time:** 2-3 hours

**Risks:**
- Cache queue adds slight latency to tile caching (negligible)
- Update banner requires user action (better UX trade-off)
- Existing cached tiles remain valid (no migration needed)
