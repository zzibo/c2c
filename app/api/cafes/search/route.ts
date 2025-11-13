import { NextRequest, NextResponse } from 'next/server';

// Geoapify Autocomplete/Search API endpoint
const GEOAPIFY_AUTOCOMPLETE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';
const GEOAPIFY_PLACES_URL = 'https://api.geoapify.com/v2/places';

// Search radius: 50 miles to cover wider area for name search
const SEARCH_RADIUS_METERS = 80467; // 50 miles
const MAX_RESULTS = 100;

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
    url.searchParams.append('limit', '500'); // Get more results to filter by name
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

    // Filter results by name match and calculate distance
    const searchLower = query.toLowerCase();
    const cafesWithDistance = (data.features || [])
      .map((place: any) => {
        const props = place.properties;
        const cafeName = props.name || props.address_line1 || '';

        // Calculate distance from user location
        const distance = calculateDistance(
          latitude,
          longitude,
          props.lat,
          props.lon
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
          nameMatch: cafeName.toLowerCase().includes(searchLower),
        };
      })
      // Filter: only include cafes with names matching the search query
      .filter((item: any) => item.nameMatch)
      // Sort by distance (closest first)
      .sort((a: any, b: any) => a.distance - b.distance)
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
      radiusMiles: 50,
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
