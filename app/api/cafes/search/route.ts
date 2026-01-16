import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// Geoapify Autocomplete/Search API endpoint
const GEOAPIFY_AUTOCOMPLETE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';
const GEOAPIFY_PLACES_URL = 'https://api.geoapify.com/v2/places';

// Search radius: 10 miles for more focused results
const SEARCH_RADIUS_METERS = 16093; // 10 miles
const FETCH_LIMIT = 200; // Fetch up to 200 from Geoapify
const MAX_RESULTS = 100; // Show max 100 to user

// Filter interface
interface SearchFilters {
  maxDistance?: number;
  minOverallRating?: number;
  minWifiRating?: number;
  minOutletsRating?: number;
  minCoffeeRating?: number;
  minVibeRating?: number;
  minSeatingRating?: number;
  minNoiseRating?: number;
  minReviews?: number;
  sortBy?: 'relevance' | 'distance' | 'rating' | 'reviews';
  hasWifi?: boolean | null;
  hasOutlets?: boolean | null;
  goodForWork?: boolean | null;
  quietWorkspace?: boolean | null;
  spacious?: boolean | null;
  maxPriceLevel?: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    
    // Parse filter parameters
    const filters: SearchFilters = {
      maxDistance: searchParams.get('maxDistance') ? parseFloat(searchParams.get('maxDistance')!) : 10,
      minOverallRating: searchParams.get('minOverallRating') ? parseFloat(searchParams.get('minOverallRating')!) : 0,
      minWifiRating: searchParams.get('minWifiRating') ? parseFloat(searchParams.get('minWifiRating')!) : 0,
      minOutletsRating: searchParams.get('minOutletsRating') ? parseFloat(searchParams.get('minOutletsRating')!) : 0,
      minCoffeeRating: searchParams.get('minCoffeeRating') ? parseFloat(searchParams.get('minCoffeeRating')!) : 0,
      minVibeRating: searchParams.get('minVibeRating') ? parseFloat(searchParams.get('minVibeRating')!) : 0,
      minSeatingRating: searchParams.get('minSeatingRating') ? parseFloat(searchParams.get('minSeatingRating')!) : 0,
      minNoiseRating: searchParams.get('minNoiseRating') ? parseFloat(searchParams.get('minNoiseRating')!) : 0,
      minReviews: searchParams.get('minReviews') ? parseInt(searchParams.get('minReviews')!) : 0,
      sortBy: (searchParams.get('sortBy') as any) || 'relevance',
      hasWifi: searchParams.get('hasWifi') === 'true' ? true : searchParams.get('hasWifi') === 'false' ? false : null,
      hasOutlets: searchParams.get('hasOutlets') === 'true' ? true : searchParams.get('hasOutlets') === 'false' ? false : null,
      goodForWork: searchParams.get('goodForWork') === 'true' ? true : searchParams.get('goodForWork') === 'false' ? false : null,
      quietWorkspace: searchParams.get('quietWorkspace') === 'true' ? true : searchParams.get('quietWorkspace') === 'false' ? false : null,
      spacious: searchParams.get('spacious') === 'true' ? true : searchParams.get('spacious') === 'false' ? false : null,
      maxPriceLevel: searchParams.get('maxPriceLevel') ? parseInt(searchParams.get('maxPriceLevel')!) : -1,
    };

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

    // Determine search radius based on filter
    const searchRadius = filters.maxDistance && filters.maxDistance > 0 
      ? filters.maxDistance * 1609.34 // Convert miles to meters
      : SEARCH_RADIUS_METERS;

