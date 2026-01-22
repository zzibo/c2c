import puppeteer, { Browser, Page } from 'puppeteer';

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
}

/**
 * Scrapes cafe data from a Google Maps URL
 * @param url - Google Maps URL for the cafe
 * @returns Cafe data extracted from Google Maps
 */
export async function scrapeGoogleMaps(url: string): Promise<GoogleMapsCafeData> {
  let browser: Browser | null = null;

  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

    // Extract coordinates from URL
    const coords = extractCoordinatesFromUrl(url);
    if (coords) {
      cafeData.location = coords;
    } else {
      // Fallback: try to extract from page
      const urlInPage = await page.url();
      const coordsFromPage = extractCoordinatesFromUrl(urlInPage);
      if (coordsFromPage) {
        cafeData.location = coordsFromPage;
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
 */
function extractCoordinatesFromUrl(url: string): { lat: number; lng: number } | null {
  try {
    // Format 1: @lat,lng,zoom
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return {
        lat: parseFloat(atMatch[1]),
        lng: parseFloat(atMatch[2]),
      };
    }

    // Format 2: !3d[lat]!4d[lng]
    const exclamationMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (exclamationMatch) {
      return {
        lat: parseFloat(exclamationMatch[1]),
        lng: parseFloat(exclamationMatch[2]),
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
 * Validates if a URL is a valid Google Maps place URL
 */
export function isValidGoogleMapsUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      (urlObj.hostname.includes('google.com') || urlObj.hostname.includes('maps.google.com')) &&
      (urlObj.pathname.includes('/maps/place/') || urlObj.pathname.includes('/maps/search/'))
    );
  } catch {
    return false;
  }
}
