import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// Geoapify Places API endpoint (fallback only)
const GEOAPIFY_PLACES_URL = 'https://api.geoapify.com/v2/places';

const SEARCH_RADIUS_METERS = 16093; // 10 miles
const MIN_DB_RESULTS = 5; // Only hit Geoapify if DB returns fewer than this
const MAX_RESULTS = 100;

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
      sortBy: (searchParams.get('sortBy') as SearchFilters['sortBy']) || 'relevance',
      hasWifi: searchParams.get('hasWifi') === 'true' ? true : searchParams.get('hasWifi') === 'false' ? false : null,
      hasOutlets: searchParams.get('hasOutlets') === 'true' ? true : searchParams.get('hasOutlets') === 'false' ? false : null,
      goodForWork: searchParams.get('goodForWork') === 'true' ? true : searchParams.get('goodForWork') === 'false' ? false : null,
      quietWorkspace: searchParams.get('quietWorkspace') === 'true' ? true : searchParams.get('quietWorkspace') === 'false' ? false : null,
      spacious: searchParams.get('spacious') === 'true' ? true : searchParams.get('spacious') === 'false' ? false : null,
      maxPriceLevel: searchParams.get('maxPriceLevel') ? parseInt(searchParams.get('maxPriceLevel')!) : -1,
    };

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

    const searchRadius = filters.maxDistance && filters.maxDistance > 0
      ? filters.maxDistance * 1609.34
      : SEARCH_RADIUS_METERS;

    // ========================================================================
    // STEP 1: SEARCH DATABASE FIRST (fast, free, includes user-submitted cafes)
    // ========================================================================
    // Build search patterns from query words for ILIKE matching.
    // This handles typos better than full-text search because each word
    // is matched independently with wildcards (e.g. "blue cofee" matches
    // "Blue Bottle Coffee" because "blue" matches and "cofee" is close enough
    // when we also do fuzzy scoring).
    const searchWords = query.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);

    // Query cafe_stats with geographic filter + ILIKE for each word.
    // We use a broad ILIKE first (any word matches) then score in JS.
    const ilikeClauses = searchWords.map(w => `%${w}%`);

    // Build an OR filter: name or address contains any search word
    let dbQuery = supabaseAdmin
      .from('cafe_stats')
      .select('id, geoapify_place_id, name, display_name, address, location, phone, website, user_photos, verified_hours, rating_count, avg_coffee, avg_vibe, avg_wifi, avg_outlets, avg_seating, avg_noise, avg_overall, last_rated_at, created_at')
      .limit(MAX_RESULTS);

    // Use .or() to match any word in name or address
    const orConditions = ilikeClauses
      .flatMap(pattern => [
        `display_name.ilike.${pattern}`,
        `name.ilike.${pattern}`,
      ])
      .join(',');
    dbQuery = dbQuery.or(orConditions);

    const { data: dbCafes, error: dbError } = await dbQuery;

    if (dbError) {
      console.error('Database search error:', dbError);
      return NextResponse.json(
        { error: 'Database search failed', details: 'Unable to search cafes. Please try again.' },
        { status: 503 }
      );
    }

    // Calculate distances and relevance scores for DB results
    const dbResults = (dbCafes || []).map((cafe: any) => {
      // Extract lat/lng from PostGIS location
      // cafe_stats.location is a geography type - we need to parse it
      // Since we can't use ST_X/ST_Y in the JS client, we'll use the
      // geoapify data or a separate RPC call. For now, let's use a
      // workaround: query with the RPC function instead.
      return cafe;
    });

    // If we got DB results, use the RPC function for proper distance calculation
    let scoredDbResults: any[] = [];
    if (dbResults.length > 0) {
      // Re-query using RPC to get proper lat/lng and distance
      // We'll query nearby cafes and filter by the IDs we found
      const cafeIds = dbResults.map((c: any) => c.id);

      const { data: enrichedCafes, error: enrichError } = await supabaseAdmin.rpc(
        'get_nearby_cafes',
        {
          user_lat: latitude,
          user_lng: longitude,
          radius_meters: Math.round(searchRadius),
          min_rating: 0,
          result_limit: 500, // Get all nearby, we'll filter by ID
        }
      );

      if (enrichError) {
        console.error('Enrichment query error:', enrichError);
      }

      // Build a map of enriched data by ID
      const enrichedMap = new Map<string, any>();
      (enrichedCafes || []).forEach((c: any) => enrichedMap.set(c.id, c));

      // Also include DB results that are outside radius (they matched by name)
      // For those, we do a direct lookup to get coordinates
      const missingIds = cafeIds.filter((id: string) => !enrichedMap.has(id));
      if (missingIds.length > 0) {
        const { data: missingCafes, error: missingError } = await supabaseAdmin
          .from('cafe_stats')
          .select('id, geoapify_place_id, name, display_name, address, phone, website, user_photos, verified_hours, rating_count, avg_coffee, avg_vibe, avg_wifi, avg_outlets, avg_seating, avg_noise, avg_overall')
          .in('id', missingIds);

        if (missingError) {
          console.error('Missing cafes query error:', missingError);
        }

        // For missing cafes we don't have PostGIS distance, set to null
        (missingCafes || []).forEach((c: any) => {
          enrichedMap.set(c.id, {
            ...c,
            latitude: null,
            longitude: null,
            distance_meters: null,
          });
        });
      }

      // Score each result
      const searchLower = query.toLowerCase().trim();
      const searchNormalized = normalizeString(searchLower);
      const searchWordsNorm = searchNormalized.split(/\s+/).filter(w => w.length > 0);

      scoredDbResults = cafeIds
        .map((id: string) => {
          const enriched = enrichedMap.get(id);
          const raw = dbResults.find((c: any) => c.id === id);
          if (!enriched && !raw) return null;

          const source = enriched || raw;
          const cafeName = source.display_name || source.name || '';
          const cafeNameLower = cafeName.toLowerCase();
          const cafeNameNormalized = normalizeString(cafeNameLower);

          const relevanceScore = calculateRelevanceScore(
            searchLower,
            searchNormalized,
            searchWordsNorm,
            cafeNameLower,
            cafeNameNormalized
          );

          const distance = enriched?.distance_meters ?? null;

          return {
            cafe: {
              id: source.id,
              geoapifyPlaceId: source.geoapify_place_id,
              name: cafeName,
              location: {
                lat: enriched?.latitude ?? null,
                lng: enriched?.longitude ?? null,
              },
              address: source.address || '',
              placeId: source.geoapify_place_id,
              ratings: {
                coffee: source.avg_coffee || 0,
                vibe: source.avg_vibe || 0,
                wifi: source.avg_wifi || 0,
                outlets: source.avg_outlets || 0,
                seating: source.avg_seating || 0,
                noise: source.avg_noise || 0,
                overall: source.avg_overall || 0,
              },
              totalReviews: source.rating_count || 0,
              photos: source.user_photos || [],
              distance: distance ? Math.round(distance) : null,
              website: source.website,
              phone: source.phone,
              hoursText: source.verified_hours?.text,
            },
            distance: distance ?? Infinity,
            relevanceScore,
          };
        })
        .filter((item: any) => item !== null && item.relevanceScore > 0);
    }

    // ========================================================================
    // STEP 2: IF NOT ENOUGH DB RESULTS, FALL BACK TO GEOAPIFY
    // ========================================================================
    let geoapifyResults: any[] = [];
    let usedGeoapify = false;

    if (scoredDbResults.length < MIN_DB_RESULTS) {
      const apiKey = process.env.GEOAPIFY_API_KEY;
      if (apiKey) {
        usedGeoapify = true;

        const url = new URL(GEOAPIFY_PLACES_URL);
        url.searchParams.append('categories', 'catering.cafe');
        url.searchParams.append('filter', `circle:${longitude},${latitude},${searchRadius}`);
        url.searchParams.append('limit', '200');
        url.searchParams.append('apiKey', apiKey);

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const response = await fetch(url.toString(), { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();

            const searchLower = query.toLowerCase().trim();
            const searchNormalized = normalizeString(searchLower);
            const searchWordsNorm = searchNormalized.split(/\s+/).filter(w => w.length > 0);

            // Track DB cafe IDs to avoid duplicates
            const dbCafeGeoapifyIds = new Set(scoredDbResults.map((r: any) => r.cafe.geoapifyPlaceId).filter(Boolean));

            geoapifyResults = (data.features || [])
              .map((place: any) => {
                const props = place.properties;
                const placeId = props.place_id || `${props.lat}-${props.lon}`;

                // Skip if already in DB results
                if (dbCafeGeoapifyIds.has(placeId)) return null;

                const cafeName = props.name || props.address_line1 || '';
                const cafeNameLower = cafeName.toLowerCase();
                const cafeNameNormalized = normalizeString(cafeNameLower);

                const distance = calculateDistance(latitude, longitude, props.lat, props.lon);
                const relevanceScore = calculateRelevanceScore(
                  searchLower, searchNormalized, searchWordsNorm,
                  cafeNameLower, cafeNameNormalized
                );

                return {
                  cafe: {
                    id: placeId,
                    geoapifyPlaceId: placeId,
                    name: cafeName,
                    location: { lat: props.lat, lng: props.lon },
                    address: props.formatted || props.address_line2 || '',
                    placeId,
                    ratings: { coffee: 0, vibe: 0, wifi: 0, outlets: 0, seating: 0, noise: 0, overall: 0 },
                    totalReviews: 0,
                    photos: [],
                    priceLevel: props.price_level || undefined,
                    distance: Math.round(distance),
                    website: props.website,
                    phone: props.contact?.phone,
                    hoursText: props.opening_hours,
                  },
                  distance,
                  relevanceScore,
                };
              })
              .filter((item: any) => item !== null && item.relevanceScore > 0);
          }
        } catch (err) {
          console.error('Geoapify fallback failed:', err);
          // Non-fatal - we still have DB results
        }
      }
    }

    // ========================================================================
    // STEP 3: MERGE, FILTER, SORT, RETURN
    // ========================================================================
    // DB results come first (they have ratings), then Geoapify results
    let allResults = [...scoredDbResults, ...geoapifyResults];

    // Apply filters
    allResults = allResults.filter((item: any) => {
      const cafe = item.cafe;

      if (filters.maxDistance && filters.maxDistance > 0 && cafe.distance !== null) {
        const maxDistanceMeters = filters.maxDistance * 1609.34;
        if (item.distance > maxDistanceMeters) return false;
      }

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
      if (filters.minReviews && filters.minReviews > 0) {
        if (cafe.totalReviews < filters.minReviews) return false;
      }
      if (filters.hasWifi === true && cafe.ratings.wifi === 0) return false;
      if (filters.hasOutlets === true && cafe.ratings.outlets === 0) return false;
      if (filters.goodForWork === true) {
        if (cafe.ratings.overall < 4 || cafe.ratings.wifi < 4) return false;
      }
      if (filters.quietWorkspace === true && cafe.ratings.noise < 4) return false;
      if (filters.spacious === true && cafe.ratings.seating < 4) return false;
      if (filters.maxPriceLevel && filters.maxPriceLevel > 0 && cafe.priceLevel) {
        if (cafe.priceLevel > filters.maxPriceLevel) return false;
      }

      return true;
    });

    // Sort
    allResults.sort((a: any, b: any) => {
      switch (filters.sortBy) {
        case 'distance':
          return (a.distance ?? Infinity) - (b.distance ?? Infinity);
        case 'rating':
          if (b.cafe.ratings.overall !== a.cafe.ratings.overall) {
            return b.cafe.ratings.overall - a.cafe.ratings.overall;
          }
          return (a.distance ?? Infinity) - (b.distance ?? Infinity);
        case 'reviews':
          if (b.cafe.totalReviews !== a.cafe.totalReviews) {
            return b.cafe.totalReviews - a.cafe.totalReviews;
          }
          return b.cafe.ratings.overall - a.cafe.ratings.overall;
        case 'relevance':
        default:
          // Boost DB results with reviews over Geoapify results
          const aBoost = a.cafe.totalReviews > 0 ? 20 : 0;
          const bBoost = b.cafe.totalReviews > 0 ? 20 : 0;
          const aScore = a.relevanceScore + aBoost;
          const bScore = b.relevanceScore + bBoost;
          if (bScore !== aScore) return bScore - aScore;
          return (a.distance ?? Infinity) - (b.distance ?? Infinity);
      }
    });

    const finalCafes = allResults
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
      source: usedGeoapify ? 'database+geoapify' : 'database',
      dbResults: scoredDbResults.length,
      geoapifyResults: geoapifyResults.length,
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
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate relevance score for a cafe name match (0-100, higher = better)
 */
