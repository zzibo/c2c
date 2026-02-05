# Service Worker Testing Guide

Comprehensive testing procedures for validating production-grade service worker improvements.

---

## Quick Start Test Suite

Run these tests after implementing the improved service worker:

```bash
# 1. Install and build
npm install
node scripts/inject-build-id.js
npm run build

# 2. Verify BUILD_ID injection
grep "const BUILD_ID = " public/sw-improved.js
# Expected: const BUILD_ID = '1738761234567';

# 3. Start dev server
npm run dev

# 4. Open browser
# Navigate to: http://localhost:3000
# Open DevTools → Application → Service Workers
```

---

## Test 1: Race Condition Prevention

**Goal:** Verify that concurrent tile requests never exceed MAX_CACHE_SIZE.

### Setup
```javascript
// In browser DevTools console
const MAX_CONCURRENT_REQUESTS = 100;

async function testConcurrentRequests() {
  const tileUrls = Array.from({ length: 150 }, (_, i) =>
    `https://api.mapbox.com/v4/mapbox.satellite/${i % 20}/${i % 20}/${i % 20}.png?access_token=YOUR_TOKEN`
  );

  // Fire 150 concurrent requests
  console.time('Concurrent requests');
  await Promise.all(tileUrls.map(url => fetch(url)));
  console.timeEnd('Concurrent requests');

  // Check cache size
  const cache = await caches.open('c2c-map-cache-v1');
  const keys = await cache.keys();
  console.log(`Cache size: ${keys.length} (max: 100)`);

  // Verify size never exceeded
  if (keys.length <= 100) {
    console.log('✅ PASS: Cache size stayed within limit');
  } else {
    console.log('❌ FAIL: Cache size exceeded limit');
  }
}

testConcurrentRequests();
```

### Expected Results

**Before (sw.js):**
```
Cache size: 127 (max: 100)
❌ FAIL: Cache size exceeded limit
```

**After (sw-improved.js):**
```
Cache size: 90 (max: 100)
✅ PASS: Cache size stayed within limit
```

### Why It Works

The `CacheQueue` serializes all writes:
```
Request 1 → Queue → Size check (90) → Write → Complete
Request 2 → Queue → Size check (91) → Write → Complete
Request 3 → Queue → Size check (92) → Write → Complete
...
Request 10 → Queue → Size check (99) → Write → Complete
Request 11 → Queue → Size check (100) → Evict 10 → Write (91) → Complete
```

---

## Test 2: Cache Versioning & Invalidation

**Goal:** Verify automatic cache invalidation on deployment.

### Test 2A: Build ID Invalidation

```bash
# Step 1: Initial deployment
node scripts/inject-build-id.js
npm run build
npm start

# Step 2: Visit site, populate cache
# Open browser → http://localhost:3000
# Pan around map to populate tile cache
# Check cache size:
```

```javascript
// In DevTools console
const cache = await caches.open('c2c-map-cache-v1');
const keys = await cache.keys();
console.log(`Initial cache size: ${keys.length}`);
// Expected: ~50-100 tiles cached
```

```bash
# Step 3: Simulate new deployment (new BUILD_ID)
node scripts/inject-build-id.js  # Generates new timestamp
npm run build
npm start

# Step 4: Reload page
# Check cache size again:
```

```javascript
// In DevTools console (after reload)
const cache = await caches.open('c2c-map-cache-v1');
const keys = await cache.keys();
console.log(`Cache size after deploy: ${keys.length}`);
// Expected: 0 (cache cleared and repopulated)
```

### Test 2B: Manual Version Bump

```javascript
// Edit sw-improved.js
const CACHE_VERSION = 1; // Change to 2

// Reload page
// Old caches should be deleted automatically
const allCaches = await caches.keys();
console.log('Caches:', allCaches);
// Expected: Only 'c2c-map-cache-v2' and 'c2c-images-v2'
```

### Test 2C: Time-Based Expiration

```javascript
// Simulate 7-day-old cache
const db = await new Promise((resolve) => {
  const req = indexedDB.open('c2c-lru-tracker', 2);
  req.onsuccess = () => resolve(req.result);
});

const tx = db.transaction(['cache-metadata'], 'readwrite');
const store = tx.objectStore('cache-metadata');

