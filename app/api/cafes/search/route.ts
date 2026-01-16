import { NextRequest, NextResponse } from 'next/server';

// Geoapify Autocomplete/Search API endpoint
const GEOAPIFY_AUTOCOMPLETE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';
const GEOAPIFY_PLACES_URL = 'https://api.geoapify.com/v2/places';

// Search radius: 10 miles for more focused results
const SEARCH_RADIUS_METERS = 16093; // 10 miles
const FETCH_LIMIT = 200; // Fetch up to 200 from Geoapify
const MAX_RESULTS = 100; // Show max 100 to user

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    // Validate parameters
    if (!query) {
      return NextResponse.json(
        { error: 'Missing required parameter: q (search query)' },
        { status: 400 }
      );
    }

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing required parameters: lat, lng (user location)' },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Invalid lat/lng values' },
        { status: 400 }
      );
    }

    // Check for Geoapify API key
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Geoapify API key not configured. Get one free at https://www.geoapify.com/' },
        { status: 500 }
      );
    }

    // Build Geoapify Places API URL with text filter
    const url = new URL(GEOAPIFY_PLACES_URL);
    url.searchParams.append('categories', 'catering.cafe');
    url.searchParams.append('filter', `circle:${longitude},${latitude},${SEARCH_RADIUS_METERS}`);
    url.searchParams.append('limit', String(FETCH_LIMIT)); // Fetch up to 200 cafes
    url.searchParams.append('apiKey', apiKey);

    // Fetch from Geoapify Places API
    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error('Geoapify API error:', data);
      return NextResponse.json(
        { error: `Geoapify API error: ${response.status}`, details: data.message || 'Unknown error' },
        { status: 500 }
      );
    }

    // Normalize search query for lenient matching
    const searchLower = query.toLowerCase().trim();
    const searchNormalized = normalizeString(searchLower);
    const searchWords = searchNormalized.split(/\s+/).filter(w => w.length > 0);

    const cafesWithDistance = (data.features || [])
      .map((place: any) => {
        const props = place.properties;
        const cafeName = props.name || props.address_line1 || '';
        const cafeNameLower = cafeName.toLowerCase();
        const cafeNameNormalized = normalizeString(cafeNameLower);

        // Calculate distance from user location
        const distance = calculateDistance(
          latitude,
          longitude,
          props.lat,
          props.lon
        );

        // Calculate relevance score (higher = better match)
        const relevanceScore = calculateRelevanceScore(
          searchLower,
          searchNormalized,
          searchWords,
          cafeNameLower,
          cafeNameNormalized
        );

        return {
          cafe: {
            id: props.place_id || `${props.lat}-${props.lon}`,
            name: cafeName,
            location: {
              lat: props.lat,
              lng: props.lon,
            },
            address: props.formatted || props.address_line2 || '',
            placeId: props.place_id || `${props.lat}-${props.lon}`,
            ratings: {
              coffee: 0,
              vibe: 0,
              infra: 0,
              overall: 0,
            },
            totalReviews: 0,
            photos: [],
            priceLevel: undefined,
            distance: Math.round(distance), // meters
            isOpen: undefined,
            website: props.website,
            phone: props.contact?.phone,
            hourstText: props.opening_hours,
          },
          distance,
          relevanceScore,
        };
      })
      // Filter: only include cafes with some match (relevance > 0)
      .filter((item: any) => item.relevanceScore > 0)
      // Sort by relevance (highest first), then by distance (closest first)
      .sort((a: any, b: any) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        return a.distance - b.distance;
      })
      // Take top 100
      .slice(0, MAX_RESULTS)
      // Extract just the cafe object
      .map((item: any) => item.cafe);

    return NextResponse.json({
      success: true,
      count: cafesWithDistance.length,
      cafes: cafesWithDistance,
      searchQuery: query,
      searchCenter: { lat: latitude, lng: longitude },
      radiusMeters: SEARCH_RADIUS_METERS,
      radiusMiles: 10,
      provider: 'Geoapify',
    });

  } catch (error) {
    console.error('Error searching cafes:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Normalize string by removing special characters and extra spaces
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Calculate simple Levenshtein distance (edit distance)
 * Returns the minimum number of single-character edits needed
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate relevance score for a cafe name match
 * Returns a score from 0-100, where higher is better
 */
function calculateRelevanceScore(
  searchLower: string,
  searchNormalized: string,
  searchWords: string[],
  cafeNameLower: string,
  cafeNameNormalized: string
): number {
  let score = 0;

  // Exact match (case-insensitive) - highest priority
  if (cafeNameLower === searchLower) {
    return 100;
  }

  // Exact match (normalized, no special chars)
  if (cafeNameNormalized === searchNormalized) {
    return 95;
  }

  // Starts with search query
  if (cafeNameLower.startsWith(searchLower)) {
    score += 80;
  } else if (cafeNameNormalized.startsWith(searchNormalized)) {
    score += 75;
  }

  // Contains search query as substring
  if (cafeNameLower.includes(searchLower)) {
    score += 60;
  } else if (cafeNameNormalized.includes(searchNormalized)) {
    score += 55;
  }

  // Word boundary matching - check if all search words appear in cafe name
  if (searchWords.length > 0) {
    const cafeWords = cafeNameNormalized.split(/\s+/);
    const cafeWordsLower = cafeNameLower.split(/\s+/);
    
    let wordsMatched = 0;
    for (const searchWord of searchWords) {
      // Check if any cafe word starts with or equals the search word
      const wordMatch = cafeWords.some(cafeWord => 
        cafeWord === searchWord || cafeWord.startsWith(searchWord)
      ) || cafeWordsLower.some(cafeWord => 
        cafeWord.includes(searchWord)
      );
      
      if (wordMatch) {
        wordsMatched++;
      }
    }
    
    // Score based on percentage of words matched
    const wordMatchRatio = wordsMatched / searchWords.length;
    score += wordMatchRatio * 50; // Up to 50 points for word matching
  }

  // Fuzzy matching for typos (only if no strong match yet)
  if (score < 50 && searchLower.length >= 3) {
    const distance = levenshteinDistance(searchLower, cafeNameLower);
    const maxLen = Math.max(searchLower.length, cafeNameLower.length);
    const similarity = 1 - (distance / maxLen);
    
    // Only apply fuzzy match if similarity is reasonable (>= 70%)
    if (similarity >= 0.7) {
      score = Math.max(score, similarity * 40); // Up to 40 points for fuzzy match
    }
  }

  // Partial word matching - check if search appears as part of any word
  if (score < 30) {
    const cafeWords = cafeNameNormalized.split(/\s+/);
    for (const word of cafeWords) {
      if (word.includes(searchNormalized) || searchNormalized.includes(word)) {
        score = Math.max(score, 25);
        break;
      }
    }
  }

  return Math.min(100, Math.round(score));
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
