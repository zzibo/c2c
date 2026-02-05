/**
 * Service Worker Build Script
 *
 * Bundles modular SW TypeScript into a single /public/sw.js file.
 * Run: npm run build-sw
 */

import { build } from 'esbuild';
import { resolve } from 'path';

async function buildServiceWorker() {
  console.log('🔨 Building Service Worker...');

  try {
    await build({
      entryPoints: [resolve(__dirname, '../service-worker/sw-modular.ts')],
      bundle: true,
      outfile: resolve(__dirname, '../public/sw.js'),
      format: 'iife', // Service Workers use IIFE, not ESM
      target: 'es2020',
      platform: 'browser',
      minify: process.env.NODE_ENV === 'production',
      sourcemap: process.env.NODE_ENV !== 'production',
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
    });

    console.log('✅ Service Worker built successfully: /public/sw.js');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildServiceWorker();
