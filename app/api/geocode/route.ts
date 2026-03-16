import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  const lat = request.nextUrl.searchParams.get('lat');
  const lng = request.nextUrl.searchParams.get('lng');

  if (!q || !lat || !lng) {
    return NextResponse.json(
      { error: 'Missing required parameters: q, lat, lng' },
      { status: 400 }
    );
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Mapbox token not configured' },
      { status: 500 }
    );
  }

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
    );
    url.searchParams.set('access_token', token);
    url.searchParams.set('autocomplete', 'true');
    url.searchParams.set('proximity', `${lng},${lat}`);
    url.searchParams.set('types', 'address,place,locality');
    url.searchParams.set('limit', '3');
    url.searchParams.set('country', 'us,sg');

    const response = await fetch(url.toString());

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Mapbox geocoding request failed' },
        { status: 502 }
      );
    }

    const data = await response.json();

    const suggestions = (data.features || []).map(
      (f: { place_name: string; center: number[] }) => ({
        label: f.place_name,
        lat: f.center[1],
        lng: f.center[0],
      })
    );

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json(
      { error: 'Failed to geocode address' },
      { status: 500 }
    );
  }
}