    // Build Geoapify Places API URL with text filter
    const url = new URL(GEOAPIFY_PLACES_URL);
    url.searchParams.append('categories', 'catering.cafe');
    url.searchParams.append('filter', `circle:${longitude},${latitude},${searchRadius}`);
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
            geoapifyPlaceId: props.place_id,
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
              wifi: 0,
              outlets: 0,
              seating: 0,
              noise: 0,
              overall: 0,
            },
            totalReviews: 0,
            photos: [],
            priceLevel: props.price_level || undefined,
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
      .filter((item: any) => item.relevanceScore > 0);

    // Enrich with database ratings
    const placeIds = cafesWithDistance.map((item: any) => item.cafe.geoapifyPlaceId).filter(Boolean);
    let dbRatingsMap: Map<string, any> = new Map();

    if (placeIds.length > 0) {
      const { data: dbCafes } = await supabaseAdmin
        .from('cafe_stats')
        .select('geoapify_place_id, avg_coffee, avg_vibe, avg_wifi, avg_outlets, avg_seating, avg_noise, avg_overall, rating_count')
        .in('geoapify_place_id', placeIds);

      if (dbCafes) {
        dbCafes.forEach((cafe: any) => {
          dbRatingsMap.set(cafe.geoapify_place_id, {
            coffee: cafe.avg_coffee || 0,
            vibe: cafe.avg_vibe || 0,
            wifi: cafe.avg_wifi || 0,
            outlets: cafe.avg_outlets || 0,
            seating: cafe.avg_seating || 0,
            noise: cafe.avg_noise || 0,
            overall: cafe.avg_overall || 0,
            totalReviews: cafe.rating_count || 0,
          });
        });
      }
    }

    // Enrich cafes with database ratings
    const enrichedCafes = cafesWithDistance.map((item: any) => {
      const dbData = dbRatingsMap.get(item.cafe.geoapifyPlaceId);
      if (dbData) {
        item.cafe.ratings = {
          coffee: dbData.coffee,
          vibe: dbData.vibe,
          wifi: dbData.wifi,
          outlets: dbData.outlets,
          seating: dbData.seating,
          noise: dbData.noise,
          overall: dbData.overall,
        };
        item.cafe.totalReviews = dbData.totalReviews;
      }
      return item;
    });

    // Apply filters
    let filteredCafes = enrichedCafes.filter((item: any) => {
      const cafe = item.cafe;
      
      // Distance filter
      if (filters.maxDistance && filters.maxDistance > 0) {
        const maxDistanceMeters = filters.maxDistance * 1609.34;
        if (item.distance > maxDistanceMeters) return false;
      }

      // Rating filters
      if (filters.minOverallRating && filters.minOverallRating > 0) {
        if (cafe.ratings.overall < filters.minOverallRating) return false;
      }
      if (filters.minWifiRating && filters.minWifiRating > 0) {
        if (cafe.ratings.wifi < filters.minWifiRating) return false;
      }
      if (filters.minOutletsRating && filters.minOutletsRating > 0) {
        if (cafe.ratings.outlets < filters.minOutletsRating) return false;
      }
      if (filters.minCoffeeRating && filters.minCoffeeRating > 0) {
        if (cafe.ratings.coffee < filters.minCoffeeRating) return false;
      }
      if (filters.minVibeRating && filters.minVibeRating > 0) {
        if (cafe.ratings.vibe < filters.minVibeRating) return false;
      }
      if (filters.minSeatingRating && filters.minSeatingRating > 0) {
        if (cafe.ratings.seating < filters.minSeatingRating) return false;
      }
      if (filters.minNoiseRating && filters.minNoiseRating > 0) {
        if (cafe.ratings.noise < filters.minNoiseRating) return false;
      }

      // Review count filter
      if (filters.minReviews && filters.minReviews > 0) {
        if (cafe.totalReviews < filters.minReviews) return false;
      }

      // Feature filters
      if (filters.hasWifi === true && cafe.ratings.wifi === 0) return false;
      if (filters.hasOutlets === true && cafe.ratings.outlets === 0) return false;
      if (filters.goodForWork === true) {
        if (cafe.ratings.overall < 4 || cafe.ratings.wifi < 4) return false;
      }
      if (filters.quietWorkspace === true && cafe.ratings.noise < 4) return false;
      if (filters.spacious === true && cafe.ratings.seating < 4) return false;

      // Price level filter
      if (filters.maxPriceLevel && filters.maxPriceLevel > 0 && cafe.priceLevel) {
        if (cafe.priceLevel > filters.maxPriceLevel) return false;
      }

      return true;
    });

    // Sort according to sortBy
    filteredCafes.sort((a: any, b: any) => {
      switch (filters.sortBy) {
        case 'distance':
          return a.distance - b.distance;
        case 'rating':
          if (b.cafe.ratings.overall !== a.cafe.ratings.overall) {
            return b.cafe.ratings.overall - a.cafe.ratings.overall;
          }
          return a.distance - b.distance;
        case 'reviews':
          if (b.cafe.totalReviews !== a.cafe.totalReviews) {
            return b.cafe.totalReviews - a.cafe.totalReviews;
          }
          return b.cafe.ratings.overall - a.cafe.ratings.overall;
        case 'relevance':
        default:
          if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
          return a.distance - b.distance;
      }
    });

    // Take top 100
    const finalCafes = filteredCafes
      .slice(0, MAX_RESULTS)
      .map((item: any) => item.cafe);

    return NextResponse.json({
      success: true,
      count: finalCafes.length,
      cafes: finalCafes,
      searchQuery: query,
      searchCenter: { lat: latitude, lng: longitude },
      radiusMeters: searchRadius,
      radiusMiles: filters.maxDistance && filters.maxDistance > 0 ? filters.maxDistance : 10,
      provider: 'Geoapify',
      filtersApplied: filters,
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
