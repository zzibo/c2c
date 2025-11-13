'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';

// Dynamically import MapView to avoid SSR issues with Mapbox
const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  // You'll need to get a Mapbox API key from https://account.mapbox.com/
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-md p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Missing Mapbox Token</h1>
          <p className="text-gray-700 mb-4">
            To use the map, you need to set up a Mapbox API key:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 mb-4">
            <li>Go to <a href="https://account.mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">account.mapbox.com</a></li>
            <li>Sign up or log in</li>
            <li>Get your access token</li>
            <li>Create a <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file</li>
            <li>Add: <code className="bg-gray-100 px-2 py-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here</code></li>
          </ol>
          <p className="text-xs text-gray-500">
            Then restart the dev server: <code className="bg-gray-100 px-2 py-1 rounded">npm run dev</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="w-full h-screen">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-10 bg-white/90 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/assets/c2c-icon.png"
                alt="C2C Logo"
                width={40}
                height={40}
                className="w-10 h-10"
                unoptimized
                priority
              />
              <div className="flex flex-col">
                <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  C2C
                </div>
                <p className="text-xs text-gray-600 hidden sm:block">
                  Cafe to Code
                </p>
              </div>
            </div>
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Map - takes full screen */}
      <div className="w-full h-full pt-[72px]">
        <MapView apiKey={MAPBOX_TOKEN} />
      </div>
    </main>
  );
}
