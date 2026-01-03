import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getServerSession } from '@/lib/auth-server';

/**
 * GET /api/ratings/check?cafe_id={id}
 * Check if the current user has rated a specific cafe
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const cafe_id = searchParams.get('cafe_id');

    if (!cafe_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: cafe_id' },
        { status: 400 }
      );
    }

    // Get current user session
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { hasRated: false, rating: null },
        { status: 200 }
      );
    }

    const user_id = session.user.id;

    // Look up cafe by geoapify_place_id (frontend sends this as cafe.id)
    const { data: cafeData, error: cafeError } = await supabaseAdmin
      .from('cafes')
      .select('id')
      .eq('geoapify_place_id', cafe_id)
      .single();

    if (cafeError || !cafeData) {
      console.error('Error looking up cafe:', cafeError || 'Cafe not found', { cafe_id });
      return NextResponse.json(
        { error: `Cafe not found: ${cafe_id}` },
        { status: 404 }
      );
    }

    const cafe_uuid = cafeData.id;

    // Query for existing rating
    const { data: rating, error } = await supabaseAdmin
      .from('ratings')
      .select('*')
      .eq('cafe_id', cafe_uuid)
      .eq('user_id', user_id)
      .single();

    if (error) {
      // No rating found (PGRST116 = no rows returned)
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          hasRated: false,
          rating: null,
        });
      }

      console.error('Error checking rating:', error);
      return NextResponse.json(
        { error: 'Failed to check rating status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasRated: true,
      rating,
    });

  } catch (error) {
    console.error('Error in /api/ratings/check:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