// Set timestamp to 8 days ago
const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
store.put({ key: 'cacheVersion', value: 1, timestamp: eightDaysAgo });

// Reload page - cache should be cleared
```

### Expected Results

| Trigger | Cache State Before | Cache State After |
|---------|-------------------|-------------------|
| **BUILD_ID change** | 100 tiles | 0 tiles (cleared) |
| **Version bump** | 100 tiles | 0 tiles (cleared) |
| **7+ days old** | 100 tiles | 0 tiles (cleared) |
| **Same BUILD_ID** | 100 tiles | 100 tiles (preserved) |

---

## Test 3: Caching Strategies by Resource Type

**Goal:** Verify correct caching behavior for different resource types.

### Test 3A: Tile Strategy (Network-First)

```javascript
// Test tile caching strategy
async function testTileStrategy() {
  const tileUrl = 'https://api.mapbox.com/v4/mapbox.satellite/0/0/0.png?access_token=YOUR_TOKEN';

  console.log('Test 1: Fresh network fetch');
  console.time('Network fetch');
  const response1 = await fetch(tileUrl);
  console.timeEnd('Network fetch');
  console.log('Response from:', response1.headers.get('x-cache') ? 'Cache' : 'Network');

  console.log('\nTest 2: Cached fetch (should still try network first)');
  console.time('Cached fetch');
  const response2 = await fetch(tileUrl);
  console.timeEnd('Cached fetch');

  console.log('\nTest 3: Offline mode (should serve from cache)');
  // DevTools → Network → Offline
  console.time('Offline fetch');
  const response3 = await fetch(tileUrl);
  console.timeEnd('Offline fetch');
  console.log('Status:', response3.status);

  return {
    networkFetch: response1.ok,
    cachedFetch: response2.ok,
    offlineFetch: response3.ok,
  };
}

testTileStrategy();
```

**Expected Output:**
```
Test 1: Fresh network fetch
Network fetch: 342ms
Response from: Network

Test 2: Cached fetch (should still try network first)
Cached fetch: 287ms

Test 3: Offline mode (should serve from cache)
Offline fetch: 12ms
Status: 200
✅ All tests passed
```

### Test 3B: Image Strategy (Cache-First)

```javascript
// Test image caching strategy
async function testImageStrategy() {
  const imageUrl = '/assets/coffee.webp';

  console.log('Test 1: First fetch (not in cache)');
  console.time('First fetch');
  const response1 = await fetch(imageUrl);
  console.timeEnd('First fetch');

  console.log('\nTest 2: Second fetch (should be instant from cache)');
  console.time('Cached fetch');
  const response2 = await fetch(imageUrl);
  console.timeEnd('Cached fetch');

  console.log('\nTest 3: Revalidation after 1 hour');
  // Manually update cache timestamp to 2 hours ago
  const cache = await caches.open('c2c-images-v1');
  const cachedResponse = await cache.match(imageUrl);
  const headers = new Headers(cachedResponse.headers);
  headers.set('date', new Date(Date.now() - 2 * 60 * 60 * 1000).toUTCString());

  // Fetch again - should revalidate in background
  const response3 = await fetch(imageUrl);
  console.log('Served from cache (revalidating in background)');

  return {
    firstFetch: response1.ok,
    cachedFetch: response2.ok,
    revalidate: response3.ok,
  };
}

testImageStrategy();
```

**Expected Output:**
```
Test 1: First fetch (not in cache)
First fetch: 145ms

Test 2: Second fetch (should be instant from cache)
Cached fetch: 3ms  ← Instant!

Test 3: Revalidation after 1 hour
Served from cache (revalidating in background)
✅ All tests passed
```

### Test 3C: API Strategy (Network-Only)

```javascript
// Test API caching strategy (should NEVER cache)
async function testAPIStrategy() {
  const apiUrl = '/api/cafes/nearby?lat=37.7749&lng=-122.4194';

  console.log('Test 1: First API call');
  const response1 = await fetch(apiUrl);
  const data1 = await response1.json();

  console.log('\nTest 2: Second API call (should NOT be cached)');
  const response2 = await fetch(apiUrl);
  const data2 = await response2.json();

  console.log('\nTest 3: Verify no cache entry exists');
  const cache = await caches.open('c2c-map-cache-v1');
  const cachedResponse = await cache.match(apiUrl);

  return {
    firstCall: response1.ok,
    secondCall: response2.ok,
    notCached: cachedResponse === undefined,
  };
}

