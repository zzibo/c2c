# Service Worker Inspector - Quick Start Guide

## How to Use the SW Inspector in Your App

### 1. Add to Your Layout (Development Only)

**Option A: Development Mode Only**

```tsx
// app/layout.tsx or app/page.tsx
import { ServiceWorkerInspector } from '@/components/debug/ServiceWorkerInspector';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <ServiceWorkerInspector />}
      </body>
    </html>
  );
}
```

**Option B: Feature Flag for Admins**

```tsx
'use client';

import { ServiceWorkerInspector } from '@/components/debug/ServiceWorkerInspector';
import { useAuth } from '@/lib/auth/AuthContext';

export function ConditionalSWInspector() {
  const { user } = useAuth();

  // Only show for admins
  if (user?.role !== 'admin') return null;

  return <ServiceWorkerInspector />;
}
```

**Option C: URL Query Parameter**

```tsx
'use client';

import { ServiceWorkerInspector } from '@/components/debug/ServiceWorkerInspector';
import { useSearchParams } from 'next/navigation';

export function ConditionalSWInspector() {
  const searchParams = useSearchParams();
  const showInspector = searchParams.get('sw_debug') === 'true';

  if (!showInspector) return null;

  return <ServiceWorkerInspector />;
}
```

Then use: `https://yourapp.com?sw_debug=true`

---

### 2. Open the Inspector

1. Look for the floating **"SW Inspector"** button in the bottom-right corner
2. Click to open the inspector panel
3. Use tabs to navigate between different views

---

### 3. Understanding the Tabs

#### Metrics Tab
Shows real-time performance metrics:
- **Cache Hit Rate**: Percentage of requests served from cache (higher is better)
- **Uptime**: How long the Service Worker has been running
- **Cache Hits/Misses**: Total count of cache operations
- **Network Requests/Failures**: Network activity tracking
- **LRU Evictions**: Number of cache entries evicted due to size limits
- **Errors**: Total error count

**What to look for:**
- Cache hit rate > 70% is good
- High network failures = connectivity issues
- High error count = investigate logs

#### Cache Info Tab
Shows cache storage details:
- **Mapbox Tiles**: Current cache size vs. max size (100 tiles)
  - Utilization shows how full the cache is
- **Images**: Number of cached UI assets
- **LRU Tracker**: Number of entries tracked in IndexedDB
- **Total Size**: Approximate disk space used

**What to look for:**
- If utilization is near 100%, LRU eviction is working
- Total size should stay reasonable (< 50MB)

#### LRU State Tab
Shows all cached entries with their age:
- Each entry shows the full URL and how long since last access
- Entries sorted by timestamp (oldest first will be evicted next)

**What to look for:**
- Verify entries are being tracked
- Check if frequently used tiles are staying cached
- Old entries (> 1 hour) are candidates for eviction

#### Actions Tab
Control panel for SW operations:

**Buttons:**
- **Refresh Metrics**: Manually fetch latest metrics
- **Clear Tile Cache**: Delete all Mapbox tile cache (use if map is broken)
- **Clear Image Cache**: Delete all UI image cache

**Set Log Level:**
- **DEBUG**: Verbose logging (every cache hit/miss)
- **INFO**: Standard logging (important events only)
- **WARN**: Warnings and errors only
- **ERROR**: Errors only

**Auto-refresh:**
- Enable to update metrics every 2 seconds automatically

---

### 4. Common Workflows

#### Check if SW is Working
1. Open SW Inspector
2. Check status badge (should show "active")
3. Go to Metrics tab
4. Pan the map around
5. Watch cache hits increment

#### Debug Slow Map Performance
1. Open SW Inspector → Metrics tab
2. Check cache hit rate
   - Low rate (< 50%) = cache not working well
   - High rate (> 80%) = cache is working, issue is elsewhere
3. Check network failures
   - High failures = internet/API issues
4. Go to Cache Info tab
   - Check if cache is full (100% utilization)
   - If full and evicting frequently, consider increasing MAX_CACHE_SIZE

#### Clear Broken Cache
1. Open SW Inspector → Actions tab
2. Click "Clear Tile Cache"
3. Reload the page
4. Pan the map to rebuild cache

#### Enable Verbose Logging
1. Open SW Inspector → Actions tab
2. Click "DEBUG" under Set Log Level
3. Open browser console (F12)
4. Look for detailed `[SW 🔍]` debug logs
5. Each cache operation will be logged

#### Monitor Real-Time Performance
1. Open SW Inspector → Metrics tab
2. Enable "Auto-refresh" in Actions tab
3. Watch metrics update every 2 seconds
4. Pan map and see cache hits increment in real-time

---

### 5. Browser Console Integration

The inspector uses the same logging system as the console. Open DevTools (F12) to see detailed logs:

