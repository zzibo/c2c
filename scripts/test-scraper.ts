/**
 * Test script for Google Maps scraper
 * Usage: npx ts-node scripts/test-scraper.ts
 */

import { scrapeGoogleMaps } from '../lib/scraper/googleMapsScraper';

// Example Google Maps URLs to test
const TEST_URLS = [
  // Replace with actual Google Maps cafe URLs for testing
  'https://www.google.com/maps/place/Blue+Bottle+Coffee/@37.7955419,-122.407065,17z/data=!3m1!4b1!4m6!3m5!1s0x808580a1b4f3e24b:0x7a6a9f4b4e9e4a7a!8m2!3d37.7955419!4d-122.4044901!16s%2Fg%2F11b6_0_0_0',
];

async function testScraper() {
  console.log('🧪 Testing Google Maps Scraper\n');

  for (const url of TEST_URLS) {
    try {
      console.log(`Testing URL: ${url}\n`);
      const result = await scrapeGoogleMaps(url);

      console.log('✅ Scraping successful!');
      console.log('Cafe Data:', JSON.stringify(result, null, 2));
      console.log('\n' + '='.repeat(80) + '\n');

    } catch (error) {
      console.error('❌ Scraping failed:', error);
      console.log('\n' + '='.repeat(80) + '\n');
    }
  }

  console.log('Test complete!');
  process.exit(0);
}

testScraper();
