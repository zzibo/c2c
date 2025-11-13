import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Geoapify Places API endpoint
const GEOAPIFY_API_URL = 'https://api.geoapify.com/v2/places';

// 2 miles = 3218.69 meters
const SEARCH_RADIUS_METERS = 3219;
const MAX_RESULTS = 100;
const MIN_RESULTS_THRESHOLD = 10; // Only fetch from API if we have < 10 cafes in DB

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    // Validate parameters
    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing required parameters: lat, lng' },
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

    // ========================================================================
    // STEP 1: CHECK DATABASE FIRST (Cache Hit = Fast & Free!)
    // ========================================================================
    const { data: dbCafes, error: dbError } = await supabaseAdmin.rpc(
      'get_nearby_cafes',
      {
        user_lat: latitude,
        user_lng: longitude,
        radius_meters: SEARCH_RADIUS_METERS,
        min_rating: 0,
        result_limit: MAX_RESULTS,
      }
    );

    if (dbError) {
      console.error('Supabase query error:', dbError);
      // Fall through to Geoapify if DB fails
    }

    // If we have enough cafes in DB, return immediately
    if (dbCafes && dbCafes.length >= MIN_RESULTS_THRESHOLD) {
      console.log(`✅ Cache HIT: Returning ${dbCafes.length} cafes from database`);

      // Transform to match frontend interface
      const cafes = dbCafes.map((cafe: any) => ({
        id: cafe.geoapify_place_id,
        name: cafe.display_name || cafe.name,
        location: {
          lat: cafe.latitude,
          lng: cafe.longitude,
        },
        address: cafe.address || '',
        placeId: cafe.geoapify_place_id,
        ratings: {
          coffee: cafe.avg_coffee || 0,
          vibe: cafe.avg_vibe || 0,
          infra: cafe.avg_wifi || 0,
          overall: cafe.avg_overall || 0,
        },
        totalReviews: cafe.rating_count || 0,
        photos: cafe.user_photos || [],
        distance: Math.round(cafe.distance_meters),
        website: cafe.website,
        phone: cafe.phone,
        hoursText: cafe.verified_hours?.text,
      }));

      return NextResponse.json({
        success: true,
        count: cafes.length,
        cafes,
        searchCenter: { lat: latitude, lng: longitude },
        radiusMeters: SEARCH_RADIUS_METERS,
        radiusMiles: 2,
        source: 'database', // Cache hit!
        cacheHit: true,
      });
    }

    console.log(`⚠️  Cache MISS: Only ${dbCafes?.length || 0} cafes in DB, fetching from Geoapify...`);

    // ========================================================================
    // STEP 2: FETCH FROM GEOAPIFY (Cache Miss)
    // ========================================================================
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Geoapify API key not configured. Get one free at https://www.geoapify.com/' },
        { status: 500 }
      );
    }

    // Build Geoapify Places API URL
    const url = new URL(GEOAPIFY_API_URL);
    url.searchParams.append('categories', 'catering.cafe');
    url.searchParams.append('filter', `circle:${longitude},${latitude},${SEARCH_RADIUS_METERS}`);
    url.searchParams.append('limit', MAX_RESULTS.toString());
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

    // ========================================================================
    // STEP 3: STORE NEW CAFES IN SUPABASE
    // ========================================================================
    let newCafesCount = 0;
    const existingPlaceIds = new Set((dbCafes || []).map((c: any) => c.geoapify_place_id));

    for (const place of data.features || []) {
      const props = place.properties;
      const placeId = props.place_id || `${props.lat}-${props.lon}`;

      // Skip if already in database
      if (existingPlaceIds.has(placeId)) {
        continue;
      }

      try {
        const { error } = await supabaseAdmin.from('cafes').insert({
          geoapify_place_id: placeId,
          osm_id: props.osm_id,
          name: props.name || props.address_line1 || 'Unknown Cafe',
          address: props.formatted || props.address_line2,
          location: `POINT(${props.lon} ${props.lat})`,
          phone: props.contact?.phone,
          website: props.website,
          last_synced_at: new Date().toISOString(),
        });

        if (!error) {
          newCafesCount++;
        } else if (error.code !== '23505') {
          // Ignore duplicate key errors (23505), log others
          console.error('Error inserting cafe:', error);
        }
      } catch (err) {
        console.error('Exception inserting cafe:', err);
      }
    }

    console.log(`✅ Stored ${newCafesCount} new cafes from Geoapify`);

    // ========================================================================
    // STEP 4: REFRESH MATERIALIZED VIEW (if we added cafes)
    // ========================================================================
    if (newCafesCount > 0) {
      try {
        await supabaseAdmin.rpc('refresh_cafe_stats');
        console.log('✅ Refreshed cafe_stats materialized view');
      } catch (err) {
        console.error('Error refreshing materialized view:', err);
        // Non-critical, continue
      }
    }

    // ========================================================================
    // STEP 5: FETCH ALL CAFES FROM DB (now includes new ones + ratings)
    // ========================================================================
    const { data: allCafes } = await supabaseAdmin.rpc('get_nearby_cafes', {
      user_lat: latitude,
      user_lng: longitude,
      radius_meters: SEARCH_RADIUS_METERS,
      min_rating: 0,
      result_limit: MAX_RESULTS,
    });

    // Transform to frontend format
    const cafes = (allCafes || []).map((cafe: any) => ({
      id: cafe.geoapify_place_id,
      name: cafe.display_name || cafe.name,
      location: {
        lat: cafe.latitude,
        lng: cafe.longitude,
      },
      address: cafe.address || '',
      placeId: cafe.geoapify_place_id,
      ratings: {
        coffee: cafe.avg_coffee || 0,
        vibe: cafe.avg_vibe || 0,
        infra: cafe.avg_wifi || 0,
        overall: cafe.avg_overall || 0,
      },
      totalReviews: cafe.rating_count || 0,
      photos: cafe.user_photos || [],
      distance: Math.round(cafe.distance_meters),
      website: cafe.website,
      phone: cafe.phone,
      hoursText: cafe.verified_hours?.text,
    }));

    return NextResponse.json({
      success: true,
      count: cafes.length,
      cafes,
      searchCenter: { lat: latitude, lng: longitude },
      radiusMeters: SEARCH_RADIUS_METERS,
      radiusMiles: 2,
      source: 'geoapify+database', // Hybrid source
      cacheHit: false,
      newCafesAdded: newCafesCount,
    });

  } catch (error) {
    console.error('Error fetching cafes:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