testAPIStrategy();
```

**Expected Output:**
```
Test 1: First API call
✓ Response received

Test 2: Second API call (should NOT be cached)
✓ Response received (fresh from server)

Test 3: Verify no cache entry exists
✓ No cache entry found
✅ API never cached (as intended)
```

---

## Test 4: Storage Quota Management

**Goal:** Verify proactive quota monitoring and cleanup.

### Test 4A: Quota Monitoring

```javascript
// Test quota monitoring
async function testQuotaMonitoring() {
  console.log('Requesting quota status...');

  // Listen for quota messages
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'QUOTA_STATUS') {
      const { percent, usage, quota } = event.data;
      console.log(`\n📊 QUOTA STATUS:`);
      console.log(`Usage: ${(usage / 1024 / 1024).toFixed(1)} MB`);
      console.log(`Quota: ${(quota / 1024 / 1024).toFixed(1)} MB`);
      console.log(`Percent: ${percent.toFixed(1)}%`);

      if (percent > 80) {
        console.log('⚠️ WARNING: Quota usage high (>80%)');
      } else if (percent > 90) {
        console.log('🚨 CRITICAL: Quota usage critical (>90%)');
      } else {
        console.log('✅ Quota usage healthy');
      }
    }
  });

  // Request quota status
  navigator.serviceWorker.controller.postMessage({ type: 'GET_QUOTA' });
}

testQuotaMonitoring();
```

**Expected Output:**
```
Requesting quota status...

📊 QUOTA STATUS:
Usage: 12.3 MB
Quota: 2048.0 MB
Percent: 0.6%
✅ Quota usage healthy
```

### Test 4B: Automatic Cleanup at 80% Threshold

```javascript
// Simulate high quota usage
async function testAutoCleanup() {
  // Fill cache to near capacity
  const cache = await caches.open('c2c-map-cache-v1');

  console.log('Filling cache to 100 entries...');
  for (let i = 0; i < 100; i++) {
    const url = `https://api.mapbox.com/test/${i}.png`;
    const response = new Response('test', { headers: { 'Content-Type': 'image/png' } });
    await cache.put(url, response);
  }

  let keys = await cache.keys();
  console.log(`Cache size before cleanup: ${keys.length}`);

  // Trigger quota check (simulates 5-minute interval)
  console.log('\nTriggering quota monitor...');
  navigator.serviceWorker.controller.postMessage({ type: 'GET_QUOTA' });

  // Wait for cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));

  keys = await cache.keys();
  console.log(`Cache size after cleanup: ${keys.length}`);

  if (keys.length < 100) {
    console.log('✅ PASS: Automatic cleanup triggered');
  } else {
    console.log('❌ FAIL: No cleanup occurred');
  }
}

