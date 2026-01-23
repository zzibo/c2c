/**
 * Cafe Approver Agent - Validation Logic
 * Functions for comparing submission data with scraped Google Maps data
 */

import {
  Coordinate,
  ScrapedCafeData,
  ParsedSubmission,
  SubmissionClassification,
  ValidationResult,
} from './types';
import {
  CLEAR_MATCH_NAME_THRESHOLD,
  CLEAR_MATCH_DISTANCE_METERS,
  CLEAR_MISMATCH_NAME_THRESHOLD,
  CLEAR_MISMATCH_DISTANCE_METERS,
} from './constants';

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize cafe name for comparison
 * - Lowercase
 * - Remove common suffixes (Cafe, Coffee, etc.)
 * - Remove punctuation and extra whitespace
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, '') // Remove apostrophes
    .replace(/\bcafe\b|\bcoffee\b|\bshop\b|\bhouse\b|\bbar\b|\bkitchen\b/gi, '') // Remove common suffixes
    .replace(/&/g, 'and')
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate name similarity as a percentage (0-100)
 * Uses Levenshtein distance normalized by the longer string length
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);

  if (normalized1 === normalized2) {
    return 100;
  }

  if (normalized1.length === 0 || normalized2.length === 0) {
    return 0;
  }

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.round(similarity * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistanceMeters(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Round to nearest meter
}

/**
 * Parse PostGIS POINT format to Coordinate
 * Input format: "POINT(lng lat)" or "0101000020E6100000..."  (WKB hex)
 */
export function parsePostGISPoint(point: string): Coordinate | null {
  // Try standard POINT format first
  const pointMatch = point.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (pointMatch) {
    return {
      lng: parseFloat(pointMatch[1]),
      lat: parseFloat(pointMatch[2]),
    };
  }

  // Try WKB hex format (common in Supabase geography columns)
  // This is a simplified parser - for production, use a proper WKB parser
  if (point.startsWith('0101000020')) {
    // WKB format - extract coordinates from hex
    // Format: 0101000020E6100000 + 16 hex chars (lng) + 16 hex chars (lat)
    try {
      const hex = point.slice(18); // Skip header
      if (hex.length >= 32) {
        const lngHex = hex.slice(0, 16);
        const latHex = hex.slice(16, 32);

        // Convert hex to little-endian double
        const lng = hexToDouble(lngHex);
        const lat = hexToDouble(latHex);

        if (!isNaN(lng) && !isNaN(lat)) {
          return { lng, lat };
        }
      }
    } catch {
      // Fall through to null
    }
  }

  return null;
}

/**
 * Convert hex string (little-endian) to double
 */
function hexToDouble(hex: string): number {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const view = new DataView(bytes.buffer);
  return view.getFloat64(0, true); // true = little-endian
}

/**
 * Classify a submission based on name similarity and distance
 */
export function classifySubmission(
  submission: ParsedSubmission,
  scrapedData: ScrapedCafeData
): ValidationResult {
  const nameMatchScore = calculateNameSimilarity(submission.name, scrapedData.name);
  const distanceMeters = calculateDistanceMeters(submission.location, scrapedData.location);

  let classification: SubmissionClassification;

  // Check for CLEAR MATCH (both conditions must be met)
  if (
    nameMatchScore > CLEAR_MATCH_NAME_THRESHOLD &&
    distanceMeters < CLEAR_MATCH_DISTANCE_METERS
  ) {
    classification = 'clear_match';
  }
  // Check for CLEAR MISMATCH (either condition triggers it)
  else if (
    nameMatchScore < CLEAR_MISMATCH_NAME_THRESHOLD ||
    distanceMeters > CLEAR_MISMATCH_DISTANCE_METERS
  ) {
    classification = 'clear_mismatch';
  }
  // Everything else is BORDERLINE
  else {
    classification = 'borderline';
  }

  return {
    nameMatchScore,
    distanceMeters,
    classification,
  };
}
