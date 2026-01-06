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

    // Query database for cafes within bounding box
    const { data: dbCafes, error: dbError } = await supabaseAdmin.rpc(
      'get_cafes_in_bounds',
      {
        north_lat: northLat,
        south_lat: southLat,
        east_lng: eastLng,
        west_lng: westLng,
        min_rating: minRating,
        result_limit: limit,
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
    const cafes = (dbCafes || []).map((cafe: any) => ({
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
    }));

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
