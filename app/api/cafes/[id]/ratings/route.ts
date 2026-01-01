import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/cafes/[id]/ratings
 * Get all ratings for a specific cafe
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cafe_id } = await params;

    if (!cafe_id) {
      return NextResponse.json(
        { error: 'Missing cafe ID' },
        { status: 400 }
      );
    }

    // Fetch all ratings for this cafe
    const { data: ratings, error } = await supabaseAdmin
      .from('ratings')
      .select('*')
      .eq('cafe_id', cafe_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching ratings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch ratings' },
        { status: 500 }
      );
    }

    // Fetch usernames for all user_ids
    const userIds = [...new Set((ratings || []).map((r: any) => r.user_id))];
    let profiles: { id: string; username: string }[] = [];

    if (userIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, username')
        .in('id', userIds);
      profiles = data || [];
    }

    // Create a map of user_id to username
    const usernameMap = new Map(
      profiles.map((p: any) => [p.id, p.username])
    );

    // Transform to include username directly
    const ratingsWithUser = (ratings || []).map((rating: any) => ({
      id: rating.id,
      cafe_id: rating.cafe_id,
      user_id: rating.user_id,
      username: usernameMap.get(rating.user_id) || 'Anonymous',
      coffee_rating: rating.coffee_rating,
      vibe_rating: rating.vibe_rating,
      wifi_rating: rating.wifi_rating,
      outlets_rating: rating.outlets_rating,
      seating_rating: rating.seating_rating,
      noise_rating: rating.noise_rating,
      overall_rating: rating.overall_rating,
      comment: rating.comment,
      photos: rating.photos,
      created_at: rating.created_at,
      updated_at: rating.updated_at,
    }));

    // Calculate stats
    const total_count = ratingsWithUser.length;
    const avg_overall = total_count > 0
      ? ratingsWithUser.reduce((sum: number, r: any) => sum + (r.overall_rating || 0), 0) / total_count
      : 0;

    return NextResponse.json({
      ratings: ratingsWithUser,
      total_count,
      avg_overall: Number(avg_overall.toFixed(1)),
    });

  } catch (error) {
    console.error('Error in /api/cafes/[id]/ratings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
