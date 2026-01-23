/**
 * Cafe Approver Agent - Scraper Wrapper
 * Wrapper around Google Maps scraper with retry logic
 */

import {
  scrapeGoogleMaps,
  isValidGoogleMapsUrl,
  GoogleMapsCafeData,
} from '@/lib/scraper/googleMapsScraper';
import { ScrapedCafeData } from './types';
import { MAX_RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS } from './constants';

// Re-export validation function
export { isValidGoogleMapsUrl };

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert GoogleMapsCafeData to our ScrapedCafeData format
 */
function convertScrapedData(data: GoogleMapsCafeData): ScrapedCafeData {
  return {
    name: data.name,
    address: data.address,
    location: data.location,
    phone: data.phone,
    website: data.website,
    photos: data.photos,
    hours: data.hours,
    rating: data.rating,
    totalReviews: data.totalReviews,
  };
}

/**
 * Scrape Google Maps URL with exponential backoff retry
 * @param url Google Maps URL to scrape
 * @param maxAttempts Maximum retry attempts (default: MAX_RETRY_ATTEMPTS)
 * @param baseDelayMs Base delay for exponential backoff (default: RETRY_BASE_DELAY_MS)
 * @returns Scraped cafe data
 * @throws Error if all attempts fail
 */
export async function scrapeWithRetry(
  url: string,
  maxAttempts: number = MAX_RETRY_ATTEMPTS,
  baseDelayMs: number = RETRY_BASE_DELAY_MS
): Promise<ScrapedCafeData> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`  Scraping attempt ${attempt}/${maxAttempts}...`);
      const data = await scrapeGoogleMaps(url);
      return convertScrapedData(data);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`  Attempt ${attempt} failed: ${lastError.message}`);

      // Don't wait after the last attempt
      if (attempt < maxAttempts) {
        // Exponential backoff: 2s, 4s, 8s, etc.
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`  Waiting ${delayMs / 1000}s before retry...`);
        await sleep(delayMs);
      }
    }
  }

  throw new Error(
    `Failed to scrape URL after ${maxAttempts} attempts: ${lastError?.message || 'Unknown error'}`
  );
}
