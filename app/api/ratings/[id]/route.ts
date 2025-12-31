import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getServerSession } from '@/lib/auth-server';

/**
 * PUT /api/ratings/[id]
 * Update an existing rating
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rating_id } = await params;

    // Get current user session
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user_id = session.user.id;
    const body = await request.json();

    const {
      coffee_rating,
      vibe_rating,
      wifi_rating,
      outlets_rating,
      seating_rating,
      noise_rating,
      comment,
      photos,
    } = body;

    // Check ownership
    const { data: existingRating, error: fetchError } = await supabaseAdmin
      .from('ratings')
      .select('user_id')
      .eq('id', rating_id)
      .single();

    if (fetchError || !existingRating) {
      return NextResponse.json(
        { error: 'Rating not found' },
        { status: 404 }
      );
    }

    if (existingRating.user_id !== user_id) {
      return NextResponse.json(
        { error: 'You can only update your own ratings' },
        { status: 403 }
      );
    }

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

    // Validate rating values
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

    // Update rating
    const { data: updatedRating, error: updateError } = await supabaseAdmin
      .from('ratings')
      .update({
        coffee_rating,
        vibe_rating,
        wifi_rating,
        outlets_rating,
        seating_rating,
        noise_rating,
        comment,
        photos: photos || [],
      })
      .eq('id', rating_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating rating:', updateError);
      return NextResponse.json(
        { error: 'Failed to update rating' },
        { status: 500 }
      );
    }

    // Refresh materialized view
    try {
      await supabaseAdmin.rpc('refresh_cafe_stats');
      console.log('✅ Refreshed cafe_stats materialized view');
    } catch (refreshError) {
      console.error('Error refreshing materialized view:', refreshError);
    }

    return NextResponse.json({
      success: true,
      rating: updatedRating,
    });

  } catch (error) {
    console.error('Error in PUT /api/ratings/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ratings/[id]
 * Delete a rating (optional)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rating_id } = await params;

    // Get current user session
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const user_id = session.user.id;

    // Check ownership
    const { data: existingRating, error: fetchError } = await supabaseAdmin
      .from('ratings')
      .select('user_id')
      .eq('id', rating_id)
      .single();

    if (fetchError || !existingRating) {
      return NextResponse.json(
        { error: 'Rating not found' },
        { status: 404 }
      );
    }

    if (existingRating.user_id !== user_id) {
      return NextResponse.json(
        { error: 'You can only delete your own ratings' },
        { status: 403 }
      );
    }

    // Delete rating
    const { error: deleteError } = await supabaseAdmin
      .from('ratings')
      .delete()
      .eq('id', rating_id);

    if (deleteError) {
      console.error('Error deleting rating:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete rating' },
        { status: 500 }
      );
    }

    // Refresh materialized view
    try {
      await supabaseAdmin.rpc('refresh_cafe_stats');
      console.log('✅ Refreshed cafe_stats after delete');
    } catch (refreshError) {
      console.error('Error refreshing materialized view:', refreshError);
    }

    return NextResponse.json({
      success: true,
      message: 'Rating deleted successfully',
    });

  } catch (error) {
    console.error('Error in DELETE /api/ratings/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
