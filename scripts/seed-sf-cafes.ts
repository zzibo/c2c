#!/usr/bin/env node
/**
 * Seed San Francisco cafes database
 * 
 * Generates random points within SF bounds and fetches cafes
 * Respects Geoapify free tier limits: 3,000 requests/day
 * 
 * Usage:
 *   npm run seed-cafes
 *   or
 *   npx tsx scripts/seed-sf-cafes.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env.local');
  try {
    const envFile = readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach((line: string) => {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) return;
      
      const match = trimmed.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        value = value.replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (err) {
    console.warn('⚠️  Could not load .env.local, using existing process.env');
  }
}

loadEnvFile();

// San Francisco bounds
const SF_BOUNDS = {
  north: 37.8324,  // Northern boundary (Golden Gate Bridge)
  south: 37.7081,  // Southern boundary (Daly City)
  east: -122.3647, // Eastern boundary (Bay)
  west: -122.5150, // Western boundary (Ocean)
};

// Geoapify API limits (free tier)
const GEOAPIFY_FREE_LIMIT = 3000; // requests per day
const REQUESTS_PER_SEARCH = 1; // Each nearby search = 1 API call
const SAFE_LIMIT = Math.floor(GEOAPIFY_FREE_LIMIT * 0.9); // Use 90% to be safe

// Search parameters
const SEARCH_RADIUS_METERS = 3219; // 2 miles
const POINTS_TO_SEARCH = 50; // Number of random points to search
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests (rate limiting)

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geoapifyKey = process.env.GEOAPIFY_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!geoapifyKey) {
  console.error('❌ Missing Geoapify API key in .env.local');
  console.error('   Required: GEOAPIFY_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Generate random point within SF bounds
 */
function generateRandomPoint(): { lat: number; lng: number } {
  const lat = SF_BOUNDS.south + Math.random() * (SF_BOUNDS.north - SF_BOUNDS.south);
  const lng = SF_BOUNDS.west + Math.random() * (SF_BOUNDS.east - SF_BOUNDS.west);
  return { lat, lng };
}

/**
 * Fetch cafes from API endpoint
 */
async function fetchCafesFromAPI(lat: number, lng: number): Promise<{
  success: boolean;
  count: number;
  newCafesAdded?: number;
  cacheHit?: boolean;
  error?: string;
}> {
  try {
    // Call the Next.js API route
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/cafes/nearby?lat=${lat}&lng=${lng}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        count: 0,
        error: data.error || 'Unknown error',
      };
    }

    return {
      success: true,
      count: data.count || 0,
      newCafesAdded: data.newCafesAdded || 0,
      cacheHit: data.cacheHit || false,
    };
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Directly call Geoapify API (alternative method)
 */
async function fetchCafesDirectly(lat: number, lng: number): Promise<{
  success: boolean;
  count: number;
  newCafesAdded: number;
}> {
  const GEOAPIFY_API_URL = 'https://api.geoapify.com/v2/places';
  const MAX_RESULTS = 100;

  try {
    const url = new URL(GEOAPIFY_API_URL);
    url.searchParams.append('categories', 'catering.cafe');
    url.searchParams.append('filter', `circle:${lng},${lat},${SEARCH_RADIUS_METERS}`);
    url.searchParams.append('limit', MAX_RESULTS.toString());
    url.searchParams.append('apiKey', geoapifyKey!);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    // Store cafes in Supabase
    let newCafesCount = 0;
    const features = data.features || [];

    for (const place of features) {
      const props = place.properties;
      const placeId = props.place_id || `${props.lat}-${props.lon}`;

      try {
        const { error } = await supabase.from('cafes').insert({
          geoapify_place_id: placeId,
          osm_id: props.osm_id,
          name: props.name || props.address_line1 || 'Unknown Cafe',
          address: props.formatted || props.address_line2,
          location: `POINT(${props.lon} ${props.lat})`,
          phone: props.contact?.phone,
          website: props.website,
          last_synced_at: new Date().toISOString(),
        });

        if (!error) {
          newCafesCount++;
        } else if (error.code !== '23505') {
          // Ignore duplicate key errors (23505)
          console.error(`  ⚠️  Error inserting cafe: ${error.message}`);
        }
      } catch (err) {
        console.error(`  ⚠️  Exception inserting cafe: ${err}`);
      }
    }

    // Refresh materialized view if we added cafes
    if (newCafesCount > 0) {
      try {
        await supabase.rpc('refresh_cafe_stats');
      } catch (err) {
        console.error(`  ⚠️  Error refreshing stats: ${err}`);
      }
    }

    return {
      success: true,
      count: features.length,
      newCafesAdded: newCafesCount,
    };
  } catch (error) {
    console.error(`  ❌ API Error: ${error}`);
    return {
      success: false,
      count: 0,
      newCafesAdded: 0,
    };
  }
}

