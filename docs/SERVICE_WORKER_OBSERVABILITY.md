# Service Worker Observability Guide

## Overview

This document describes the Google-scale observability system implemented for the C2C Service Worker. The system provides comprehensive logging, performance monitoring, error tracking, and real-time debugging capabilities.

---

## Architecture

### 1. Structured Logging System (`/public/sw-logger.js`)

A production-ready logging framework that works natively in Service Worker context without relying on `process.env.NODE_ENV`.

#### Features

- **Context-aware log levels**: Automatically detects localhost vs. production
- **Buffered log aggregation**: Batches logs for efficient analytics transmission
- **Performance metrics**: Tracks cache hits, network latency, LRU evictions
- **Session tracking**: Unique session IDs for debugging user-specific issues
- **Automatic metric reporting**: Flushes metrics every 60 seconds

#### Log Levels

```javascript
logger.debug('CATEGORY', 'message', { data });  // Development only
logger.info('CATEGORY', 'message', { data });   // Production + development
logger.warn('CATEGORY', 'message', { data });   // Warnings
logger.error('CATEGORY', 'message', { data });  // Errors (increments error counter)
```

#### Usage in Service Worker

```javascript
// Import at top of sw.js
importScripts('/sw-logger.js');

// Use throughout your SW
logger.info('CACHE', 'Cache hit', { url, duration: '45ms' });
logger.recordCacheHit(url, true); // Automatic metrics tracking
logger.recordNetworkRequest(url, true, 150); // Track network perf
```

#### Dynamic Log Level Control

```javascript
// From dev tools console
navigator.serviceWorker.controller.postMessage({
  type: 'SET_LOG_LEVEL',
  payload: { level: 'debug' }
});

// Or use URL query param for specific users
// https://yourapp.com?sw_debug=true
```

---

### 2. Enhanced Service Worker (`/public/sw.js`)

The SW is fully instrumented with performance tracking at every critical path.

#### Instrumented Operations

**Install Event**
- Tracks precaching duration
- Logs failed asset loads
- Reports success/failure metrics

**Activate Event**
- Logs cache cleanup operations
- Tracks LRU state loading time
- Reports activation duration

**Fetch Event - Images**
- Cache hit/miss tracking
- Network latency measurement
- Image size validation logging
- Error handling with context

**Fetch Event - Mapbox Tiles**
- Cache hit rate monitoring
- LRU eviction tracking with age
- Network failure detection
- Stale cache fallback logging
- Cache utilization warnings

**LRU Operations**
- Eviction logging with entry age
- Fallback mode detection
- IndexedDB operation timing

#### Example Logs in Console

```
[SW ℹ️] LIFECYCLE: Service Worker installing
[SW ℹ️] INSTALL: Precached images (count: 11, duration: 234ms)
[SW ℹ️] LIFECYCLE: Service Worker activated (duration: 456ms)
[SW 🔍] CACHE: Cache HIT (url: https://api.mapbox.com/v4/...)
[SW ℹ️] LRU: Evicted LRU entry (url: ..., age: 15.3m, duration: 12ms)
[SW ❌] TILE: Network fetch failed (url: ..., error: Failed to fetch)
```

---

### 3. Real-Time SW Inspector Component

**Location:** `/components/debug/ServiceWorkerInspector.tsx`

A React component that provides a Chrome DevTools-style interface for inspecting Service Worker state in real-time.

#### Features

**Metrics Tab**
- Cache hit rate (%)
- Uptime
- Cache hits/misses counters
- Network request/failure counters
- LRU eviction count
- Error count
- Session ID and last update time

**Cache Info Tab**
- Mapbox tile cache utilization
- Image cache size
- LRU tracker entry count
- Total cache size (MB)

**LRU State Tab**
- Live view of all LRU entries
- Entry age visualization
- URL inspection
- Sorted by timestamp

**Actions Tab**
- Refresh metrics on demand
- Clear tile cache
- Clear image cache
- Set log level (debug/info/warn/error)
- Auto-refresh toggle (2s interval)

#### Usage

```tsx
// In your app layout or page
import { ServiceWorkerInspector } from '@/components/debug/ServiceWorkerInspector';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <ServiceWorkerInspector />
    </>
  );
}
```

A floating button appears in the bottom-right corner. Click to open the inspector panel.

#### Production Deployment

**Option 1: Development Only**
```tsx
{process.env.NODE_ENV === 'development' && <ServiceWorkerInspector />}
```

**Option 2: Feature Flag (Recommended)**
```tsx
{user?.role === 'admin' && <ServiceWorkerInspector />}
```

**Option 3: URL Parameter**
```tsx
{searchParams.get('sw_debug') === 'true' && <ServiceWorkerInspector />}
```

---

### 4. Analytics Endpoint

**Location:** `/app/api/analytics/sw-logs/route.ts`

A Next.js API route that receives batched logs from the Service Worker.

#### Capabilities

- Structured log ingestion
- Error rate monitoring with alerts
- Cache hit rate alerts
- Integration points for:
  - Datadog
  - New Relic
  - Google Cloud Logging
  - Supabase (historical storage)

#### Automatic Alerts

