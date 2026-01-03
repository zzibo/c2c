'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Map, { Marker, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox';
import Image from 'next/image';
import { MapPin, Star } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Coordinate, Cafe } from '@/types/cafe';
import RatingPanel from '@/components/cafe/RatingPanel';
import { CafeSidebar } from '@/components/map/CafeSidebar';
import { useSearch } from '@/lib/search/SearchContext';
import { loadMapState, saveMapState } from '@/lib/storage/mapStorage';
import { useServiceWorker } from '@/hooks/useServiceWorker';

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
  
  // Register service worker for map tile caching
  useServiceWorker();
  
  // Load persisted state from localStorage
  const persistedState = loadMapState();
  
  const [viewState, setViewStateInternal] = useState({
    longitude: persistedState?.viewState?.longitude ?? initialCenter.lng,
    latitude: persistedState?.viewState?.latitude ?? initialCenter.lat,
    zoom: persistedState?.viewState?.zoom ?? initialZoom
  });
  const [userLocation, setUserLocationInternal] = useState<Coordinate | null>(persistedState?.userLocation ?? null);
  const [cafes, setCafesInternal] = useState<Cafe[]>(persistedState?.cafes ?? []);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsedInternal] = useState(persistedState?.isPanelCollapsed ?? false);
  const [selectedCafeForRating, setSelectedCafeForRating] = useState<Cafe | null>(null);
  const [showRatingPanel, setShowRatingPanel] = useState(false);
  
  // Use SearchContext for shared search state
  const { searchQuery: searchQueryContext, setSearchQuery, isSearching, setIsSearching, registerSearchHandler } = useSearch();
  
  // Restore search query from localStorage (only once on mount)
  useEffect(() => {
    if (persistedState?.searchQuery) {
      setSearchQuery(persistedState.searchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use refs to track current values for saving
  const viewStateRef = useRef(viewState);
  const userLocationRef = useRef(userLocation);
  const cafesRef = useRef(cafes);
  const isPanelCollapsedRef = useRef(isPanelCollapsed);
  const searchQueryRef = useRef(searchQueryContext);

  // Update refs when state changes
  viewStateRef.current = viewState;
  userLocationRef.current = userLocation;
  cafesRef.current = cafes;
  isPanelCollapsedRef.current = isPanelCollapsed;
  searchQueryRef.current = searchQueryContext;

  // Helper function to save state
  const saveState = () => {
    saveMapState({
      viewState: viewStateRef.current,
      userLocation: userLocationRef.current,
      cafes: cafesRef.current,
      searchQuery: searchQueryRef.current,
      isPanelCollapsed: isPanelCollapsedRef.current
    });
  };

  // Wrapper setters that save automatically
  const setViewState = (value: typeof viewState | ((prev: typeof viewState) => typeof viewState)) => {
    setViewStateInternal(value);
    setTimeout(saveState, 0); // Save asynchronously to avoid blocking
  };

  const setUserLocation = (value: Coordinate | null | ((prev: Coordinate | null) => Coordinate | null)) => {
    setUserLocationInternal(value);
    setTimeout(saveState, 0);
  };

  const setCafes = (value: Cafe[] | ((prev: Cafe[]) => Cafe[])) => {
    setCafesInternal(value);
    setTimeout(saveState, 0);
  };

  const setIsPanelCollapsed = (value: boolean | ((prev: boolean) => boolean)) => {
    setIsPanelCollapsedInternal(value);
    setTimeout(saveState, 0);
  };

  // Save when searchQuery changes (from context)
  useEffect(() => {
    saveState();
  }, [searchQueryContext]);

  useEffect(() => {
    // Get user's current location (only if we don't have a persisted location)
    if (userLocation) {
      // Already have location from persistence, skip geolocation
      return;
    }
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('User location obtained:', coords);
          setUserLocation(coords);
          // Only update viewState if we don't have persisted cafes (meaning it's a fresh load)
          if (cafes.length === 0) {
            setViewState({
              longitude: coords.lng,
              latitude: coords.lat,
              zoom: 15
            });
          }
        },
        (error) => {
          // Only log unexpected errors, not permission denied (common user choice)
          if (error.code !== error.PERMISSION_DENIED) {
            console.warn('Geolocation error:', error.message || 'Location unavailable');
          }
          let errorMessage = 'Unable to get your location. ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Please enable location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location request timed out.';
              break;
            default:
              errorMessage += 'An unknown error occurred.';
          }
          setSearchError(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      console.error('Geolocation is not supported by this browser.');
      setSearchError('Geolocation is not supported by your browser.');
    }
  }, [userLocation, cafes]);

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
  const searchCafesByName = useCallback(async (query: string) => {
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
  }, [isSearching, userLocation, setIsSearching]);

  // Register search handler with SearchContext so AppHeader can trigger searches
  useEffect(() => {
    registerSearchHandler(searchCafesByName);
  }, [registerSearchHandler, searchCafesByName]);

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Prevent if already searching
    if (isSearching) {
      return;
    }
    if (searchQueryContext.trim()) {
      searchCafesByName(searchQueryContext);
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
    if (searchQueryContext.trim()) {
      searchCafesByName(searchQueryContext);
    }
  };

  // Handle cafe panel item click - open rating panel
  const handleCafeClick = (cafe: Cafe) => {
    console.log('Opening rating panel for:', cafe.name);
    setSelectedCafeId(cafe.id);
    setSelectedCafeForRating(cafe);
    setShowRatingPanel(true);

    // Center map on cafe
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
    <div className="w-full h-full relative">
      {/* Map base layer */}
      <div className="absolute inset-0">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapboxAccessToken={apiKey}
          mapStyle="mapbox://styles/zzibo/cmhww7iqz000r01sqbilwhha0"
          style={{ width: '100%', height: '100%' }}
          reuseMaps={true}
          antialias={true}
          preserveDrawingBuffer={false}
          transformRequest={(url, resourceType) => {
            // Add cache headers for better caching
            if (resourceType === 'Tile' && url.startsWith('https://api.mapbox.com')) {
              return {
                url,
                headers: {
                  'Cache-Control': 'public, max-age=31536000', // 1 year
                },
              };
            }
            return { url };
          }}
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
                <div className="absolute -inset-3 bg-c2c-orange rounded-full opacity-30 animate-ping" />
                {/* Center dot */}
                <div className="w-5 h-5 bg-c2c-orange rounded-full border-3 border-white shadow-lg relative z-10" />
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
                <div className="relative group">
                  <div
                    className={`relative cursor-pointer ${selectedCafeId === cafe.id ? 'z-20' : ''}`}
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
                  </div>

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-c2c-orange border-2 border-c2c-orange-dark px-3 py-2 shadow-lg whitespace-nowrap rounded-lg">
                      <p className="text-xs font-bold text-white font-sans">{cafe.name}</p>
                      <p className="text-xs text-white/90 font-sans">
                        {cafe.distance ? `${(cafe.distance / 1609.34).toFixed(2)} mi` : 'Distance unknown'}
                      </p>
                      {cafe.ratings.overall > 0 && (
                        <p className="text-xs text-white/90 font-sans">★ {cafe.ratings.overall.toFixed(1)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Marker>
            );
          })}
        </Map>
      </div>

      {/* Left Panel overlay */}
      <CafeSidebar
        isCollapsed={isPanelCollapsed}
        onToggle={handlePanelToggle}
        cafes={cafes}
        isSearching={isSearching}
        searchError={searchError}
        searchQuery={searchQueryContext}
        onSearchQueryChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onSearchClick={handleSearchClick}
        onSearchAround={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isSearching || !userLocation) return;
          searchAroundMe();
        }}
        userLocation={userLocation}
        selectedCafeId={selectedCafeId}
        onCafeClick={handleCafeClick}
        cafeItemRefs={cafeItemRefs}
        panelRef={panelRef}
        formatDistance={formatDistance}
      />

      {/* Location status indicator */}
      {userLocation && (
        <div className="absolute bottom-4 left-4 bg-c2c-orange border-2 border-c2c-orange-dark px-4 py-2 shadow-lg text-xs font-sans z-20 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white animate-pulse rounded-full" />
            <span className="text-white font-medium">
              LOC: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </span>
          </div>
        </div>
      )}

      {/* Rating Panel */}
      {selectedCafeForRating && (
        <RatingPanel
          cafe={selectedCafeForRating}
          isOpen={showRatingPanel}
          onClose={() => {
            setShowRatingPanel(false);
            setSelectedCafeForRating(null);
          }}
          onRatingSubmitted={() => {
            // Refresh cafe list to get updated ratings
            if (userLocation) {
              searchAroundMe();
            }
          }}
        />
      )}
    </div>
  );
}
