# Service Worker Implementation Checklist

Use this checklist to track your Service Worker architecture improvements.

---

## Phase 1: Quick Wins (1-2 days)

### Navigation Preload
- [ ] Enable navigation preload in activate event
- [ ] Use preloadResponse in fetch handler for navigations
- [ ] Test page navigation speed (should be 100-300ms faster)
- [ ] Verify works in Chrome DevTools > Network tab

**Files to modify:**
- `/public/sw.js` - Add preload logic

**Reference:**
- `/public/sw-navigation-preload.js` (example)

---

### User-Controlled Updates
- [ ] Remove `self.skipWaiting()` from install event
- [ ] Add SKIP_WAITING message handler
- [ ] Create `useServiceWorkerUpdate` hook
- [ ] Add update banner component to app layout
- [ ] Test update flow: deploy new SW → see banner → click update → reload

**Files to create/modify:**
- `/hooks/useServiceWorkerUpdate.ts` (new)
- `/components/ui/UpdateBanner.tsx` (new)
- `/app/layout.tsx` (add banner)
- `/public/sw.js` (remove auto skipWaiting)

**Reference:**
- `/hooks/useServiceWorkerUpdate.ts` (example)
- `/public/sw-controlled-update.js` (example)

---

## Phase 2: Workbox Migration (3-5 days)

### Install Dependencies
- [ ] `npm install workbox-webpack-plugin workbox-window workbox-strategies workbox-expiration workbox-cacheable-response`
- [ ] Verify installation: `npm list workbox-strategies`

### Migrate Tile Caching
- [ ] Import `CacheFirst` and `ExpirationPlugin`
- [ ] Replace manual LRU with `ExpirationPlugin`
- [ ] Set `maxEntries: 100` and `maxAgeSeconds: 7 days`
- [ ] Test: Clear cache, load map, verify 100-tile limit

**Before (145 lines):**
```javascript
// Manual LRU implementation + IndexedDB
```

**After (10 lines):**
```javascript
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

registerRoute(
  ({ url }) => url.origin === 'https://api.mapbox.com',
  new CacheFirst({
    cacheName: 'c2c-tiles-v1',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7*24*60*60 })],
  })
);
```

### Migrate Image Caching
- [ ] Use `StaleWhileRevalidate` for app images
- [ ] Precache critical images with `precacheAndRoute`
- [ ] Test: Images load instantly, update in background

### Custom Metrics Plugin
- [ ] Create Workbox plugin for existing logger
- [ ] Implement lifecycle hooks: `requestWillFetch`, `cachedResponseWillBeUsed`, `fetchDidSucceed`, `fetchDidFail`
- [ ] Verify metrics still flush to `/api/analytics/sw-logs`

**Example:**
```javascript
class MetricsPlugin {
  cachedResponseWillBeUsed({ cachedResponse }) {
    logger.recordCacheHit(request.url, !!cachedResponse);
    return cachedResponse;
  }
}
```

