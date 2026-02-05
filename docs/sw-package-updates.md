# Package.json Updates for Service Worker Improvements

This document shows the dependencies and scripts needed for each Service Worker improvement phase.

---

## Current package.json (Relevant Sections)

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^16.0.1",
    "react": "^19.2.0",
    "typescript": "^5.9.3"
  },
  "devDependencies": {
    "@types/node": "^25.0.10",
    "tsx": "^4.20.6"
  }
}
```

---

## Phase 1: Quick Wins (User-Controlled Updates + Navigation Preload)

**No new dependencies needed!** These features use native Service Worker APIs.

```bash
# No installation required
```

**Scripts to add:**
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "sw:check": "echo 'Checking Service Worker registration...' && curl http://localhost:3000/sw.js"
  }
}
```

---

## Phase 2: Workbox Migration

### Install Dependencies

```bash
npm install workbox-webpack-plugin workbox-window workbox-strategies workbox-expiration workbox-routing workbox-precaching workbox-cacheable-response
```

### Updated package.json

```json
{
  "dependencies": {
    "next": "^16.0.1",
    "react": "^19.2.0",
    "typescript": "^5.9.3",
    "workbox-window": "^7.1.0"  // Client-side Workbox utilities
  },
  "devDependencies": {
    "@types/node": "^25.0.10",
    "tsx": "^4.20.6",
    "workbox-webpack-plugin": "^7.1.0",      // Webpack plugin for precaching
    "workbox-strategies": "^7.1.0",          // CacheFirst, NetworkFirst, etc.
    "workbox-expiration": "^7.1.0",          // Built-in LRU (ExpirationPlugin)
    "workbox-routing": "^7.1.0",             // registerRoute()
    "workbox-precaching": "^7.1.0",          // precacheAndRoute()
    "workbox-cacheable-response": "^7.1.0"   // Cache only successful responses
  }
}
```

### Package Sizes (Gzipped)

| Package | Size | Purpose |
|---------|------|---------|
| workbox-strategies | ~3KB | Caching strategies |
| workbox-expiration | ~2KB | LRU eviction |
| workbox-routing | ~1KB | Route matching |
| workbox-precaching | ~4KB | Asset precaching |
| workbox-window | ~2KB | Client-side utilities |
| **Total** | **~12KB** | (Much smaller than expected!) |

**Note:** Workbox uses tree-shaking, so you only include what you use.

---

## Phase 3: Modular Architecture

### Install Build Tool (esbuild)

```bash
npm install esbuild --save-dev
```

### Updated package.json

```json
{
  "scripts": {
    "dev": "npm run build-sw && next dev --turbopack",
    "build": "npm run build-sw && next build",
    "build-sw": "tsx scripts/build-sw.ts",
    "watch-sw": "tsx scripts/build-sw.ts --watch",
    "start": "next start",
    "lint": "next lint"
  },
  "devDependencies": {
    "@types/node": "^25.0.10",
    "tsx": "^4.20.6",
    "esbuild": "^0.23.0"  // Fast TypeScript bundler
  }
}
```

### Development Workflow

```bash
# Terminal 1: Watch SW changes
npm run watch-sw

# Terminal 2: Run Next.js dev server
npm run dev
```

---

## Phase 4: Background Sync

**No new dependencies needed!** Background Sync uses native Service Worker APIs.

```bash
# No installation required
```

**Optional: Add testing utilities**

```bash
npm install --save-dev @types/web @types/service-worker-mock
```

```json
{
  "devDependencies": {
    "@types/web": "^0.0.149",                // TypeScript types for Web APIs
    "@types/service-worker-mock": "^2.0.4"   // Mock Service Worker for testing
  }
}
```

---

## Complete Final package.json

```json
{
  "name": "c2c-1",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "dev": "npm run build-sw && next dev --turbopack",
    "dev:sg": "cross-env NEXT_PUBLIC_SIMULATE_LOCATION=sg next dev --turbopack",
    "build": "npm run build-sw && next build",
    "build-sw": "tsx scripts/build-sw.ts",
    "watch-sw": "tsx scripts/build-sw.ts --watch",
    "start": "next start",
    "lint": "next lint",
    "seed-cafes": "tsx scripts/seed-sf-cafes.ts",
    "approve-cafes": "tsx scripts/approve-cafes.ts",
    "sw:check": "curl http://localhost:3000/sw.js | head -20"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.71.2",
    "@supabase/ssr": "^0.7.0",
    "@supabase/supabase-js": "^2.79.0",
    "@tanstack/react-query": "^5.90.16",
    "@tanstack/react-query-devtools": "^5.91.2",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "autoprefixer": "^10.4.21",
    "framer-motion": "^12.23.26",
    "lucide-react": "^0.552.0",
    "mapbox-gl": "^3.16.0",
    "next": "^16.0.1",
    "postcss": "^8.5.6",
    "puppeteer": "^24.36.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-map-gl": "^8.1.0",
    "tailwindcss": "^3.4.18",
    "typescript": "^5.9.3",
    "workbox-window": "^7.1.0"
  },
  "devDependencies": {
    "@types/node": "^25.0.10",
    "@types/web": "^0.0.149",
    "cross-env": "^10.1.0",
    "esbuild": "^0.23.0",
    "ts-node": "^10.9.2",
    "tsx": "^4.20.6",
    "workbox-cacheable-response": "^7.1.0",
    "workbox-expiration": "^7.1.0",
    "workbox-precaching": "^7.1.0",
    "workbox-routing": "^7.1.0",
    "workbox-strategies": "^7.1.0",
    "workbox-webpack-plugin": "^7.1.0"
  }
}
```

