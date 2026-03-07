import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/**
 * Google Maps Cafe Data Interface
 * Matches the cafe table schema
 */
export interface GoogleMapsCafeData {
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  phone?: string;
  website?: string;
  photos: string[];
  hours?: Record<string, string>;
  rating?: number;
  totalReviews?: number;
  priceLevel?: string;
  placeType?: string; // e.g., "Coffee shop", "Cafe", "Restaurant", "Bar"
}

/**
 * Scrapes cafe data from a Google Maps URL
 * @param url - Google Maps URL for the cafe
 * @returns Cafe data extracted from Google Maps
 */
export async function scrapeGoogleMaps(url: string): Promise<GoogleMapsCafeData> {
  let browser: Browser | null = null;

  try {
    // Launch headless browser (uses @sparticuz/chromium on serverless, local Chrome in dev)
    const executablePath = process.env.CHROME_EXECUTABLE_PATH || await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });

    const page: Page = await browser.newPage();

    // Set viewport and user agent to avoid detection
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to Google Maps URL
    console.log('Navigating to:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for the place details to load
    await page.waitForSelector('h1', { timeout: 10000 });

    // Extract cafe data
    const cafeData = await page.evaluate(() => {
      const data: Partial<GoogleMapsCafeData> = {};

      // Extract name
      const nameElement = document.querySelector('h1');
      data.name = nameElement?.textContent?.trim() || '';

      // Extract place type (category like "Coffee shop", "Restaurant", etc.)
      // It's usually in a button element right after the name, containing the category
      const categoryButton = document.querySelector('button[jsaction*="category"]');
      if (categoryButton) {
        data.placeType = categoryButton.textContent?.trim() || '';
      }

      // Fallback: look for category in the header area near the name
      if (!data.placeType) {
        // The category often appears as a span/div near the h1 with specific styling
        const headerArea = document.querySelector('div[role="main"]');
        if (headerArea) {
          // Look for text that matches common place types
          const allText = headerArea.textContent || '';
          const placeTypePatterns = [
            'Coffee shop', 'Cafe', 'Café', 'Espresso bar', 'Coffee roasters',
            'Restaurant', 'Seafood restaurant', 'American restaurant', 'Italian restaurant',
            'Bar', 'Wine bar', 'Cocktail bar', 'Pub', 'Brewery',
            'Bakery', 'Dessert shop', 'Ice cream shop',
            'Fast food restaurant', 'Pizza restaurant', 'Sandwich shop',
            'Breakfast restaurant', 'Brunch restaurant',
            'Tea house', 'Bubble tea store',
            'Grocery store', 'Supermarket', 'Convenience store',
            'Hotel', 'Landmark', 'Park', 'Museum', 'Store'
          ];
          for (const pattern of placeTypePatterns) {
            if (allText.includes(pattern)) {
              data.placeType = pattern;
              break;
            }
          }
        }
      }

      // Extract address
      const addressButton = Array.from(document.querySelectorAll('button[data-item-id^="address"]')).find(
        (btn) => btn.getAttribute('data-item-id')?.includes('address')
      );
      data.address = addressButton?.getAttribute('aria-label')?.replace('Address: ', '') || '';

      // Extract phone
      const phoneButton = Array.from(document.querySelectorAll('button[data-item-id^="phone"]')).find(
        (btn) => btn.getAttribute('data-item-id')?.includes('phone')
      );
      const phoneText = phoneButton?.getAttribute('aria-label')?.replace('Phone: ', '');
      if (phoneText) {
        data.phone = phoneText;
      }

      // Extract website
      const websiteLink = Array.from(document.querySelectorAll('a[data-item-id^="authority"]')).find(
        (link) => link.getAttribute('data-item-id')?.includes('authority')
      ) as HTMLAnchorElement;
      if (websiteLink?.href) {
        data.website = websiteLink.href;
      }

      // Extract rating and review count
      const ratingElement = document.querySelector('div[jsaction*="pane.rating"]');
      if (ratingElement) {
        const ratingText = ratingElement.textContent || '';
        const ratingMatch = ratingText.match(/([\d.]+)/);
        if (ratingMatch) {
          data.rating = parseFloat(ratingMatch[1]);
        }

        const reviewMatch = ratingText.match(/([\d,]+)\s+reviews?/i);
        if (reviewMatch) {
          data.totalReviews = parseInt(reviewMatch[1].replace(/,/g, ''));
        }
      }

      // Extract photos (first 5 image URLs)
      const images = Array.from(document.querySelectorAll('button[jsaction*="photo"] img'))
        .slice(0, 5)
        .map((img) => (img as HTMLImageElement).src)
        .filter((src) => src && !src.includes('maps/api/js'));
      data.photos = images;

      // Extract hours
      const hoursButton = document.querySelector('button[data-item-id*="oh"]');
      if (hoursButton) {
        const hoursText = hoursButton.getAttribute('aria-label') || '';
        // This is simplified - hours parsing can be more complex
        data.hours = { summary: hoursText };
      }

      return data as GoogleMapsCafeData;
    });

    // Extract coordinates from the FINAL page URL (after redirects)
    // Short URLs (maps.app.goo.gl) redirect to full URLs with coordinates
    const finalUrl = await page.url();
    console.log('Final URL after redirect:', finalUrl);

    const coords = extractCoordinatesFromUrl(finalUrl);
    if (coords) {
      cafeData.location = coords;
    } else {
      // Fallback: try original URL (in case it had coordinates)
      const coordsFromOriginal = extractCoordinatesFromUrl(url);
      if (coordsFromOriginal) {
        cafeData.location = coordsFromOriginal;
      } else {
        throw new Error('Could not extract coordinates from Google Maps URL');
      }
    }

    console.log('Scraped cafe data:', cafeData);
    return cafeData as GoogleMapsCafeData;

  } catch (error) {
    console.error('Error scraping Google Maps:', error);
    throw new Error(`Failed to scrape Google Maps: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extracts latitude and longitude from Google Maps URL
 * Handles various Google Maps URL formats
 *
 * IMPORTANT: Priority order matters!
 * - !3d[lat]!4d[lng] = ACTUAL place marker coordinates (preferred)
 * - @lat,lng = Map viewport center (fallback, less accurate)
 */
function extractCoordinatesFromUrl(url: string): { lat: number; lng: number } | null {
  try {
    // Format 1 (PREFERRED): !3d[lat]!4d[lng] - actual place coordinates
    const exclamationMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (exclamationMatch) {
      return {
        lat: parseFloat(exclamationMatch[1]),
        lng: parseFloat(exclamationMatch[2]),
      };
    }

    // Format 2 (FALLBACK): @lat,lng,zoom - map center (less accurate)
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return {
        lat: parseFloat(atMatch[1]),
        lng: parseFloat(atMatch[2]),
      };
    }

    // Format 3: ?q=lat,lng
    const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) {
      return {
        lat: parseFloat(qMatch[1]),
        lng: parseFloat(qMatch[2]),
      };
    }

    return null;
  } catch (error) {
    console.error('Error extracting coordinates:', error);
    return null;
  }
}

/**
 * Validates if a URL is a valid Google Maps URL
 *
 * Supported formats:
 * - Full URL: https://www.google.com/maps/place/...
 * - Full URL: https://maps.google.com/maps/place/...
 * - Short URL: https://maps.app.goo.gl/... (will redirect to full URL)
 * - Short URL: https://goo.gl/maps/...
 */
export function isValidGoogleMapsUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Short URL format: maps.app.goo.gl/xxx (official Google Maps share links)
    if (hostname === 'maps.app.goo.gl') {
      return true;
    }

    // Legacy short URL: goo.gl/maps/xxx (only allow /maps/ path for safety)
    if (hostname === 'goo.gl' && urlObj.pathname.startsWith('/maps/')) {
      return true;
    }

    // Full URL format: google.com/maps/place/... or maps.google.com/...
    if (hostname.includes('google.com') || hostname.includes('maps.google.com')) {
      return (
        urlObj.pathname.includes('/maps/place/') ||
        urlObj.pathname.includes('/maps/search/') ||
        urlObj.pathname.includes('/maps?') ||
        urlObj.search.includes('place_id')
      );
    }

    return false;
  } catch {
    return false;
  }
}
