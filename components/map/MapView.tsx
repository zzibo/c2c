'use client';

import { useEffect, useRef, useState } from 'react';
import Map, { Marker, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox';
import Image from 'next/image';
import { MapPin, Clock, Star, Phone, Globe, ChevronLeft, ChevronRight } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Coordinate, Cafe } from '@/types/cafe';

interface MapViewProps {
  apiKey: string;
  initialCenter?: Coordinate;
  initialZoom?: number;
}

export default function MapView({
  apiKey,
  initialCenter = { lat: 37.7749, lng: -122.4194 }, // San Francisco default
  initialZoom = 13
}: MapViewProps) {
  const mapRef = useRef<any>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cafeItemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [viewState, setViewState] = useState({
    longitude: initialCenter.lng,
    latitude: initialCenter.lat,
    zoom: initialZoom
  });
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(coords);
          setViewState({
            longitude: coords.lng,
            latitude: coords.lat,
            zoom: 15
          });
        },
        (error) => {
          console.error('Error getting user location:', error);
        }
      );
    }
  }, []);

  // Resize map when panel collapses/expands
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        try {
          // Try to get the underlying Mapbox map instance and call resize
          const map = mapRef.current.getMap();
          if (map && typeof map.resize === 'function') {
            map.resize();
          }
        } catch (error) {
          // Fallback: trigger window resize event which react-map-gl listens to
          window.dispatchEvent(new Event('resize'));
        }
      } else {
        // If ref not ready, trigger window resize as fallback
        window.dispatchEvent(new Event('resize'));
      }
    }, 350); // Slightly longer than transition to ensure DOM has updated

    return () => clearTimeout(timer);
  }, [isPanelCollapsed]);

  // Function to search for cafes around user location
  const searchAroundMe = async () => {
    // Prevent multiple simultaneous searches
    if (isSearching) {
      return;
    }

    if (!userLocation) {
      setSearchError('Location not available. Please enable location access.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(
        `/api/cafes/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch cafes');
      }

      const sortedCafes = (data.cafes || []).sort((a: Cafe, b: Cafe) => {
        const distA = a.distance || Infinity;
        const distB = b.distance || Infinity;
        return distA - distB;
      });
      setCafes(sortedCafes);
      setSelectedCafeId(null);
      console.log(`Found ${data.count} cafes within 2 miles`);
    } catch (error) {
      console.error('Error searching for cafes:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to search cafes');
    } finally {
      setIsSearching(false);
    }
  };

  // Function to search cafes by name
  const searchCafesByName = async (query: string) => {
    // Prevent multiple simultaneous searches
    if (isSearching) {
      return;
    }

    if (!query.trim()) {
      setSearchError('Please enter a cafe name to search');
      return;
    }

    if (!userLocation) {
      setSearchError('Location not available. Please enable location access.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(
        `/api/cafes/search?q=${encodeURIComponent(query)}&lat=${userLocation.lat}&lng=${userLocation.lng}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search cafes');
      }

      const sortedCafes = (data.cafes || []).sort((a: Cafe, b: Cafe) => {
        const distA = a.distance || Infinity;
        const distB = b.distance || Infinity;
        return distA - distB;
      });
      setCafes(sortedCafes);
      setSelectedCafeId(null);
      console.log(`Found ${data.count} cafes matching "${query}"`);
    } catch (error) {
      console.error('Error searching cafes:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to search cafes');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Prevent if already searching
    if (isSearching) {
      return;
    }
    if (searchQuery.trim()) {
      searchCafesByName(searchQuery);
    }
  };

  // Handle search button click (separate from form submit)
  const handleSearchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Prevent if already searching
    if (isSearching) {
      return;
    }
    if (searchQuery.trim()) {
      searchCafesByName(searchQuery);
    }
  };

  // Handle cafe panel item click - center map on pin
  const handleCafeClick = (cafe: Cafe) => {
    setSelectedCafeId(cafe.id);
    setViewState({
      longitude: cafe.location.lng,
      latitude: cafe.location.lat,
      zoom: Math.max(viewState.zoom, 15)
    });
  };

  // Handle pin click - scroll panel to cafe
  const handlePinClick = (cafe: Cafe, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCafeId(cafe.id);

    // Center map on pin
    setViewState({
      longitude: cafe.location.lng,
      latitude: cafe.location.lat,
      zoom: Math.max(viewState.zoom, 15)
    });

    // Scroll panel item into view after a short delay to ensure DOM update
    setTimeout(() => {
      const itemRef = cafeItemRefs.current[cafe.id];
      if (itemRef && panelRef.current && !isPanelCollapsed) {
        itemRef.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  // Handle panel collapse/expand
  const handlePanelToggle = (collapsed: boolean) => {
    setIsPanelCollapsed(collapsed);
    // Map resize is handled by useEffect hook
  };

  // Format distance helper
  const formatDistance = (distanceMeters?: number): string => {
    if (!distanceMeters) return 'Distance unknown';
    const miles = distanceMeters / 1609.34;
    if (miles < 0.1) {
      return `${Math.round(distanceMeters)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  };

  // Format hours helper
  const formatHours = (hoursText?: string): string => {
    if (!hoursText) return 'Hours not available';
    return hoursText;
  };

  return (
    <div className="w-full h-full relative flex">
      {/* Left Panel */}
      <div className={`${isPanelCollapsed ? 'w-0 min-w-0' : 'w-96'} flex-shrink-0 bg-pixel-beige border-r-4 border-pixel-text-dark flex flex-col transition-all duration-300 overflow-hidden relative z-30`}>

        {/* Search Bar in Panel */}
        <div className={`p-4 border-b-4 border-pixel-text-dark ${isPanelCollapsed ? 'hidden' : ''}`}>
          <form onSubmit={handleSearchSubmit} className="mb-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchSubmit(e as any);
                    }
                  }}
                  placeholder="Search cafes..."
                  className="w-full px-4 py-2 pl-10 shadow-pixel-sm bg-pixel-cream border-3 border-pixel-text-dark focus:outline-none focus:border-pixel-copper text-pixel-text-dark placeholder-pixel-brown text-sm font-mono"
                  style={{ borderRadius: 0 }}
                  disabled={!userLocation || isSearching}
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-pixel-brown"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                type="submit"
                onClick={handleSearchClick}
                disabled={!userLocation || isSearching || !searchQuery.trim()}
                className="bg-pixel-copper hover:bg-pixel-brown disabled:bg-pixel-brown disabled:pointer-events-none text-pixel-text-light font-pixel px-4 py-2 shadow-pixel-sm transition-all text-xs disabled:cursor-not-allowed"
                style={{ borderRadius: 0 }}
              >
                SEARCH
              </button>
            </div>
          </form>

          {/* Search Around Me Button */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Prevent if already searching or disabled
                if (isSearching || !userLocation) {
                  return;
                }
                searchAroundMe();
              }}
              disabled={!userLocation || isSearching}
              className="bg-pixel-copper hover:bg-pixel-brown disabled:bg-pixel-brown disabled:pointer-events-none text-pixel-text-light font-pixel px-4 py-2 shadow-pixel-sm transition-all text-xs disabled:cursor-not-allowed flex items-center gap-2 flex-1"
              style={{ borderRadius: 0 }}
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="font-mono text-xs">SEARCHING...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-mono text-xs">NEARBY (2MI)</span>
                </>
              )}
            </button>

            {/* Results count */}
            {cafes.length > 0 && (
              <div className="bg-pixel-copper text-pixel-text-light px-3 py-2 shadow-pixel-sm text-xs font-pixel flex items-center" style={{ borderRadius: 0 }}>
                {cafes.length}
              </div>
            )}
          </div>

          {/* Error message */}
          {searchError && (
            <div className="mt-2 bg-pixel-copper text-pixel-text-light px-3 py-2 shadow-pixel-sm text-xs font-mono border-3 border-pixel-text-dark" style={{ borderRadius: 0 }}>
              {searchError}
            </div>
          )}
        </div>

        {/* Cafe List Panel */}
        {!isPanelCollapsed && (
          <>
            {cafes.length > 0 ? (
              <div
                ref={panelRef}
                className="flex-1 overflow-y-auto"
              >
                <div className="p-4 space-y-3">
                  {cafes.map((cafe, index) => (
                    <div
                      key={cafe.id}
                      ref={(el) => {
                        cafeItemRefs.current[cafe.id] = el;
                      }}
                      onClick={() => handleCafeClick(cafe)}
                      className={`p-4 cursor-pointer transition-all border-3 shadow-pixel-sm ${selectedCafeId === cafe.id
                        ? 'border-pixel-copper bg-pixel-terracotta'
                        : 'border-pixel-text-dark bg-pixel-cream hover:bg-pixel-beige'
                        }`}
                      style={{ borderRadius: 0 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Cafe name and ranking */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-pixel text-pixel-brown w-6">
                              #{index + 1}
                            </span>
                            <h3 className="text-sm font-pixel text-pixel-text-dark truncate">
                              {cafe.name.toUpperCase()}
                            </h3>
                          </div>

                          {/* Distance */}
                          <div className="flex items-center gap-1 text-xs text-pixel-brown mb-2 font-mono">
                            <MapPin size={12} className="text-pixel-copper" />
                            <span>{formatDistance(cafe.distance)}</span>
                          </div>

                          {/* Address */}
                          {cafe.address && (
                            <p className="text-xs text-pixel-brown mb-2 line-clamp-1 font-mono">
                              {cafe.address}
                            </p>
                          )}

                          {/* Ratings */}
                          {cafe.ratings.overall > 0 && (
                            <div className="flex items-center gap-1 mb-2">
                              <Star size={12} className="text-pixel-copper fill-pixel-copper" />
                              <span className="text-xs font-mono font-semibold text-pixel-text-dark">
                                {cafe.ratings.overall.toFixed(1)}
                              </span>
                              {cafe.totalReviews > 0 && (
                                <span className="text-xs text-pixel-brown font-mono">
                                  ({cafe.totalReviews} {cafe.totalReviews === 1 ? 'review' : 'reviews'})
                                </span>
                              )}
                            </div>
                          )}

                          {/* Hours */}
                          {(cafe as any).hourstText && (
                            <div className="flex items-start gap-1 text-xs text-pixel-brown mb-2 font-mono">
                              <Clock size={12} className="text-pixel-brown mt-0.5 flex-shrink-0" />
                              <span className="line-clamp-1">
                                {formatHours((cafe as any).hourstText)}
                              </span>
                            </div>
                          )}

                          {/* Contact info */}
                          <div className="flex items-center gap-3 mt-2">
                            {(cafe as any).phone && (
                              <div className="flex items-center gap-1 text-xs text-pixel-brown font-mono">
                                <Phone size={10} />
                                <span>{(cafe as any).phone}</span>
                              </div>
                            )}
                            {cafe.website && (
                              <a
                                href={cafe.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-pixel-copper hover:text-pixel-brown font-mono border-b border-pixel-copper"
                              >
                                <Globe size={10} />
                                <span>WEBSITE</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center text-pixel-brown">
                  <p className="text-sm font-pixel mb-2">NO CAFES FOUND</p>
                  <p className="text-xs font-mono">Search for cafes to see results here</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Panel Toggle Button - Always visible outside panel */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handlePanelToggle(!isPanelCollapsed);
        }}
        className={`absolute ${isPanelCollapsed ? 'left-4' : 'left-[400px]'} top-4 z-40 bg-pixel-beige border-3 border-pixel-text-dark p-2 shadow-pixel-sm hover:bg-pixel-terracotta transition-all`}
        style={{ borderRadius: 0 }}
        aria-label={isPanelCollapsed ? "Expand panel" : "Collapse panel"}
      >
        {isPanelCollapsed ? (
          <ChevronRight size={18} className="text-pixel-text-dark" />
        ) : (
          <ChevronLeft size={18} className="text-pixel-text-dark" />
        )}
      </button>

      {/* Map Container */}
      <div className="flex-1 relative min-w-0">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapboxAccessToken={apiKey}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Navigation controls (zoom in/out) */}
          <NavigationControl position="top-right" />

          {/* Geolocate control (re-center on user) */}
          <GeolocateControl
            position="top-right"
            trackUserLocation
            showUserHeading
          />

          {/* User location marker */}
          {userLocation && (
            <Marker
              longitude={userLocation.lng}
              latitude={userLocation.lat}
              anchor="center"
            >
              <div className="relative">
                {/* Pulsing circle effect */}
                <div className="absolute -inset-2 bg-pixel-copper rounded-full opacity-20 animate-ping" />
                {/* Center dot */}
                <div className="w-4 h-4 bg-pixel-copper rounded-full border-2 border-white shadow-lg" />
              </div>
            </Marker>
          )}

          {/* Cafe markers */}
          {cafes.map((cafe) => {
            // Calculate pin size based on zoom level (base size 50, scales with zoom)
            const baseSize = 50;
            const zoomScale = Math.max(0.8, Math.min(1.5, viewState.zoom / 13)); // Scale between 0.8x and 1.5x based on zoom
            const pinSize = baseSize * zoomScale;
            const iconSize = Math.round(24 * zoomScale);
            const iconTop = Math.round(8 * zoomScale);

            return (
              <Marker
                key={cafe.id}
                longitude={cafe.location.lng}
                latitude={cafe.location.lat}
                anchor="bottom"
              >
                <div
                  className={`relative group cursor-pointer ${selectedCafeId === cafe.id ? 'z-20' : ''}`}
                  onClick={(e) => handlePinClick(cafe, e)}
                >
                  {/* Pin shape with coffee icon inside */}
                  <div className={`transform transition-transform hover:scale-110 relative ${selectedCafeId === cafe.id ? 'scale-110' : ''}`}>
                    {/* Map pin icon */}
                    <MapPin
                      size={pinSize}
                      className={`drop-shadow-lg ${selectedCafeId === cafe.id ? 'text-pixel-beige' : 'text-blue-500'}`}
                      fill={selectedCafeId === cafe.id ? '#f5e6d3' : 'white'}
                      stroke={selectedCafeId === cafe.id ? '#f5e6d3' : 'white'}
                    />
                    {/* Coffee icon inside the pin - centered in the circular part */}
                    <div
                      className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center"
                      style={{
                        top: `${iconTop}px`,
                        width: `${iconSize}px`,
                        height: `${iconSize}px`,
                        backgroundColor: selectedCafeId === cafe.id ? '#f5e6d3' : 'transparent',
                        borderRadius: 0
                      }}
                    >
                      <Image
                        src="/assets/cafe-icon.png"
                        alt="Cafe"
                        width={iconSize}
                        height={iconSize}
                        className="object-contain pixel-image"
                        unoptimized
                      />
                    </div>
                  </div>

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-pixel-beige border-3 border-pixel-text-dark px-3 py-2 shadow-pixel-sm whitespace-nowrap" style={{ borderRadius: 0 }}>
                      <p className="font-pixel text-xs text-pixel-text-dark">{cafe.name.toUpperCase()}</p>
                      <p className="text-xs text-pixel-brown font-mono">
                        {cafe.distance ? `${(cafe.distance / 1609.34).toFixed(2)} mi` : 'Distance unknown'}
                      </p>
                      {cafe.ratings.overall > 0 && (
                        <p className="text-xs text-pixel-copper font-mono">★ {cafe.ratings.overall.toFixed(1)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Marker>
            );
          })}
        </Map>
      </div>

      {/* Location status indicator */}
      {userLocation && (
        <div className="absolute bottom-4 left-4 bg-pixel-beige border-3 border-pixel-text-dark px-4 py-2 shadow-pixel-sm text-xs font-mono" style={{ borderRadius: 0 }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-pixel-copper animate-pulse" style={{ borderRadius: 0 }} />
            <span className="text-pixel-text-dark">
              LOC: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
