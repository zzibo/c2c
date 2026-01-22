import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { scrapeGoogleMaps, isValidGoogleMapsUrl } from '@/lib/scraper/googleMapsScraper';

/**
 * POST /api/cafes/scrape
 * Scrapes cafe data from Google Maps URL and stores in database
 *
 * Request body:
 * {
 *   "url": "https://maps.google.com/maps/place/..."
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid URL parameter' },
        { status: 400 }
      );
    }

    // Check if it's a valid Google Maps URL
    if (!isValidGoogleMapsUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid Google Maps URL. Please provide a Google Maps place URL.' },
        { status: 400 }
      );
    }

    console.log('🔍 Scraping Google Maps URL:', url);

    // Scrape the cafe data
    let cafeData;
    try {
      cafeData = await scrapeGoogleMaps(url);
    } catch (scrapeError) {
      console.error('Scraping error:', scrapeError);
      return NextResponse.json(
        {
          error: 'Failed to scrape Google Maps',
          details: scrapeError instanceof Error ? scrapeError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Check if cafe already exists in database (by name and approximate location)
    const { data: existingCafes } = await supabaseAdmin
      .from('cafes')
      .select('id, name, location')
      .ilike('name', `%${cafeData.name}%`)
      .limit(5);

    // Simple duplicate check: if name matches and within ~100m, consider it duplicate
    const isDuplicate = existingCafes?.some((cafe: any) => {
      // Extract lat/lng from PostGIS POINT string (if needed)
      // For now, we'll do a simple name match
      return cafe.name.toLowerCase() === cafeData.name.toLowerCase();
    });

    let cafeId: string;

    if (isDuplicate && existingCafes && existingCafes.length > 0) {
      console.log('⚠️  Cafe already exists, returning existing record');
      cafeId = existingCafes[0].id;

      // Update last_synced_at
      await supabaseAdmin
        .from('cafes')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', cafeId);

      return NextResponse.json({
        success: true,
        message: 'Cafe already exists in database',
        cafeId,
        cafeData,
        duplicate: true,
      });
    }

    // Insert new cafe into database
    console.log('💾 Storing cafe in database...');
    const { data: insertedCafe, error: insertError } = await supabaseAdmin
      .from('cafes')
      .insert({
        geoapify_place_id: `googlemaps-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique placeholder
        name: cafeData.name,
        address: cafeData.address,
        location: `POINT(${cafeData.location.lng} ${cafeData.location.lat})`, // PostGIS format
        phone: cafeData.phone || null,
        website: cafeData.website || null,
        user_photos: cafeData.photos || [],
        verified_hours: cafeData.hours || null,
        last_synced_at: new Date().toISOString(),
        first_discovered_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        {
          error: 'Failed to store cafe in database',
          details: insertError.message
        },
        { status: 500 }
      );
    }

    cafeId = insertedCafe.id;
    console.log('✅ Cafe stored successfully with ID:', cafeId);

    // Refresh materialized view to include the new cafe
    try {
      await supabaseAdmin.rpc('refresh_cafe_stats');
      console.log('✅ Refreshed cafe_stats materialized view');
    } catch (refreshError) {
      console.warn('Warning: Failed to refresh materialized view:', refreshError);
      // Non-critical error, continue
    }

    return NextResponse.json({
      success: true,
      message: 'Cafe scraped and stored successfully',
      cafeId,
      cafeData,
      duplicate: false,
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
