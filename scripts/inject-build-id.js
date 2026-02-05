/**
 * Inject build timestamp into service worker for cache versioning
 * Run this before each production build
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', 'public', 'sw-improved.js');
const BUILD_ID = Date.now().toString();

try {
  let content = fs.readFileSync(SW_PATH, 'utf8');

  // Replace {{BUILD_ID}} placeholder with actual timestamp
  content = content.replace(/const BUILD_ID = '{{BUILD_ID}}';/, `const BUILD_ID = '${BUILD_ID}';`);

  // Also update existing BUILD_ID if already injected
  content = content.replace(/const BUILD_ID = '\d+';/, `const BUILD_ID = '${BUILD_ID}';`);

  fs.writeFileSync(SW_PATH, content);

  console.log(`✅ Injected BUILD_ID: ${BUILD_ID} into service worker`);
  console.log(`   This will trigger cache invalidation on deployment`);
} catch (error) {
  console.error('❌ Failed to inject BUILD_ID:', error.message);
  process.exit(1);
}