**High Error Rate**
```
Triggers when: error rate > 10%
Action: Console error + (optional) PagerDuty/Slack alert
```

**Low Cache Hit Rate**
```
Triggers when: hit rate < 50% AND total requests > 20
Action: Console warning
```

#### Integration Examples

**Datadog**
```typescript
await fetch('https://http-intake.logs.datadoghq.com/v1/input', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'DD-API-KEY': process.env.DATADOG_API_KEY
  },
  body: JSON.stringify({
    ddsource: 'service-worker',
    service: 'c2c-web',
    message: payload
  })
});
```

**New Relic**
```typescript
await fetch('https://log-api.newrelic.com/log/v1', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Api-Key': process.env.NEW_RELIC_INSERT_KEY
  },
  body: JSON.stringify({
    timestamp: Date.now(),
    attributes: payload.metrics
  })
});
```

---

## Message Protocol

The Service Worker supports a message-based API for real-time inspection.

### Supported Messages

#### GET_METRICS
```javascript
const response = await sendSWMessage('GET_METRICS');
// Returns: { type: 'METRICS', data: SWMetrics }
```

#### GET_CACHE_INFO
```javascript
const response = await sendSWMessage('GET_CACHE_INFO');
// Returns: { type: 'CACHE_INFO', data: CacheInfo }
```

#### GET_LRU_STATE
```javascript
const response = await sendSWMessage('GET_LRU_STATE');
// Returns: { type: 'LRU_STATE', data: LRUEntry[] }
```

#### CLEAR_CACHE
```javascript
const response = await sendSWMessage('CLEAR_CACHE', {
  cacheName: 'c2c-map-cache-v1'
});
// Returns: { type: 'CACHE_CLEARED', data: { success: boolean } }
```

#### SET_LOG_LEVEL
```javascript
const response = await sendSWMessage('SET_LOG_LEVEL', {
  level: 'debug'
});
// Returns: { type: 'LOG_LEVEL_CHANGED', data: { level: string } }
```

#### HEALTH_CHECK
```javascript
const response = await sendSWMessage('HEALTH_CHECK');
// Returns: { type: 'HEALTH_CHECK_RESPONSE', data: { status, uptime } }
```

#### FORCE_METRICS_FLUSH
```javascript
const response = await sendSWMessage('FORCE_METRICS_FLUSH');
// Forces immediate log flush to analytics endpoint
```

### Message Implementation

```typescript
function sendSWMessage(type: string, payload?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
      resolve(event.data);
    };

    navigator.serviceWorker.controller?.postMessage(
      { type, payload },
      [messageChannel.port2]
    );

    setTimeout(() => reject(new Error('Timeout')), 5000);
  });
}
```

---

## Health Checks & Self-Healing

### Automatic Health Monitoring

The SW includes a built-in health check system:

```javascript
// In sw.js
let lastHealthCheck = Date.now();
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

setInterval(() => {
  const timeSinceLastCheck = Date.now() - lastHealthCheck;
  if (timeSinceLastCheck > HEALTH_CHECK_INTERVAL * 2) {
    logger.warn('HEALTH', 'No health check received in a while', {
      lastCheck: `${(timeSinceLastCheck / 1000).toFixed(0)}s ago`
    });
  }
}, HEALTH_CHECK_INTERVAL);
```

### Client-Side Health Pinger

Implement in your app:

```typescript
// hooks/useServiceWorkerHealth.ts
export function useServiceWorkerHealth() {
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await sendSWMessage('HEALTH_CHECK');
      } catch (error) {
        console.error('SW health check failed:', error);
        // Trigger SW re-registration if needed
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);
}
```

### Self-Healing Mechanisms

**LRU Map Corruption Recovery**
```javascript
// In evictLRUEntry()
if (lruMap.size === 0) {
  // Fallback: rebuild LRU from cache keys
  const keys = await cache.keys();
  logger.warn('LRU', 'LRU map empty, using fallback eviction');
  // ... recovery logic
}
```

**IndexedDB Failure Handling**
```javascript
// In loadLRUState()
catch (error) {
  logger.warn('LRU', 'LRU state initialization failed, starting fresh');
  lruMap = new Map();
  return lruMap; // Graceful degradation
}
```

---

## Performance Metrics

### Key Metrics Tracked

| Metric | Description | Good Threshold |
|--------|-------------|----------------|
| Cache Hit Rate | % of requests served from cache | > 70% |
| Network Latency | Average network request time | < 500ms |
| Cache Size | Number of cached entries | < 90% of MAX_CACHE_SIZE |
| LRU Evictions | Rate of evictions per hour | Trend monitoring |
| Error Rate | Errors / Total requests | < 5% |
| Uptime | SW session duration | N/A (tracking) |

### Metric Collection

Metrics are automatically collected and sent to `/api/analytics/sw-logs` every 60 seconds:

```javascript
logger.startMetricsReporting(60000); // Auto-started in sw-logger.js
```

### Manual Metrics Inspection

```javascript
// From browser console
const metrics = await sendSWMessage('GET_METRICS');
console.table(metrics.data);
```

---

## Debugging Workflows

### Scenario 1: User Reports Slow Map Loading