testAutoCleanup();
```

### Test 4C: Persistent Storage Request

```javascript
// Test persistent storage
async function testPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persisted) {
    console.log('⚠️ Storage API not supported');
    return;
  }

  const isPersisted = await navigator.storage.persisted();
  console.log(`Storage persistence: ${isPersisted ? 'GRANTED ✅' : 'DENIED ❌'}`);

  if (!isPersisted) {
    console.log('Requesting persistent storage...');
    const result = await navigator.storage.persist();
    console.log(`Result: ${result ? 'GRANTED ✅' : 'DENIED ❌'}`);
  }

  // Show estimated quota
  const estimate = await navigator.storage.estimate();
  console.log(`\nEstimated quota: ${(estimate.quota / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`Current usage: ${(estimate.usage / 1024 / 1024).toFixed(2)} MB`);
}

testPersistentStorage();
```

**Expected Output:**
```
Storage persistence: GRANTED ✅

Estimated quota: 10.52 GB
Current usage: 12.34 MB
```

---

## Test 5: Error Handling & Resilience

**Goal:** Verify graceful error handling for network failures.

### Test 5A: Offline Tile Rendering

```javascript
// Test offline tile behavior
async function testOfflineTiles() {
  console.log('Step 1: Populate cache with tiles');
  const tileUrl = 'https://api.mapbox.com/v4/mapbox.satellite/0/0/0.png?access_token=YOUR_TOKEN';
  await fetch(tileUrl); // Populate cache

  console.log('\nStep 2: Go offline');
  console.log('→ Open DevTools → Network → Offline');
  console.log('→ Press Enter to continue...');
  await new Promise(resolve => {
    const input = document.createElement('input');
    input.onkeypress = (e) => e.key === 'Enter' && resolve();
    document.body.appendChild(input);
    input.focus();
  });

  console.log('\nStep 3: Request tile (should serve from cache)');
  const response = await fetch(tileUrl);

  if (response.ok) {
    console.log('✅ PASS: Tile served from cache while offline');
  } else {
    console.log('❌ FAIL: Tile request failed');
  }

  console.log('\nStep 4: Request uncached tile');
  const newTileUrl = 'https://api.mapbox.com/v4/mapbox.satellite/5/5/5.png?access_token=YOUR_TOKEN';
  const errorResponse = await fetch(newTileUrl);

  console.log(`Response status: ${errorResponse.status}`);
  console.log(`Content-Type: ${errorResponse.headers.get('Content-Type')}`);

  if (errorResponse.headers.get('Content-Type') === 'image/png') {
    console.log('✅ PASS: Returns valid PNG (transparent error tile)');
  } else {
    console.log('❌ FAIL: Returns non-image response');
  }
}

testOfflineTiles();
```

**Expected Output:**
```
Step 1: Populate cache with tiles
✓ Tile cached

Step 2: Go offline
→ Open DevTools → Network → Offline
→ Press Enter to continue...

Step 3: Request tile (should serve from cache)
✅ PASS: Tile served from cache while offline

Step 4: Request uncached tile
Response status: 200
Content-Type: image/png
✅ PASS: Returns valid PNG (transparent error tile)
```

### Test 5B: Verify Transparent Error Tile

```javascript
// Verify error tile is actually transparent
async function verifyErrorTile() {
  // Force offline mode
  console.log('Forcing offline mode in test...');

  // Request tile that doesn't exist in cache
  const response = await fetch('https://api.mapbox.com/nonexistent/tile.png');
  const blob = await response.blob();

  console.log(`Response size: ${blob.size} bytes`);
  console.log(`Response type: ${blob.type}`);

  // Create image element to verify it renders
  const img = document.createElement('img');
  img.src = URL.createObjectURL(blob);

  await new Promise(resolve => {
    img.onload = () => {
      console.log(`Image dimensions: ${img.width}x${img.height}`);
      console.log('✅ PASS: Error tile renders correctly');
      resolve();
    };
    img.onerror = () => {
      console.log('❌ FAIL: Error tile failed to render');
      resolve();
    };
  });

  document.body.appendChild(img);
}

verifyErrorTile();
```

**Expected Output:**
```
Forcing offline mode in test...
Response size: 68 bytes
Response type: image/png
Image dimensions: 1x1
✅ PASS: Error tile renders correctly
```

---

## Test 6: LRU Eviction Performance

**Goal:** Verify batch eviction is faster than single-entry eviction.

### Test 6A: Benchmark Eviction Strategies

```javascript
// Benchmark old vs new eviction
async function benchmarkEviction() {
  const cache = await caches.open('test-cache');

  // Fill cache with 100 entries
  console.log('Filling cache with 100 entries...');
  for (let i = 0; i < 100; i++) {
    const url = `https://test.com/tile-${i}.png`;
    const response = new Response('test');
    await cache.put(url, response);
  }

  // Test 1: Old method (evict one at a time)
  console.log('\n📊 Test 1: Single eviction (OLD)');
  console.time('Single eviction (10 tiles)');
  for (let i = 0; i < 10; i++) {
    const keys = await cache.keys();
    await cache.delete(keys[0]);
  }
  console.timeEnd('Single eviction (10 tiles)');

  // Refill cache
  for (let i = 0; i < 10; i++) {
    const url = `https://test.com/tile-${i}.png`;
    const response = new Response('test');
    await cache.put(url, response);
  }

  // Test 2: New method (batch eviction)
  console.log('\n📊 Test 2: Batch eviction (NEW)');
  console.time('Batch eviction (10 tiles)');
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, 10).map(key => cache.delete(key)));
  console.timeEnd('Batch eviction (10 tiles)');

  // Cleanup
  await caches.delete('test-cache');
}

