import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // TODO: Get user_id from auth session when authentication is implemented
    // For now, we'll use a placeholder or null
    const userId = null; // Will be replaced with actual user ID from session

    // Insert into user_submitted_cafes table
    const { data, error } = await supabase
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
