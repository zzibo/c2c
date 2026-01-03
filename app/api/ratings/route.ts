import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getServerSession } from '@/lib/auth-server';

/**
 * POST /api/ratings
 * Create a new rating for a cafe
 */
export async function POST(request: NextRequest) {
  try {
    // Get current user session
    const session = await getServerSession();
    console.log('POST /api/ratings - Session:', session ? `Found (user: ${session.user.id})` : 'Not found');
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user_id = session.user.id;
    const body = await request.json();

    const {
      cafe_id,
      coffee_rating,
      vibe_rating,
      wifi_rating,
      outlets_rating,
      seating_rating,
      noise_rating,
      comment,
      photos = [],
    } = body;

    // Validation
    if (!cafe_id) {
      return NextResponse.json(
        { error: 'cafe_id is required' },
        { status: 400 }
      );
    }

    // Look up cafe by geoapify_place_id (frontend sends this as cafe.id)
    // The database expects a UUID, so we need to find the cafe first
    const { data: cafeData, error: cafeError } = await supabaseAdmin
      .from('cafes')
      .select('id')
      .eq('geoapify_place_id', cafe_id)
      .single();

    if (cafeError || !cafeData) {
      return NextResponse.json(
        { error: `Cafe not found: ${cafe_id}` },
        { status: 404 }
      );
    }

    const cafe_uuid = cafeData.id;

    // At least one rating must be provided
    const hasAtLeastOneRating = [
      coffee_rating,
      vibe_rating,
      wifi_rating,
      outlets_rating,
      seating_rating,
      noise_rating,
    ].some((rating) => rating !== null && rating !== undefined);

    if (!hasAtLeastOneRating) {
      return NextResponse.json(
        { error: 'At least one category rating is required' },
        { status: 400 }
      );
    }

    // Validate rating values (0.5 - 5.0)
    const ratings = [coffee_rating, vibe_rating, wifi_rating, outlets_rating, seating_rating, noise_rating];
    for (const rating of ratings) {
      if (rating !== null && rating !== undefined) {
        if (rating < 0.5 || rating > 5.0) {
          return NextResponse.json(
            { error: 'Ratings must be between 0.5 and 5.0' },
            { status: 400 }
          );
        }
      }
    }

    // Insert rating
    const { data: newRating, error: insertError } = await supabaseAdmin
      .from('ratings')
      .insert({
        cafe_id: cafe_uuid,
        user_id,
        coffee_rating,
        vibe_rating,
        wifi_rating,
        outlets_rating,
        seating_rating,
        noise_rating,
        comment,
        photos,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting rating:', insertError);

      // Handle unique constraint violation (user already rated this cafe)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'You have already rated this cafe. Use PUT to update your rating.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: `Failed to create rating: ${JSON.stringify(insertError)}` },
        { status: 500 }
      );
    }

    // Refresh materialized view to update aggregates
    try {
      await supabaseAdmin.rpc('refresh_cafe_stats');
      console.log('✅ Refreshed cafe_stats materialized view');
    } catch (refreshError) {
      console.error('Error refreshing materialized view:', refreshError);
      // Non-critical, continue
    }

    return NextResponse.json({
      success: true,
      rating: newRating,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/ratings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
