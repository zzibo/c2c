'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Map, { Marker, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useQuery } from '@tanstack/react-query';
import type { Coordinate, Cafe } from '@/types/cafe';
import RatingPanel from '@/components/cafe/RatingPanel';
import { CafeSidebar } from '@/components/map/CafeSidebar';
import { CafeMarker } from '@/components/map/CafeMarker';
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

  // Track map viewport bounds for viewport-based loading
  const [mapBounds, setMapBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  // Track if we're in "search results mode" (showing filtered results vs viewport results)
  const [isShowingSearchResults, setIsShowingSearchResults] = useState(false);

  // Use SearchContext for shared search state
  const { searchQuery: searchQueryContext, setSearchQuery, isSearching, setIsSearching, registerSearchHandler } = useSearch();

  // Viewport-based cafe loading using React Query
  const {
    data: viewportData,
    isLoading: isLoadingViewport,
    error: viewportError,
  } = useQuery({
    queryKey: ['cafes-viewport', mapBounds],
    queryFn: async () => {
      if (!mapBounds) return { cafes: [] };

      const response = await fetch(
        `/api/cafes/viewport?` +
        `north=${mapBounds.north}&south=${mapBounds.south}&` +
        `east=${mapBounds.east}&west=${mapBounds.west}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch cafes');
      }

      return response.json();
    },
    enabled: !!mapBounds && !isShowingSearchResults,  // Don't fetch if showing search results
    staleTime: 60000,  // Cache for 1 minute
    gcTime: 300000,    // Keep in cache for 5 minutes
  });

  // Update cafes when viewport data changes (only if not showing search results)
  useEffect(() => {
    if (viewportData?.cafes && !isShowingSearchResults) {
      setCafes(viewportData.cafes);
    }
  }, [viewportData, isShowingSearchResults]);

  // Handle viewport errors
  useEffect(() => {
    if (viewportError) {
      console.error('Viewport fetch error:', viewportError);
      setSearchError(viewportError instanceof Error ? viewportError.message : 'Failed to load cafes');
    }
  }, [viewportError]);

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

  // Debounce timer for saving state
  const saveStateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const DEBOUNCE_DELAY = 500; // Save 500ms after user stops interacting

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

  // Debounced save function
  const debouncedSaveState = useCallback(() => {
    // Clear existing timer
    if (saveStateTimerRef.current) {
      clearTimeout(saveStateTimerRef.current);
    }
    // Set new timer
    saveStateTimerRef.current = setTimeout(() => {
      saveState();
      saveStateTimerRef.current = null;
    }, DEBOUNCE_DELAY);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveStateTimerRef.current) {
        clearTimeout(saveStateTimerRef.current);
      }
    };
  }, []);

  // Wrapper setters that save automatically
  const setViewState = (value: typeof viewState | ((prev: typeof viewState) => typeof viewState)) => {
    setViewStateInternal(value);
    debouncedSaveState(); // Debounced save to avoid excessive writes
  };

  const setUserLocation = (value: Coordinate | null | ((prev: Coordinate | null) => Coordinate | null)) => {
    setUserLocationInternal(value);
    debouncedSaveState();
  };

  const setCafes = (value: Cafe[] | ((prev: Cafe[]) => Cafe[])) => {
    setCafesInternal(value);
    debouncedSaveState();
  };

  const setIsPanelCollapsed = (value: boolean | ((prev: boolean) => boolean)) => {
    setIsPanelCollapsedInternal(value);
    debouncedSaveState();
  };

  // Save when searchQuery changes (from context) - debounced
  useEffect(() => {
    debouncedSaveState();
  }, [searchQueryContext, debouncedSaveState]);

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

  // Debounced function to update map bounds (avoid API spam during pan/zoom)
  const updateMapBounds = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const bounds = map.getBounds();
    const newBounds = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };

    // Exit search results mode when user manually pans the map
    // This allows viewport-based loading to take over
    setIsShowingSearchResults(false);
    setMapBounds(newBounds);
  }, []);

  // Debounced version with 300ms delay
  const debouncedUpdateMapBounds = useMemo(
    () => {
      let timeoutId: NodeJS.Timeout | null = null;
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          updateMapBounds();
        }, 300);
      };
    },
    [updateMapBounds]
  );

  // Listen to map movement events and update bounds
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Set initial bounds when map loads
    const handleMapLoad = () => {
      updateMapBounds();
    };

    // Update bounds when user pans or zooms
    const handleMapMove = () => {
      debouncedUpdateMapBounds();
    };

    // If map is already loaded, set bounds immediately
    if (map.loaded()) {
      updateMapBounds();
    } else {
      map.once('load', handleMapLoad);
    }

    // Listen for map movement
    map.on('moveend', handleMapMove);
    map.on('zoomend', handleMapMove);

    return () => {
      map.off('load', handleMapLoad);
      map.off('moveend', handleMapMove);
      map.off('zoomend', handleMapMove);
    };
  }, [updateMapBounds, debouncedUpdateMapBounds]);

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

  // Helper function: Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }, []);

  // Calculate distances and sort cafes by distance from user
  const cafesWithDistance = useMemo(() => {
    if (!userLocation) return cafes;

    return cafes
      .map((cafe) => ({
        ...cafe,
        distance: calculateDistance(
          userLocation.lat,
          userLocation.lng,
          cafe.location.lat,
          cafe.location.lng
        ),
      }))
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }, [cafes, userLocation, calculateDistance]);

  // Function to search for cafes around user location
  const searchAroundMe = useCallback(() => {
    if (!userLocation) {
      setSearchError('Location not available. Please enable location access.');
      return;
    }

    // Clear any previous errors and exit search results mode
    setSearchError(null);
    setIsShowingSearchResults(false);  // Switch back to viewport mode

    // Center map on user location - viewport system will load cafes automatically
    const map = mapRef.current?.getMap();
    if (map) {
      map.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        duration: 1000,
      });
      console.log('Centering map on user location - viewport will load cafes');
    }
  }, [userLocation]);

  // Function to search cafes by name
  const searchCafesByName = useCallback(async (query: string) => {
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
      // Search for cafes by name
      const response = await fetch(
        `/api/cafes/search?q=${encodeURIComponent(query)}&lat=${userLocation.lat}&lng=${userLocation.lng}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search cafes');
      }

      const searchResults = data.cafes || [];

      if (searchResults.length === 0) {
        setSearchError(`No cafes found matching "${query}"`);
        setIsSearching(false);
        return;
      }

      // Sort by distance from user
      const sortedResults = searchResults.sort((a: Cafe, b: Cafe) => {
        const distA = a.distance || Infinity;
        const distB = b.distance || Infinity;
        return distA - distB;
      });

      // Enter search results mode - prevents viewport from overwriting results
      setIsShowingSearchResults(true);

      // Show search results in the sidebar
      setCafes(sortedResults);
      setSelectedCafeId(null);

      // Center map on the first result
      const firstCafe = sortedResults[0];
      const map = mapRef.current?.getMap();
      if (map && firstCafe) {
        map.flyTo({
          center: [firstCafe.location.lng, firstCafe.location.lat],
          zoom: 15,
          duration: 1000,
        });
      }

      console.log(`Found ${sortedResults.length} cafes matching "${query}"`);
    } catch (error) {
      console.error('Error searching cafes:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to search cafes');
    } finally {
      setIsSearching(false);
    }
  }, [userLocation, setIsSearching]);

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

  // Handle pin click - open rating panel and scroll panel to cafe
  const handlePinClick = (cafe: Cafe, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Opening rating panel for:', cafe.name);
    setSelectedCafeId(cafe.id);
    setSelectedCafeForRating(cafe);
    setShowRatingPanel(true);

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

          {/* Cafe markers - render non-selected first, then selected last so it's always on top */}
          {cafes
            .filter((cafe) => cafe.id !== selectedCafeId)
            .map((cafe) => (
              <CafeMarker
                key={cafe.id}
                cafe={cafe}
                isSelected={false}
                zoom={viewState.zoom}
                onClick={handlePinClick}
              />
            ))}
          
          {/* Selected marker rendered last - ensures it's always on top */}
          {selectedCafeId && cafes.find((cafe) => cafe.id === selectedCafeId) && (
            <CafeMarker
              key={`selected-${selectedCafeId}`}
              cafe={cafes.find((cafe) => cafe.id === selectedCafeId)!}
              isSelected={true}
              zoom={viewState.zoom}
              onClick={handlePinClick}
            />
          )}
        </Map>
      </div>

      {/* Loading indicator for viewport changes */}
      {isLoadingViewport && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40
                        bg-c2c-base/95 border-2 border-c2c-orange
                        px-4 py-2 rounded-full shadow-lg">
          <div className="flex items-center gap-2 text-c2c-orange">
            <div className="animate-spin h-4 w-4 border-2 border-c2c-orange
                            border-t-transparent rounded-full"></div>
            <span className="text-sm font-medium">Loading cafes...</span>
          </div>
        </div>
      )}

      {/* Left Panel overlay */}
      <CafeSidebar
        isCollapsed={isPanelCollapsed}
        onToggle={handlePanelToggle}
        cafes={cafesWithDistance}
        isSearching={isSearching || isLoadingViewport}
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
