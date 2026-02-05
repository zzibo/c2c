# Service Worker Architecture Diagrams

## Current Architecture (Monolithic)

```
┌─────────────────────────────────────────────────────────────┐
│                     /public/sw.js (500 lines)                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Install Event                                      │   │
│  │  - Precache images (IMAGE_URLS)                    │   │
│  │  - self.skipWaiting() ⚠️                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Fetch Event Handler (180 lines)                   │   │
│  │  - Manual LRU cache management (145 lines)         │   │
│  │  - Mapbox tile caching                             │   │
│  │  - Image caching                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  Issues:                                                     │
│  ❌ Monolithic (hard to test)                               │
│  ❌ Auto skipWaiting (unsafe)                               │
│  ❌ Manual LRU (145 lines)                                  │
│  ❌ No navigation preload                                   │
│  ❌ No background sync                                      │
└─────────────────────────────────────────────────────────────┘
```

See full diagram in the complete documentation file.

---

## Recommended Architecture (Modular)

See `/docs/service-worker-architecture.md` for complete architecture diagrams and flow charts.