### Testing Checklist
- [ ] Tile caching works (check DevTools > Application > Cache Storage)
- [ ] LRU eviction works (load 101 tiles, verify oldest is removed)
- [ ] Image caching works (check cache for /assets/*.webp)
- [ ] Metrics logged correctly (check console + analytics API)
- [ ] No breaking changes (map loads, ratings work)

**Files to create/modify:**
- `/public/sw.js` (replace with Workbox version)
- `/lib/workbox-config.js` (new - Workbox configuration)

**Reference:**
- `/public/sw-workbox-example.js` (complete example)

---

## Phase 3: Modular Architecture (5-7 days)

### Set Up Build Pipeline
- [ ] Install esbuild: `npm install esbuild --save-dev`
- [ ] Create `/scripts/build-sw.ts`
- [ ] Add npm script: `"build-sw": "tsx scripts/build-sw.ts"`
- [ ] Test: `npm run build-sw` should generate `/public/sw.js`

### Extract LRU Module
- [ ] Create `/service-worker/plugins/lru-cache.ts`
- [ ] Move LRU logic (145 lines) into `LRUCache` class
- [ ] Add methods: `init()`, `recordAccess()`, `shouldEvict()`, `evictLRU()`
- [ ] Write unit tests: `/__tests__/lru-cache.test.ts`
- [ ] Test standalone: `npm test lru-cache`

### Extract Metrics Logger
- [ ] Create `/service-worker/plugins/metrics-logger.ts`
- [ ] Move logging logic into `MetricsLogger` class
- [ ] Add methods: `debug()`, `info()`, `warn()`, `error()`, `flush()`
- [ ] Write unit tests: `/__tests__/metrics-logger.test.ts`

### Extract Tile Cache Strategy
- [ ] Create `/service-worker/strategies/tile-cache.ts`
- [ ] Move tile caching logic into `TileCacheStrategy` class
- [ ] Compose LRU + Logger plugins
- [ ] Write unit tests: `/__tests__/tile-cache.test.ts`

### Create Modular SW Entry Point
- [ ] Create `/service-worker/sw-modular.ts`
- [ ] Import strategies and plugins
- [ ] Wire up fetch handlers
- [ ] Test: `npm run build-sw && npm run dev`

### Testing Checklist
- [ ] Unit tests pass: `npm test`
- [ ] Integration test: Map loads, tiles cached
- [ ] No regressions: All existing features work
- [ ] Build script works: `npm run build-sw` generates valid SW

**Files to create:**
- `/service-worker/sw-modular.ts` (entry point)
- `/service-worker/plugins/lru-cache.ts` (module)
- `/service-worker/plugins/metrics-logger.ts` (module)
- `/service-worker/strategies/tile-cache.ts` (module)
- `/scripts/build-sw.ts` (build script)
- `/__tests__/` (unit tests)

**Reference:**
- All files in `/service-worker/` folder (complete examples)

---

## Phase 4: Background Sync (2-3 days)

### Implement Sync Queue
- [ ] Create `/service-worker/features/background-sync.ts`
- [ ] Add IndexedDB queue: `queueRequest()`, `processQueue()`
- [ ] Register sync event handler in SW
- [ ] Test: Queue request, go offline → online, verify auto-sync

### Create React Hook
- [ ] Create `/hooks/useBackgroundSync.ts`
- [ ] Add methods: `queueRating()`, listen for sync completion
- [ ] Test: Submit rating offline → see "Saved offline" toast

### Update Rating Form
- [ ] Check `navigator.onLine` before submitting
- [ ] Call `queueRating()` if offline
- [ ] Show sync status: `{queuedCount} ratings queued`
- [ ] Show syncing spinner when `isSyncing`

### Testing Checklist
- [ ] Offline submission: Disable network, submit rating, verify queued
- [ ] Auto-sync: Re-enable network, verify rating syncs automatically
- [ ] Success notification: User sees "Rating synced!" message
- [ ] Queue persistence: Refresh page, queued ratings still there

**Files to create/modify:**
- `/service-worker/features/background-sync.ts` (new)
- `/hooks/useBackgroundSync.ts` (new)
- `/components/cafe/RatingPanel.tsx` (modify - add offline detection)

**Reference:**
- `/service-worker/features/background-sync.ts` (example)
- `/hooks/useBackgroundSync.ts` (example)

---

## Production Checklist

### Before Deploying
- [ ] All tests pass: `npm test`
- [ ] Lighthouse PWA audit: Score > 90
- [ ] Test on real mobile device (iOS + Android)
- [ ] Test offline scenarios: Airplane mode, slow 3G
- [ ] Verify cache sizes stay under limits (< 100 tiles)
- [ ] Check analytics: Metrics flowing to `/api/analytics/sw-logs`

### Deploy Checklist
- [ ] Deploy new SW to production
- [ ] Monitor error rates (Sentry, LogRocket, etc.)
- [ ] Check SW registration rate (Google Analytics)
- [ ] Verify update banner appears for existing users
- [ ] Test full flow: Install SW → use app → update → reload

### Rollback Plan
- [ ] Keep old `sw.js` as `sw-legacy.js`
- [ ] If issues, revert registration: `navigator.serviceWorker.register('/sw-legacy.js')`
- [ ] Clear caches: `caches.keys().then(names => names.forEach(caches.delete))`

---

## Monitoring & Metrics

### Key Metrics to Track
- **SW Registration Rate**: % of users with SW active
- **Cache Hit Rate**: % of tile requests served from cache
- **Update Adoption**: Time from new SW available → user updates
- **Sync Success Rate**: % of queued ratings successfully synced
- **Performance**: Page load time with/without navigation preload

### Dashboards to Create
- [ ] Service Worker health dashboard
- [ ] Cache performance metrics
- [ ] Background sync queue sizes
- [ ] Error rates by SW version

### Alerts to Set Up
- [ ] SW error rate > 5%
- [ ] Cache hit rate < 70%
- [ ] Sync queue size > 50 (indicates network issues)
- [ ] Update adoption < 50% after 7 days

---

## Common Issues & Solutions

### Issue: SW not updating
**Solution:** Check `skipWaiting` is only called on SKIP_WAITING message. Clear cache: `chrome://serviceworker-internals`

### Issue: Cache growing too large
**Solution:** Verify `ExpirationPlugin` maxEntries is working. Check: `await caches.open('cache-name').then(c => c.keys())`

### Issue: Offline sync not triggering
**Solution:** Check browser support (`'SyncManager' in window`). Verify sync registered: `chrome://serviceworker-internals`

### Issue: Navigation preload not working
**Solution:** Check CORS headers on preloaded requests. Verify enabled: `self.registration.navigationPreload.getState()`

### Issue: Workbox bundle too large
**Solution:** Use tree-shaking: `import { CacheFirst } from 'workbox-strategies'` (not `import * from 'workbox'`)

---

## Resources

### Documentation
- [Workbox Docs](https://developer.chrome.com/docs/workbox/)
- [Service Worker Lifecycle](https://web.dev/service-worker-lifecycle/)
- [Background Sync API](https://web.dev/periodic-background-sync/)

### Tools
- Chrome DevTools > Application > Service Workers
- [Lighthouse PWA Audit](https://web.dev/lighthouse-pwa/)
- [Workbox Wizard](https://developer.chrome.com/docs/workbox/modules/workbox-cli/#wizard)

### Testing
- `chrome://serviceworker-internals` - Debug SW lifecycle
- `chrome://inspect/#service-workers` - Inspect active SW
- [Puppeteer Service Worker Testing](https://pptr.dev/)

---

## Next Steps After Completion

1. **Add Push Notifications** (future feature)
   - Server: Send push via Web Push protocol
   - SW: Listen for `push` event, show notification
   - Client: Request permission, subscribe to push

2. **Periodic Background Sync** (future feature)
   - Refresh cafe data daily even when app closed
   - Requires permission prompt

3. **Offline-First Architecture**
   - Cache API responses (cafe data)
   - Use `NetworkFirst` strategy
   - Show stale data with "Updated X min ago" indicator

4. **Advanced Caching**
   - Precache routes: `/`, `/map`, `/profile`
   - Runtime caching for user profile photos
   - Background fetch for large resources

---

**Status:** ⬜ Not Started | 🔵 In Progress | ✅ Completed | ❌ Blocked

Track your progress by checking off items as you complete them!