1. **Enable debug mode** for that user
   ```
   Send user link: https://app.com?sw_debug=true
   ```

2. **Ask user to open SW Inspector**
   - Click floating "SW Inspector" button
   - Check Metrics tab for cache hit rate
   - Check Cache Info tab for utilization

3. **Review logs in console**
   ```
   Look for:
   - High cache miss rate
   - Network failures
   - Slow tile fetch times
   ```

4. **Check backend logs**
   ```
   Search /api/analytics/sw-logs for sessionId
   Review error patterns
   ```

### Scenario 2: Cache Not Working

1. **Verify SW is active**
   ```javascript
   navigator.serviceWorker.getRegistration().then(reg => {
     console.log('SW State:', reg.active?.state);
   });
   ```

2. **Check cache info**
   ```javascript
   const info = await sendSWMessage('GET_CACHE_INFO');
   console.log('Tile cache entries:', info.data.tiles.count);
   ```

3. **Inspect LRU state**
   - Open SW Inspector
   - Go to LRU State tab
   - Verify entries are being tracked

4. **Clear and rebuild cache**
   ```javascript
   await sendSWMessage('CLEAR_CACHE', { cacheName: 'c2c-map-cache-v1' });
   // Pan map to trigger fresh cache population
   ```

### Scenario 3: High Error Rate Alert

1. **Check analytics logs**
   ```
   Search for: [SW Analytics] HIGH ERROR RATE ALERT
   Note sessionId for affected users
   ```

2. **Identify error patterns**
   ```
   Filter logs by level: 'error'
   Group by category and message
   ```

3. **Common causes**
   - Network connectivity issues
   - API rate limiting (Mapbox)
   - Stale service worker version
   - Browser cache storage quota exceeded

4. **Resolution**
   - Deploy SW hotfix if code issue
   - Scale API quota if rate limiting
   - Implement cache size limits if quota issue

---

## Production Deployment Checklist

- [ ] Set log level to 'info' in production (auto-detected by hostname)
- [ ] Configure analytics endpoint with your monitoring service
- [ ] Set up alerts for high error rates (> 10%)
- [ ] Set up alerts for low cache hit rates (< 50%)
- [ ] Implement SW version monitoring
- [ ] Add SW metrics to your observability dashboard
- [ ] Test SW Inspector in staging environment
- [ ] Document runbook for common SW issues
- [ ] Set up PagerDuty/Slack alerts for critical SW failures
- [ ] Configure log retention policy (GDPR compliance)

---

## Best Practices

### 1. Log Retention
- Keep detailed logs for 7 days
- Aggregate metrics for 90 days
- Archive critical errors indefinitely

### 2. Privacy Considerations
- Don't log PII in URLs (user IDs, tokens)
- Redact sensitive query parameters
- Use session IDs instead of user IDs

### 3. Performance
- Batch log flushes (default: 100 entries)
- Use fire-and-forget for non-critical operations
- Avoid blocking fetch handlers with logging

### 4. Error Handling
- Always catch and log errors
- Provide fallbacks for critical paths
- Surface errors to analytics, not users

### 5. Testing
- Test SW update scenarios
- Verify metrics accuracy with known workloads
- Simulate network failures in staging

---

## Integration with Existing Tools

### Google Analytics (Web Vitals)
```typescript
// Send SW metrics as custom events
gtag('event', 'sw_metrics', {
  cache_hit_rate: metrics.hitRate,
  session_id: metrics.sessionId
});
```

### Sentry
```typescript
// Report SW errors to Sentry
Sentry.captureException(error, {
  tags: { source: 'service-worker' },
  contexts: { sw: logger.getMetrics() }
});
```

### Vercel Analytics
```typescript
// Track SW performance in Vercel
import { track } from '@vercel/analytics';
track('sw_cache_hit_rate', { value: parseFloat(hitRate) });
```

---

## Troubleshooting

### Logs Not Appearing

**Problem:** No logs in console
- Check if SW is active: `navigator.serviceWorker.controller`
- Verify `importScripts('/sw-logger.js')` at top of sw.js
- Check browser console for SW errors

### Metrics Not Updating

**Problem:** Inspector shows stale data
- Enable auto-refresh in Actions tab
- Manually click "Refresh Metrics"
- Check if SW is responding to messages
- Verify MessageChannel API is supported

### Analytics Endpoint Not Receiving Logs

**Problem:** No logs in `/api/analytics/sw-logs`
- Check CORS settings (SW can't always fetch to same-origin)
- Verify endpoint is deployed and accessible
- Check SW logger.flush() is being called
- Look for network errors in console

---

## Further Reading

- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web.dev: Service Worker Lifecycle](https://web.dev/service-worker-lifecycle/)
- [Chrome DevTools: Debug Service Workers](https://developer.chrome.com/docs/devtools/progressive-web-apps/)
- [Google Workbox: Production Service Workers](https://developers.google.com/web/tools/workbox)

---

## Support

For issues or questions about the observability system:
1. Check this documentation first
2. Review SW Inspector metrics and logs
3. Search backend analytics for error patterns
4. File an issue with sessionId and reproduction steps
