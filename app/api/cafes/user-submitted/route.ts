import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getServerSession } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, googleMapsLink, location } = body;

    // Validation
    if (!name || !googleMapsLink || !location) {
      return NextResponse.json(
        { error: 'Missing required fields: name, googleMapsLink, location' },
        { status: 400 }
      );
    }

    if (!location.lat || !location.lng) {
      return NextResponse.json(
        { error: 'Invalid location: must include lat and lng' },
        { status: 400 }
      );
    }

    // Validate Google Maps link format
    const googleMapsPattern = /^https:\/\/(www\.)?google\.[a-z]+\/maps/i;
    if (!googleMapsPattern.test(googleMapsLink)) {
      return NextResponse.json(
        { error: 'Invalid Google Maps link format' },
        { status: 400 }
      );
    }

    // Get user_id from auth session
    const session = await getServerSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Insert into user_submitted_cafes table
    const { data, error } = await supabaseAdmin
      .from('user_submitted_cafes')
      .insert({
        name: name.trim(),
        google_maps_link: googleMapsLink.trim(),
        location: `POINT(${location.lng} ${location.lat})`,
        submitted_by: userId,
        status: 'pending', // Default status for review
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save cafe submission', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Cafe submitted successfully',
        cafe: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/cafes/user-submitted:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cafes/user-submitted
 * Get all cafes submitted by the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get user_id from auth session
    const session = await getServerSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch user's submitted cafes
    const { data, error } = await supabaseAdmin
      .from('user_submitted_cafes')
      .select('*')
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch submissions', details: error.message },
        { status: 500 }
      );
    }

    // Parse location from PostGIS format
    const submissions = (data || []).map((submission: any) => {
      let latitude: number | null = null;
      let longitude: number | null = null;
      
      if (submission.location) {
        // Extract lat/lng from PostGIS POINT format
        const match = submission.location.match(/POINT\(([^ ]+) ([^ ]+)\)/);
        if (match) {
          longitude = parseFloat(match[1]);
          latitude = parseFloat(match[2]);
        }
      }

      return {
        ...submission,
        latitude,
        longitude,
      };
    });

    return NextResponse.json(
      {
        success: true,
        submissions,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in GET /api/cafes/user-submitted:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