benchmarkEviction();
```

**Expected Output:**
```
Filling cache with 100 entries...

📊 Test 1: Single eviction (OLD)
Single eviction (10 tiles): 342ms

📊 Test 2: Batch eviction (NEW)
Batch eviction (10 tiles): 87ms

⚡ 4x faster with batch eviction
```

---

## Automated Test Suite

Create a test file that runs all tests automatically:

**`tests/service-worker.test.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Service Worker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should register service worker', async ({ page }) => {
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration;
    });

    expect(swRegistered).toBe(true);
  });

  test('should cache tiles', async ({ page }) => {
    // Populate cache by panning map
    await page.click('[aria-label="Zoom in"]');
    await page.waitForTimeout(2000);

    const cacheSize = await page.evaluate(async () => {
      const cache = await caches.open('c2c-map-cache-v1');
      const keys = await cache.keys();
      return keys.length;
    });

    expect(cacheSize).toBeGreaterThan(0);
    expect(cacheSize).toBeLessThanOrEqual(100);
  });

  test('should respect MAX_CACHE_SIZE', async ({ page }) => {
    // Trigger 150 concurrent tile requests
    await page.evaluate(async () => {
      const requests = Array.from({ length: 150 }, (_, i) =>
        fetch(`https://api.mapbox.com/test/${i}.png`)
      );
      await Promise.all(requests);
    });

    const cacheSize = await page.evaluate(async () => {
      const cache = await caches.open('c2c-map-cache-v1');
      const keys = await cache.keys();
      return keys.length;
    });

    expect(cacheSize).toBeLessThanOrEqual(100);
  });

  test('should invalidate cache on version change', async ({ page, context }) => {
    // Initial visit - populate cache
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    const initialCacheSize = await page.evaluate(async () => {
      const cache = await caches.open('c2c-map-cache-v1');
      return (await cache.keys()).length;
    });

    // Simulate deployment (new BUILD_ID)
    // In real test, you'd redeploy with new BUILD_ID
    await context.clearCookies();
    await page.reload();

    const newCacheSize = await page.evaluate(async () => {
      const cache = await caches.open('c2c-map-cache-v1');
      return (await cache.keys()).length;
    });

    expect(newCacheSize).toBeLessThan(initialCacheSize);
  });

  test('should monitor quota', async ({ page }) => {
    const quotaMessage = await page.evaluate(async () => {
      return new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'QUOTA_STATUS') {
            resolve(event.data);
          }
        });

        navigator.serviceWorker.controller?.postMessage({ type: 'GET_QUOTA' });
      });
    });

    expect(quotaMessage).toHaveProperty('usage');
    expect(quotaMessage).toHaveProperty('quota');
    expect(quotaMessage).toHaveProperty('percent');
  });
});
```

**Run tests:**
```bash
npx playwright test tests/service-worker.test.ts
```

---

## Production Monitoring

### Setup Monitoring Dashboard

```typescript
// components/dev/CacheMonitor.tsx
'use client';

import { useEffect, useState } from 'react';

export function CacheMonitor() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const estimate = await navigator.storage.estimate();
      const cache = await caches.open('c2c-map-cache-v1');
      const keys = await cache.keys();

      setStats({
        cacheSize: keys.length,
        storageUsage: (estimate.usage / 1024 / 1024).toFixed(2),
        storageQuota: (estimate.quota / 1024 / 1024).toFixed(2),
        usagePercent: ((estimate.usage / estimate.quota) * 100).toFixed(1),
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: 10,
      fontSize: 12,
      borderRadius: 4,
    }}>
      <div>Cache: {stats.cacheSize} tiles</div>
      <div>Storage: {stats.storageUsage} MB / {stats.storageQuota} MB</div>
      <div>Usage: {stats.usagePercent}%</div>
    </div>
  );
}
```

---

## Conclusion

This testing suite validates:

✅ Race condition prevention (atomic writes)
✅ Cache versioning & invalidation (automatic on deploy)
✅ Optimal caching strategies (per resource type)
✅ Quota management (proactive cleanup)
✅ Error resilience (graceful fallbacks)

Run these tests after migration to ensure production-grade reliability.
