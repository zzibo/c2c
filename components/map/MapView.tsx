'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Map, { Marker, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useQuery } from '@tanstack/react-query';
import type { Coordinate, Cafe } from '@/types/cafe';
import RatingPanel from '@/components/cafe/RatingPanel';
import ExpandedCafeView from '@/components/cafe/ExpandedCafeView';
import { CafeSidebar } from '@/components/map/CafeSidebar';
import { CafeMarker } from '@/components/map/CafeMarker';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAppStore } from '@/lib/store/AppStore';
import { loadMapState, saveMapState, clearMapState } from '@/lib/storage/mapStorage';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useToast } from '@/lib/toast/ToastContext';

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
  
  // Check for simulated location flag
  const simulateLocation = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_SIMULATE_LOCATION : undefined;
  
  // Load persisted state from localStorage (but skip if simulation is enabled)
  const persistedState = simulateLocation === 'sg' ? null : loadMapState();
  
  const [viewState, setViewStateInternal] = useState({
    longitude: persistedState?.viewState?.longitude ?? initialCenter.lng,
    latitude: persistedState?.viewState?.latitude ?? initialCenter.lat,
    zoom: persistedState?.viewState?.zoom ?? initialZoom
  });
  const [userLocation, setUserLocationInternal] = useState<Coordinate | null>(persistedState?.userLocation ?? null);
  const [cafes, setCafesInternal] = useState<Cafe[]>(persistedState?.cafes ?? []);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [selectedCafeForRating, setSelectedCafeForRating] = useState<Cafe | null>(null);
  const [showRatingPanel, setShowRatingPanel] = useState(false);
  const [showExpandedView, setShowExpandedView] = useState(false);

  // Modal state for "No cafes nearby" prompt
  const [showNoCafesModal, setShowNoCafesModal] = useState(false);
  const [isSearchingGeoapify, setIsSearchingGeoapify] = useState(false);

  // Track map viewport bounds for viewport-based loading
  const [mapBounds, setMapBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  // Use AppStore for global state management (replaces SearchContext + SidebarContext)
  const { state, setSearchQuery, setActiveSearchQuery, setPanelCollapsed, registerSearchHandler } = useAppStore();
  const { searchQuery: searchQueryContext, activeSearchQuery, isPanelCollapsed, searchFilters } = state;
  const { showToast } = useToast();

  // Search Query - fetches cafes by name
  const {
    data: searchData,
    isLoading: isSearchingQuery,
    error: searchQueryError,
  } = useQuery({
    queryKey: ['cafes-search', activeSearchQuery, userLocation, searchFilters],
    queryFn: async () => {
      if (!activeSearchQuery || !userLocation) return { cafes: [] };

      // Build query string with filters
      const params = new URLSearchParams({
        q: activeSearchQuery,
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
      });

      // Add filter parameters
      if (searchFilters.maxDistance > 0) params.append('maxDistance', searchFilters.maxDistance.toString());
      if (searchFilters.minOverallRating > 0) params.append('minOverallRating', searchFilters.minOverallRating.toString());
      if (searchFilters.minWifiRating > 0) params.append('minWifiRating', searchFilters.minWifiRating.toString());
      if (searchFilters.minOutletsRating > 0) params.append('minOutletsRating', searchFilters.minOutletsRating.toString());
      if (searchFilters.minCoffeeRating > 0) params.append('minCoffeeRating', searchFilters.minCoffeeRating.toString());
      if (searchFilters.minVibeRating > 0) params.append('minVibeRating', searchFilters.minVibeRating.toString());
      if (searchFilters.minSeatingRating > 0) params.append('minSeatingRating', searchFilters.minSeatingRating.toString());
      if (searchFilters.minNoiseRating > 0) params.append('minNoiseRating', searchFilters.minNoiseRating.toString());
      if (searchFilters.minReviews > 0) params.append('minReviews', searchFilters.minReviews.toString());
      params.append('sortBy', searchFilters.sortBy);
      if (searchFilters.hasWifi !== null) params.append('hasWifi', searchFilters.hasWifi.toString());
      if (searchFilters.hasOutlets !== null) params.append('hasOutlets', searchFilters.hasOutlets.toString());
      if (searchFilters.goodForWork !== null) params.append('goodForWork', searchFilters.goodForWork.toString());
      if (searchFilters.quietWorkspace !== null) params.append('quietWorkspace', searchFilters.quietWorkspace.toString());
      if (searchFilters.spacious !== null) params.append('spacious', searchFilters.spacious.toString());
      if (searchFilters.maxPriceLevel > 0) params.append('maxPriceLevel', searchFilters.maxPriceLevel.toString());

      const response = await fetch(`/api/cafes/search?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to search cafes');
      }

      const data = await response.json();

      // API already handles sorting based on filters
      return { cafes: data.cafes || [], count: data.count || 0 };
    },
    enabled: !!activeSearchQuery && !!userLocation,  // Only fetch when there's an active search
    staleTime: 60000,  // Cache for 1 minute
    gcTime: 300000,    // Keep in cache for 5 minutes
  });

  // Viewport Query - fetches cafes in map bounds
  const {
    data: viewportData,
    isLoading: isLoadingViewport,
    error: viewportError,
  } = useQuery({
    queryKey: ['cafes-viewport', mapBounds, searchFilters],
    queryFn: async () => {
      if (!mapBounds) return { cafes: [] };

      console.log('🗺️ VIEWPORT QUERY TRIGGERED:', {
        bounds: mapBounds,
        activeSearchQuery
      });

      // Build query string with filters
      const params = new URLSearchParams({
        north: mapBounds.north.toString(),
        south: mapBounds.south.toString(),
        east: mapBounds.east.toString(),
        west: mapBounds.west.toString(),
      });

      // Add filter parameters
      if (searchFilters.minOverallRating > 0) params.append('minOverallRating', searchFilters.minOverallRating.toString());
      if (searchFilters.minWifiRating > 0) params.append('minWifiRating', searchFilters.minWifiRating.toString());
      if (searchFilters.minOutletsRating > 0) params.append('minOutletsRating', searchFilters.minOutletsRating.toString());
      if (searchFilters.minCoffeeRating > 0) params.append('minCoffeeRating', searchFilters.minCoffeeRating.toString());
      if (searchFilters.minVibeRating > 0) params.append('minVibeRating', searchFilters.minVibeRating.toString());
      if (searchFilters.minSeatingRating > 0) params.append('minSeatingRating', searchFilters.minSeatingRating.toString());
      if (searchFilters.minNoiseRating > 0) params.append('minNoiseRating', searchFilters.minNoiseRating.toString());
      if (searchFilters.minReviews > 0) params.append('minReviews', searchFilters.minReviews.toString());
      params.append('sortBy', searchFilters.sortBy);
      if (searchFilters.hasWifi !== null) params.append('hasWifi', searchFilters.hasWifi.toString());
      if (searchFilters.hasOutlets !== null) params.append('hasOutlets', searchFilters.hasOutlets.toString());
      if (searchFilters.goodForWork !== null) params.append('goodForWork', searchFilters.goodForWork.toString());
      if (searchFilters.quietWorkspace !== null) params.append('quietWorkspace', searchFilters.quietWorkspace.toString());
      if (searchFilters.spacious !== null) params.append('spacious', searchFilters.spacious.toString());
      if (searchFilters.maxPriceLevel > 0) params.append('maxPriceLevel', searchFilters.maxPriceLevel.toString());

      const response = await fetch(`/api/cafes/viewport?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        console.error('❌ Viewport API error:', data);
        throw new Error(data.error || 'Failed to fetch cafes');
      }

      const result = await response.json();
      console.log('✅ Viewport API response:', result);
      return result;
    },
    enabled: !!mapBounds && !activeSearchQuery,  // Only fetch when NOT searching
    staleTime: 60000,  // Cache for 1 minute
    gcTime: 300000,    // Keep in cache for 5 minutes
  });

  // Determine which cafes to display based on active query
  const displayedCafes = useMemo(() => {
    if (activeSearchQuery && searchData?.cafes) {
      return searchData.cafes;
    }
    if (viewportData?.cafes) {
      return viewportData.cafes;
    }
    return [];
  }, [activeSearchQuery, searchData, viewportData]);

  // Update cafes when displayed data changes
  useEffect(() => {
    setCafes(displayedCafes);
  }, [displayedCafes]);

  // Sync search error state and show toast on successful search
  useEffect(() => {
    if (searchQueryError) {
      setSearchError(searchQueryError instanceof Error ? searchQueryError.message : 'Failed to search cafes');
    } else if (activeSearchQuery && searchData?.cafes.length === 0) {
      setSearchError(`No cafes found matching "${activeSearchQuery}"`);
    } else {
      setSearchError(null);
    }

    // Show toast notification when search completes successfully
    if (activeSearchQuery && searchData?.cafes && !searchQueryError) {
      const count = searchData.cafes.length;
      if (count > 0) {
        showToast(`Found ${count} ${count === 1 ? 'cafe' : 'cafes'} within 10 miles`, 3000);
      }
    }
  }, [searchQueryError, searchData, activeSearchQuery, showToast]);

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

  // Save when searchQuery changes (from context) - debounced
  useEffect(() => {
    debouncedSaveState();
  }, [searchQueryContext, debouncedSaveState]);

  useEffect(() => {
    // Check for simulated location (for testing) - check BEFORE checking persisted location
    const simulateLocation = process.env.NEXT_PUBLIC_SIMULATE_LOCATION;
    console.log('Simulate location env var:', simulateLocation); // Debug log
    if (simulateLocation === 'sg') {
      // Singapore coordinates (Marina Bay area)
      const singaporeCoords = { lat: 1.3521, lng: 103.8198 };
      console.log('✅ Simulating location: Singapore', singaporeCoords);
      setUserLocation(singaporeCoords);
      setSearchError(null); // Clear any location errors
      if (cafes.length === 0) {
        setViewState({
          longitude: singaporeCoords.lng,
          latitude: singaporeCoords.lat,
          zoom: 15
        });
      }
      return;
    }

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
    if (!map) {
      console.log('⚠️ updateMapBounds: map not ready');
      return;
      
    }

    const bounds = map.getBounds();
    const newBounds = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };

    console.log('📍 Updating map bounds:', newBounds);

    // NEVER automatically clear search when map moves
    // Search mode can only be exited by clicking "Nearby" or "X" button
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
    // Poll for map to be ready (in case it's not ready on first render)
    let pollCount = 0;
    const maxPolls = 20; // Try for up to 2 seconds (20 * 100ms)

    const setupMapListeners = () => {
      const map = mapRef.current?.getMap();
      if (!map) {
        pollCount++;
        if (pollCount < maxPolls) {
          console.log(`⏳ Map not ready yet (attempt ${pollCount}/${maxPolls}), retrying...`);
          setTimeout(setupMapListeners, 100);
        } else {
          console.error('❌ Map failed to initialize after 2 seconds');
        }
        return;
      }

      console.log('✅ Map ref ready, setting up bounds listeners');

      // Set initial bounds when map loads
      const handleMapLoad = () => {
        console.log('🗺️ Map loaded event - setting initial bounds');
        updateMapBounds();
      };

      // Update bounds when user pans or zooms
      const handleMapMove = () => {
        console.log('🔄 Map moved - debouncing bounds update');
        debouncedUpdateMapBounds();
      };

      // If map is already loaded, set bounds immediately
      if (map.loaded()) {
        console.log('🗺️ Map already loaded - setting bounds immediately');
        updateMapBounds();
      } else {
        console.log('⏳ Waiting for map load event...');
        map.once('load', handleMapLoad);
      }

      // Listen for map movement
      map.on('moveend', handleMapMove);
      map.on('zoomend', handleMapMove);

      // Cleanup function
      return () => {
        map.off('load', handleMapLoad);
        map.off('moveend', handleMapMove);
        map.off('zoomend', handleMapMove);
      };
    };

    const cleanup = setupMapListeners();

    // Return cleanup function if it exists
    return () => {
      if (cleanup) cleanup();
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
  const searchAroundMe = useCallback(async () => {
    if (!userLocation) {
      setSearchError('Location not available. Please enable location access.');
      return;
    }

    // Clear search query text, errors, and active search
    setSearchQuery('');
    setSearchError(null);
    setActiveSearchQuery(null);  // Switch back to viewport mode

    // Center map on user location
    const map = mapRef.current?.getMap();
    if (map) {
      // Listen for moveend event to update bounds and check for cafes
      const handleMoveEnd = async () => {
        updateMapBounds();
        map.off('moveend', handleMoveEnd); // Remove listener after firing once

        // After map settles, check if there are cafes nearby in the database
    try {
      const response = await fetch(
            `/api/cafes/viewport?` +
            `north=${userLocation.lat + 0.029}&south=${userLocation.lat - 0.029}&` + // ~2 miles
            `east=${userLocation.lng + 0.029}&west=${userLocation.lng - 0.029}`
      );

          if (response.ok) {
      const data = await response.json();
            console.log('Cafes in database nearby:', data.count);

            if (data.count === 0) {
              // No cafes found - show modal
              console.log('No cafes nearby - showing modal');
              setShowNoCafesModal(true);
            }
          }
    } catch (error) {
          console.error('Error checking nearby cafes:', error);
        }
      };

      map.once('moveend', handleMoveEnd);

      map.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        duration: 1000,
      });
    }
  }, [userLocation, setSearchQuery, setActiveSearchQuery, updateMapBounds]);

  // Function to search cafes by name - now uses TanStack Query
  const searchCafesByName = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchError('Please enter a cafe name to search');
      return;
    }

    if (!userLocation) {
      setSearchError('Location not available. Please enable location access.');
      return;
    }

    // Trigger search query by setting activeSearchQuery
    setActiveSearchQuery(query);
      setSelectedCafeId(null);

  }, [userLocation]);

  // Register search handler with SearchContext so AppHeader can trigger searches
  useEffect(() => {
    registerSearchHandler(searchCafesByName);
  }, [registerSearchHandler, searchCafesByName]);

  // Center map on first search result when search completes
  useEffect(() => {
    if (searchData?.cafes && searchData.cafes.length > 0 && activeSearchQuery) {
      const firstCafe = searchData.cafes[0];
      const map = mapRef.current?.getMap();
      if (map && firstCafe) {
        map.flyTo({
          center: [firstCafe.location.lng, firstCafe.location.lat],
          zoom: 15,
          duration: 1000,
        });
      }
    }
  }, [searchData, activeSearchQuery]);

  // Handle search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Prevent if already searching
    if (isSearchingQuery) {
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
    if (isSearchingQuery) {
      return;
    }
    if (searchQueryContext.trim()) {
      searchCafesByName(searchQueryContext);
    }
  };

  // Handle clear search - return to viewport mode
  const handleClearSearch = useCallback(() => {
    // Clear search query text
    setSearchQuery('');
    // Clear any search errors
    setSearchError(null);
    // Clear active search (triggers viewport mode)
    setActiveSearchQuery(null);
    // Force update map bounds to reload viewport cafes
    updateMapBounds();
  }, [setSearchQuery, setActiveSearchQuery, updateMapBounds]);

  // Handle "Search for cafes" confirmation from modal
  const handleSearchGeoapify = useCallback(async () => {
    if (!userLocation) return;

    setIsSearchingGeoapify(true);
    console.log('User confirmed - searching Geoapify for nearby cafes...');

    try {
      // Call the /api/cafes/nearby endpoint which will:
      // 1. Check database
      // 2. If < 10 cafes, fetch from Geoapify
      // 3. Populate database
      // 4. Return cafes
      const response = await fetch(
        `/api/cafes/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch cafes from Geoapify');
      }

      const data = await response.json();
      console.log('Fetched cafes from Geoapify:', data.count);

      // Update map bounds to trigger viewport query and display new cafes
      updateMapBounds();

      if (data.count === 0) {
        setSearchError('No cafes found in this area. Try a different location.');
      }
    } catch (error) {
      console.error('Error fetching from Geoapify:', error);
      setSearchError('Failed to search for cafes. Please try again.');
    } finally {
      setIsSearchingGeoapify(false);
    }
  }, [userLocation, updateMapBounds]);

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
    setPanelCollapsed(collapsed);
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
        isSearching={isSearchingQuery || isLoadingViewport || isSearchingGeoapify}
        searchError={searchError}
        searchQuery={searchQueryContext}
        onSearchQueryChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onSearchClick={handleSearchClick}
        onClearSearch={handleClearSearch}
        isShowingSearchResults={!!activeSearchQuery}
        onSearchAround={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isSearchingQuery || !userLocation) return;
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
          onExpand={() => {
            setShowRatingPanel(false);
            setShowExpandedView(true);
          }}
        />
      )}

      {/* Expanded Cafe View */}
      {selectedCafeForRating && (
        <ExpandedCafeView
          cafe={selectedCafeForRating}
          isOpen={showExpandedView}
          onClose={() => {
            setShowExpandedView(false);
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

      {/* No Cafes Nearby Modal */}
      <ConfirmModal
        isOpen={showNoCafesModal}
        onClose={() => setShowNoCafesModal(false)}
        onConfirm={handleSearchGeoapify}
        title="No Cafes Found Nearby"
        message="There aren't any cafes nearby in C2C. Would you like us to search and add cafes to the database?"
        confirmText={isSearchingGeoapify ? "Searching..." : "Yes, search for cafes"}
        cancelText="No, thanks"
        confirmVariant="primary"
      />
    </div>
  );
}
