import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

const MAX_RESULTS = 100;

/**
 * GET /api/cafes/viewport
 * Get all cafes within the current map viewport (bounding box)
 *
 * Query Parameters:
 * - north: North latitude boundary
 * - south: South latitude boundary
 * - east: East longitude boundary
 * - west: West longitude boundary
 * - min_rating: (optional) Minimum rating filter
 * - limit: (optional) Maximum number of results (default: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get bounding box coordinates
    const north = searchParams.get('north');
    const south = searchParams.get('south');
    const east = searchParams.get('east');
    const west = searchParams.get('west');

    // Validate required parameters
    if (!north || !south || !east || !west) {
      return NextResponse.json(
        { error: 'Missing required parameters: north, south, east, west' },
        { status: 400 }
      );
    }

    const northLat = parseFloat(north);
    const southLat = parseFloat(south);
    const eastLng = parseFloat(east);
    const westLng = parseFloat(west);

    // Validate coordinates
    if (
      isNaN(northLat) || isNaN(southLat) || isNaN(eastLng) || isNaN(westLng)
    ) {
      return NextResponse.json(
        { error: 'Invalid coordinate values - must be numbers' },
        { status: 400 }
      );
    }

    // Validate latitude/longitude ranges
    if (northLat < southLat) {
      return NextResponse.json(
        { error: 'North latitude must be greater than south latitude' },
        { status: 400 }
      );
    }

    if (northLat > 90 || northLat < -90 || southLat > 90 || southLat < -90) {
      return NextResponse.json(
        { error: 'Latitude values must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (eastLng > 180 || eastLng < -180 || westLng > 180 || westLng < -180) {
      return NextResponse.json(
        { error: 'Longitude values must be between -180 and 180' },
        { status: 400 }
      );
    }

    // Optional parameters
    const minRating = parseFloat(searchParams.get('min_rating') || '0');
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(MAX_RESULTS)),
      MAX_RESULTS
    );

    // Parse filter parameters (same as search API)
    const filters = {
      minOverallRating: searchParams.get('minOverallRating') ? parseFloat(searchParams.get('minOverallRating')!) : 0,
      minWifiRating: searchParams.get('minWifiRating') ? parseFloat(searchParams.get('minWifiRating')!) : 0,
      minOutletsRating: searchParams.get('minOutletsRating') ? parseFloat(searchParams.get('minOutletsRating')!) : 0,
      minCoffeeRating: searchParams.get('minCoffeeRating') ? parseFloat(searchParams.get('minCoffeeRating')!) : 0,
      minVibeRating: searchParams.get('minVibeRating') ? parseFloat(searchParams.get('minVibeRating')!) : 0,
      minSeatingRating: searchParams.get('minSeatingRating') ? parseFloat(searchParams.get('minSeatingRating')!) : 0,
      minNoiseRating: searchParams.get('minNoiseRating') ? parseFloat(searchParams.get('minNoiseRating')!) : 0,
      minReviews: searchParams.get('minReviews') ? parseInt(searchParams.get('minReviews')!) : 0,
      sortBy: (searchParams.get('sortBy') as any) || 'distance',
      hasWifi: searchParams.get('hasWifi') === 'true' ? true : searchParams.get('hasWifi') === 'false' ? false : null,
      hasOutlets: searchParams.get('hasOutlets') === 'true' ? true : searchParams.get('hasOutlets') === 'false' ? false : null,
      goodForWork: searchParams.get('goodForWork') === 'true' ? true : searchParams.get('goodForWork') === 'false' ? false : null,
      quietWorkspace: searchParams.get('quietWorkspace') === 'true' ? true : searchParams.get('quietWorkspace') === 'false' ? false : null,
      spacious: searchParams.get('spacious') === 'true' ? true : searchParams.get('spacious') === 'false' ? false : null,
      maxPriceLevel: searchParams.get('maxPriceLevel') ? parseInt(searchParams.get('maxPriceLevel')!) : -1,
    };

    // Use highest min rating from filters or min_rating param
    const effectiveMinRating = Math.max(minRating, filters.minOverallRating);

    // Query database for cafes within bounding box
    const { data: dbCafes, error: dbError } = await supabaseAdmin.rpc(
      'get_cafes_in_bounds',
      {
        north_lat: northLat,
        south_lat: southLat,
        east_lng: eastLng,
        west_lng: westLng,
        min_rating: effectiveMinRating,
        result_limit: limit * 2, // Fetch more to allow filtering
      }
    );

    if (dbError) {
      console.error('Database error fetching cafes in viewport:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch cafes' },
        { status: 500 }
      );
    }

    // Transform database results to frontend format
    let cafes = (dbCafes || []).map((cafe: any) => ({
      id: cafe.id,
      geoapifyPlaceId: cafe.geoapify_place_id,
      name: cafe.display_name || cafe.name,
      location: {
        lat: cafe.latitude,
        lng: cafe.longitude,
      },
      address: cafe.address || '',
      placeId: cafe.geoapify_place_id, // Deprecated - use geoapifyPlaceId
      ratings: {
        coffee: cafe.avg_coffee || 0,
        vibe: cafe.avg_vibe || 0,
        wifi: cafe.avg_wifi || 0,
        outlets: cafe.avg_outlets || 0,
        seating: cafe.avg_seating || 0,
        noise: cafe.avg_noise || 0,
        overall: cafe.avg_overall || 0,
      },
      totalReviews: cafe.rating_count || 0,
      photos: cafe.user_photos || [],
      website: cafe.website,
      phone: cafe.phone,
      hoursText: cafe.verified_hours?.text,
      priceLevel: undefined, // Not available from database currently
      distance: cafe.distance_meters || 0,
    }));

    // Apply filters (same logic as search API)
    cafes = cafes.filter((cafe: any) => {
      // Rating filters
      if (filters.minOverallRating > 0 && cafe.ratings.overall < filters.minOverallRating) return false;
      if (filters.minWifiRating > 0 && cafe.ratings.wifi < filters.minWifiRating) return false;
      if (filters.minOutletsRating > 0 && cafe.ratings.outlets < filters.minOutletsRating) return false;
      if (filters.minCoffeeRating > 0 && cafe.ratings.coffee < filters.minCoffeeRating) return false;
      if (filters.minVibeRating > 0 && cafe.ratings.vibe < filters.minVibeRating) return false;
      if (filters.minSeatingRating > 0 && cafe.ratings.seating < filters.minSeatingRating) return false;
      if (filters.minNoiseRating > 0 && cafe.ratings.noise < filters.minNoiseRating) return false;

      // Review count filter
      if (filters.minReviews > 0 && cafe.totalReviews < filters.minReviews) return false;

      // Feature filters
      if (filters.hasWifi === true && cafe.ratings.wifi === 0) return false;
      if (filters.hasOutlets === true && cafe.ratings.outlets === 0) return false;
      if (filters.goodForWork === true) {
        if (cafe.ratings.overall < 4 || cafe.ratings.wifi < 4) return false;
      }
      if (filters.quietWorkspace === true && cafe.ratings.noise < 4) return false;
      if (filters.spacious === true && cafe.ratings.seating < 4) return false;

      // Price level filter
      if (filters.maxPriceLevel > 0 && cafe.priceLevel && cafe.priceLevel > filters.maxPriceLevel) return false;

      return true;
    });

    // Sort according to sortBy
    cafes.sort((a: any, b: any) => {
      switch (filters.sortBy) {
        case 'rating':
          if (b.ratings.overall !== a.ratings.overall) {
            return b.ratings.overall - a.ratings.overall;
          }
          return (a.distance || 0) - (b.distance || 0);
        case 'reviews':
          if (b.totalReviews !== a.totalReviews) {
            return b.totalReviews - a.totalReviews;
          }
          return b.ratings.overall - a.ratings.overall;
        case 'distance':
        default:
          return (a.distance || 0) - (b.distance || 0);
      }
    });

    // Limit results
    cafes = cafes.slice(0, limit);

    return NextResponse.json({
      success: true,
      count: cafes.length,
      cafes,
      bounds: {
        north: northLat,
        south: southLat,
        east: eastLng,
        west: westLng,
      },
      source: 'database',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in /api/cafes/viewport:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