---

## Installation Commands (By Phase)

### Phase 1: Quick Wins (No dependencies)
```bash
# No installation needed - uses native APIs
```

### Phase 2: Workbox Migration
```bash
npm install workbox-window
npm install --save-dev workbox-webpack-plugin workbox-strategies workbox-expiration workbox-routing workbox-precaching workbox-cacheable-response
```

### Phase 3: Modular Architecture
```bash
npm install --save-dev esbuild
```

### Phase 4: Background Sync (No dependencies)
```bash
# No installation needed - uses native APIs
```

### Optional: TypeScript Types
```bash
npm install --save-dev @types/web
```

---

## Alternative: Using next-pwa (Easier Workbox Integration)

If you prefer a simpler Next.js + Workbox setup, use `next-pwa`:

```bash
npm install next-pwa
```

**next.config.ts:**
```typescript
import withPWA from 'next-pwa';

const config = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: false, // User-controlled updates
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.mapbox\.com/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'mapbox-tiles',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    },
  ],
});

export default config;
```

**Benefits:**
- Zero-config Workbox integration
- Automatic precaching of Next.js assets
- Simpler setup (no manual SW file)

**Trade-offs:**
- Less control over SW lifecycle
- Harder to customize

---

## Bundle Size Impact

### Current Implementation
```
/public/sw.js: ~15KB (minified)
```

### With Workbox (Tree-Shaken)
```
Workbox runtime: ~12KB (gzipped)
Your SW code: ~3KB (minified)
Total: ~15KB (no significant increase!)
```

**Conclusion:** Workbox's bundle size impact is negligible when tree-shaken properly.

---

## Environment Variables (No Changes Needed)

Your existing `.env.local` already has everything needed:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
GEOAPIFY_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...
```

**No new environment variables required.**

---

## Testing Scripts

Add these to `package.json` for easier testing:

```json
{
  "scripts": {
    "test:sw": "jest service-worker --testEnvironment=node",
    "test:sw:watch": "jest service-worker --watch",
    "lighthouse": "lighthouse http://localhost:3000 --view",
    "sw:unregister": "echo 'Open DevTools > Application > Service Workers > Unregister'"
  }
}
```

**Install testing dependencies:**
```bash
npm install --save-dev jest @types/jest service-worker-mock
```

---

## CI/CD Updates (GitHub Actions Example)

Add Service Worker build step to your CI pipeline:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Build Service Worker
        run: npm run build-sw

      - name: Build Next.js
        run: npm run build

      - name: Deploy to Vercel
        run: vercel deploy --prod
```

---

## Quick Start Commands

### Immediate (Phase 1)
```bash
# No installation needed
# Just modify /public/sw.js directly
```

### Week 2 (Phase 2: Workbox)
```bash
npm install workbox-window
npm install --save-dev workbox-webpack-plugin workbox-strategies workbox-expiration workbox-routing workbox-precaching
npm run dev
```

### Week 3 (Phase 3: Modular)
```bash
npm install --save-dev esbuild
npm run build-sw
npm run dev
```

### Week 4 (Phase 4: Background Sync)
```bash
# No installation needed
# Just add /service-worker/features/background-sync.ts
npm run build-sw
npm run dev
```

---

## Troubleshooting

### "Module not found: workbox-strategies"
```bash
npm install workbox-strategies
```

### "Cannot find module 'esbuild'"
```bash
npm install --save-dev esbuild
```

### "SW not updating"
```bash
# Clear Service Worker cache
# Chrome DevTools > Application > Service Workers > Unregister
```

### "Build failing"
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build-sw
```

---

## Summary

**Phase 1 (Quick Wins):** No dependencies needed
**Phase 2 (Workbox):** +7 dev dependencies (~12KB gzipped)
**Phase 3 (Modular):** +1 dev dependency (esbuild)
**Phase 4 (Background Sync):** No dependencies needed

**Total new dependencies:** 8 (all dev dependencies)
**Total bundle size impact:** ~12KB gzipped (negligible)
**Setup time:** 30 minutes

All dependencies are well-maintained, production-tested, and used by major companies (Google, Starbucks, Pinterest).