function calculateRelevanceScore(
  searchLower: string,
  searchNormalized: string,
  searchWords: string[],
  cafeNameLower: string,
  cafeNameNormalized: string
): number {
  let score = 0;

  // Exact match (case-insensitive)
  if (cafeNameLower === searchLower) return 100;
  if (cafeNameNormalized === searchNormalized) return 95;

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

  // Word boundary matching
  if (searchWords.length > 0) {
    const cafeWords = cafeNameNormalized.split(/\s+/);

    let wordsMatched = 0;
    for (const searchWord of searchWords) {
      const wordMatch = cafeWords.some(cafeWord =>
        cafeWord === searchWord || cafeWord.startsWith(searchWord) || cafeWord.includes(searchWord)
      );
      if (wordMatch) wordsMatched++;
    }

    const wordMatchRatio = wordsMatched / searchWords.length;
    score += wordMatchRatio * 50;
  }

  // Fuzzy matching for typos (only if no strong match yet)
  if (score < 50 && searchWords.length > 0) {
    const cafeWords = cafeNameNormalized.split(/\s+/);
    let fuzzyMatches = 0;

    for (const searchWord of searchWords) {
      if (searchWord.length < 3) continue;
      for (const cafeWord of cafeWords) {
        if (cafeWord.length < 3) continue;
        const distance = levenshteinDistance(searchWord, cafeWord);
        const maxLen = Math.max(searchWord.length, cafeWord.length);
        const similarity = 1 - (distance / maxLen);
        // Allow 1-2 character typos
        if (similarity >= 0.6 || distance <= 2) {
          fuzzyMatches++;
          break;
        }
      }
    }

    if (fuzzyMatches > 0) {
      const fuzzyRatio = fuzzyMatches / searchWords.length;
      score = Math.max(score, fuzzyRatio * 45);
    }
  }

  return Math.min(100, Math.round(score));
}

/**
 * Levenshtein distance (edit distance between two strings)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) dp[i] = [i];
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Haversine distance between two coordinates (returns meters)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