```
[SW ℹ️] LIFECYCLE: Service Worker installing
[SW ℹ️] INSTALL: Precached images (count: 11, duration: 234ms)
[SW ℹ️] LIFECYCLE: Service Worker activated (duration: 456ms)
[SW 🔍] CACHE: Cache HIT (url: https://api.mapbox.com/v4/...)
[SW 🔍] TILE: Cached Mapbox tile (cacheSize: 45, duration: 120ms)
[SW ℹ️] LRU: Evicted LRU entry (url: ..., age: 15.3m)
[SW ❌] TILE: Network fetch failed (error: Failed to fetch)
```

**Log Colors:**
- 🔍 **DEBUG** (gray): Detailed operations
- ℹ️ **INFO** (blue): Standard events
- ⚠️ **WARN** (orange): Warnings
- ❌ **ERROR** (red): Errors

---

### 6. Programmatic Access

You can also interact with the Service Worker programmatically:

```typescript
// Send message to SW
async function sendSWMessage(type: string, payload?: any) {
  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (e) => resolve(e.data);
    navigator.serviceWorker.controller?.postMessage(
      { type, payload },
      [messageChannel.port2]
    );
  });
}

// Get metrics
const metrics = await sendSWMessage('GET_METRICS');
console.log('Cache hit rate:', metrics.data.hitRate);

// Clear cache
await sendSWMessage('CLEAR_CACHE', { cacheName: 'c2c-map-cache-v1' });

// Set log level
await sendSWMessage('SET_LOG_LEVEL', { level: 'debug' });
```

---

### 7. Troubleshooting

#### Inspector Button Not Appearing
- Check if component is imported and rendered
- Verify environment check (if using `NODE_ENV` conditional)
- Check browser console for React errors

#### Inspector Shows "none" Status
- Service Worker not registered
- Check if SW registration succeeded in browser DevTools (Application tab)
- Verify `/public/sw.js` exists and is served correctly

#### Metrics Not Updating
- Click "Refresh Metrics" button manually
- Enable auto-refresh
- Check browser console for errors
- Verify SW is active: `navigator.serviceWorker.controller`

#### Actions Not Working
- Verify SW is active (check status badge)
- Check browser console for MessageChannel errors
- Make sure you're not in an incognito window (SW may be restricted)

---

### 8. Best Practices

1. **Keep Inspector Open During Development**
   - Helps catch caching issues early
   - Monitor performance in real-time

2. **Check Metrics After SW Updates**
   - Clear cache after deploying new SW version
   - Verify hit rate returns to normal

3. **Use Debug Mode Sparingly**
   - Only enable when actively debugging
   - Verbose logs can impact performance

4. **Monitor Cache Utilization**
   - If constantly at 100%, consider increasing MAX_CACHE_SIZE
   - If too low, cache might not be working

5. **Clear Cache When Changing SW Code**
   - Prevents stale data from old SW version
   - Ensures clean testing environment

---

## Example: Full Debugging Session

**Problem:** User reports map tiles not loading

1. **Verify SW is active**
   - Open Inspector
   - Check status badge → should be "active"

2. **Check cache metrics**
   - Go to Metrics tab
   - Look at cache hit rate
   - If 0%, cache isn't working

3. **Enable debug logging**
   - Go to Actions tab
   - Click "DEBUG"
   - Open browser console (F12)

4. **Reproduce the issue**
   - Pan the map
   - Watch console for tile fetch logs
   - Look for `[SW ❌] TILE: Network fetch failed`

5. **Inspect cache state**
   - Go to Cache Info tab
   - Check tile count (should be > 0 after panning)
   - If 0, cache isn't storing tiles

6. **Check LRU state**
   - Go to LRU State tab
   - Verify entries are being tracked
   - If empty, LRU system is broken

7. **Try clearing cache**
   - Go to Actions tab
   - Click "Clear Tile Cache"
   - Reload page
   - Pan map to rebuild cache

8. **Verify fix**
   - Go back to Metrics tab
   - Check cache hit rate after panning
   - Should start increasing

---

## Quick Reference

| Action | Location | Purpose |
|--------|----------|---------|
| View hit rate | Metrics tab | Check cache performance |
| Check cache size | Cache Info tab | See disk usage |
| View cached URLs | LRU State tab | Inspect cache contents |
| Clear cache | Actions tab | Fix broken cache |
| Enable debug logs | Actions tab → Set Log Level → DEBUG | Verbose logging |
| Auto-refresh | Actions tab → toggle checkbox | Live metrics |
| Open console | F12 in browser | See detailed logs |

---

## Need Help?

If the inspector isn't helping you debug your issue:
1. Copy the Session ID from Metrics tab
2. Check backend logs for that session: `/api/analytics/sw-logs`
3. Look for error patterns in server console
4. File an issue with reproduction steps and session ID