/**
 * Get current cafe count from database
 */
async function getCafeCount(): Promise<number> {
  const { count, error } = await supabase
    .from('cafes')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error getting cafe count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Sleep/delay function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main seeding function
 */
async function seedCafes() {
  console.log('🌱 Starting San Francisco cafe seeding...\n');

  // Check current cafe count
  const initialCount = await getCafeCount();
  console.log(`📊 Current cafes in database: ${initialCount}\n`);

  // Generate random points
  const points = Array.from({ length: POINTS_TO_SEARCH }, () => generateRandomPoint());
  console.log(`📍 Generated ${points.length} random points within SF bounds`);
  console.log(`   Bounds: ${SF_BOUNDS.south} to ${SF_BOUNDS.north} lat, ${SF_BOUNDS.west} to ${SF_BOUNDS.east} lng\n`);

  let totalFetched = 0;
  let totalNewCafes = 0;
  let cacheHits = 0;
  let errors = 0;
  let apiCalls = 0;

  console.log(`⚠️  Free tier limit: ${GEOAPIFY_FREE_LIMIT} requests/day`);
  console.log(`   Safe limit: ${SAFE_LIMIT} requests\n`);
  console.log('Starting searches...\n');

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    
    // Check if we're approaching the limit
    if (apiCalls >= SAFE_LIMIT) {
      console.log(`\n⚠️  Reached safe API limit (${SAFE_LIMIT} requests). Stopping...`);
      break;
    }

    console.log(`[${i + 1}/${points.length}] Searching: ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);

    // Try direct API call first (more reliable)
    const result = await fetchCafesDirectly(point.lat, point.lng);
    apiCalls++;

    if (result.success) {
      totalFetched += result.count;
      totalNewCafes += result.newCafesAdded;

      if (result.newCafesAdded > 0) {
        console.log(`   ✅ Found ${result.count} cafes, ${result.newCafesAdded} new`);
      } else {
        console.log(`   📦 Found ${result.count} cafes (all cached)`);
        cacheHits++;
      }
    } else {
      console.log(`   ❌ Failed: ${result.count}`);
      errors++;
    }

    // Rate limiting: wait between requests
    if (i < points.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // Final stats
  const finalCount = await getCafeCount();
  const totalAdded = finalCount - initialCount;

  console.log('\n' + '='.repeat(60));
  console.log('📊 SEEDING SUMMARY');
  console.log('='.repeat(60));
  console.log(`📍 Points searched: ${points.length}`);
  console.log(`☕ Cafes found: ${totalFetched}`);
  console.log(`🆕 New cafes added: ${totalNewCafes}`);
  console.log(`💾 Total cafes in DB: ${initialCount} → ${finalCount} (+${totalAdded})`);
  console.log(`📈 Cache hits: ${cacheHits}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`🔌 API calls made: ${apiCalls}`);
  console.log(`📊 Remaining API quota: ${GEOAPIFY_FREE_LIMIT - apiCalls} requests`);
  console.log('='.repeat(60));

  if (totalNewCafes > 0) {
    console.log('\n✅ Seeding completed successfully!');
  } else {
    console.log('\n💡 No new cafes added. Most cafes may already be in the database.');
  }
}

// Run the script if executed directly
seedCafes()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

export { seedCafes };

