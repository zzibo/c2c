'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Map, { Marker, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useQuery } from '@tanstack/react-query';
import type { Coordinate, Cafe, AddressSuggestion } from '@/types/cafe';
import { CafeSidebar } from '@/components/map/CafeSidebar';
import { CafeMarker } from '@/components/map/CafeMarker';
import { useAppStore } from '@/lib/store/AppStore';
import { loadMapState, saveMapState } from '@/lib/storage/mapStorage';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useToast } from '@/lib/toast/ToastContext';
import { MapPin } from 'lucide-react';
import Image from 'next/image';

// Lazy-load heavy modal/panel components (only rendered when needed)
const RatingPanel = dynamic(() => import('@/components/cafe/RatingPanel'));
const ExpandedCafeView = dynamic(() => import('@/components/cafe/ExpandedCafeView'));
const ConfirmModal = dynamic(() => import('@/components/ui/ConfirmModal').then(m => ({ default: m.ConfirmModal })));
const AddCafeModal = dynamic(() => import('@/components/cafe/AddCafeModal').then(m => ({ default: m.AddCafeModal })));

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
  const isMobile = useIsMobile();

  // Check for simulated location flag
  const simulateLocation = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_SIMULATE_LOCATION : undefined;
  
  // Load persisted state from localStorage (but skip if simulation is enabled)
  const persistedState = simulateLocation === 'sg' ? null : loadMapState();
  
  // Use a ref for viewState to avoid re-rendering on every map frame (60fps).
  // The Map component manages its own state via initialViewState (uncontrolled mode).
  const viewStateRef = useRef({
    longitude: persistedState?.viewState?.longitude ?? initialCenter.lng,
    latitude: persistedState?.viewState?.latitude ?? initialCenter.lat,
    zoom: persistedState?.viewState?.zoom ?? initialZoom
  });
  // Lightweight zoom state — only updated on zoomend (once per zoom gesture, not per frame)
  const [currentZoom, setCurrentZoom] = useState(viewStateRef.current.zoom);
  const [userLocation, setUserLocationInternal] = useState<Coordinate | null>(persistedState?.userLocation ?? null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [selectedCafeForRating, setSelectedCafeForRating] = useState<Cafe | null>(null);
  const [showRatingPanel, setShowRatingPanel] = useState(false);
  const [showExpandedView, setShowExpandedView] = useState(false);

  // Modal state for "No cafes nearby" prompt
  const [showNoCafesModal, setShowNoCafesModal] = useState(false);
  const [isSearchingGeoapify, setIsSearchingGeoapify] = useState(false);
  const [droppedPinLocation, setDroppedPinLocation] = useState<Coordinate | null>(null);
  const [isDroppedPinHovered, setIsDroppedPinHovered] = useState(false);
  const [droppedPinTooltipPosition, setDroppedPinTooltipPosition] = useState({ top: 0, left: 0 });
  const droppedPinRef = useRef<HTMLDivElement>(null);
  const [showAddCafeModal, setShowAddCafeModal] = useState(false);

  // Track map viewport bounds for viewport-based loading
  const [mapBounds, setMapBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  // Use AppStore for global state management (replaces SearchContext + SidebarContext)
  const { state, setSearchQuery, setActiveSearchQuery, setPanelCollapsed, registerSearchHandler, setAddCafeMode, setSearchedAddress, clearSearch } = useAppStore();
  const { searchQuery: searchQueryContext, activeSearchQuery, isPanelCollapsed, searchFilters, isAddCafeMode, searchedAddress } = state;
  const { showToast } = useToast();

  // Clear dropped pin when exiting add cafe mode
  useEffect(() => {
    if (!isAddCafeMode) {
      setDroppedPinLocation(null);
    }
  }, [isAddCafeMode]);

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
        throw new Error(data.error || 'Failed to fetch cafes');
      }

      const result = await response.json();
      return result;
    },
    enabled: !!mapBounds && !activeSearchQuery,  // Only fetch when NOT searching
    staleTime: 60000,  // Cache for 1 minute
    gcTime: 300000,    // Keep in cache for 5 minutes
  });

  // Determine which cafes to display based on active query
  const displayedCafes: Cafe[] = useMemo(() => {
    if (activeSearchQuery && searchData?.cafes) {
      return searchData.cafes;
    }
    if (viewportData?.cafes) {
      return viewportData.cafes;
    }
    return [];
  }, [activeSearchQuery, searchData, viewportData]);

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

  // Refs to track current values for saving (avoids re-renders)
  const userLocationRef = useRef(userLocation);
  const isPanelCollapsedRef = useRef(isPanelCollapsed);
  const searchQueryRef = useRef(searchQueryContext);

  // Update refs when state changes
  userLocationRef.current = userLocation;
  isPanelCollapsedRef.current = isPanelCollapsed;
  searchQueryRef.current = searchQueryContext;

  // Debounce timer for saving state
  const saveStateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const DEBOUNCE_DELAY = 500;

  // Helper function to save state
  const saveState = useCallback(() => {
    saveMapState({
      viewState: viewStateRef.current,
      userLocation: userLocationRef.current,
      searchQuery: searchQueryRef.current,
      isPanelCollapsed: isPanelCollapsedRef.current
    });
  }, []);

  // Debounced save function
  const debouncedSaveState = useCallback(() => {
    if (saveStateTimerRef.current) {
      clearTimeout(saveStateTimerRef.current);
    }
    saveStateTimerRef.current = setTimeout(() => {
      saveState();
      saveStateTimerRef.current = null;
    }, DEBOUNCE_DELAY);
  }, [saveState]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveStateTimerRef.current) {
        clearTimeout(saveStateTimerRef.current);
      }
    };
  }, []);

  // setUserLocation wrapper that also saves
  const setUserLocation = (value: Coordinate | null | ((prev: Coordinate | null) => Coordinate | null)) => {
    setUserLocationInternal(value);
    debouncedSaveState();
  };

  // Save when searchQuery changes (from context) - debounced
  useEffect(() => {
    debouncedSaveState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQueryContext]);

  useEffect(() => {
    // Check for simulated location (for testing) - check BEFORE checking persisted location
    const simulateLocation = process.env.NEXT_PUBLIC_SIMULATE_LOCATION;
    if (simulateLocation === 'sg') {
      const singaporeCoords = { lat: 1.3521, lng: 103.8198 };
      setUserLocation(singaporeCoords);
      setSearchError(null);
      if (!persistedState?.viewState) {
        const map = mapRef.current?.getMap();
        if (map) {
          map.flyTo({ center: [singaporeCoords.lng, singaporeCoords.lat], zoom: 15, duration: 1000 });
        }
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
          setUserLocation(coords);
          // Only fly to user location if no persisted viewState (fresh visitor)
          if (!persistedState?.viewState) {
            const map = mapRef.current?.getMap();
            if (map) {
              map.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 1000 });
            }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

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
        }, 1000);
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
          setTimeout(setupMapListeners, 100);
        }
        return;
      }

      // Set initial bounds when map loads
      const handleMapLoad = () => {
        updateMapBounds();
      };

      // Update bounds when user pans or zooms
      const handleMapMove = () => {
        debouncedUpdateMapBounds();
      };

      // Track zoom level for marker sizing (only fires once per zoom gesture)
      const handleZoomEnd = () => {
        setCurrentZoom(map.getZoom());
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
      map.on('zoomend', handleZoomEnd);

      // Cleanup function
      return () => {
        map.off('load', handleMapLoad);
        map.off('moveend', handleMapMove);
        map.off('zoomend', handleMapMove);
        map.off('zoomend', handleZoomEnd);
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

  // Update dropped pin tooltip position once when hovered
  useEffect(() => {
    if (!isDroppedPinHovered || !droppedPinRef.current) return;

    const rect = droppedPinRef.current.getBoundingClientRect();
    setDroppedPinTooltipPosition({
      top: rect.top - 10,
      left: rect.left + rect.width / 2,
    });
  }, [isDroppedPinHovered]);

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
    if (!userLocation) return displayedCafes;

    return displayedCafes
      .map((cafe: Cafe) => ({
        ...cafe,
        distance: calculateDistance(
          userLocation.lat,
          userLocation.lng,
          cafe.location.lat,
          cafe.location.lng
        ),
      }))
      .sort((a: Cafe, b: Cafe) => (a.distance || 0) - (b.distance || 0));
  }, [displayedCafes, userLocation, calculateDistance]);

  // Memoize marker lists to prevent array recreation on every render
  const nonSelectedCafes = useMemo(
    () => displayedCafes.filter((cafe: Cafe) => cafe.id !== selectedCafeId),
    [displayedCafes, selectedCafeId]
  );
  const selectedCafe = useMemo(
    () => selectedCafeId ? displayedCafes.find((cafe: Cafe) => cafe.id === selectedCafeId) : null,
    [displayedCafes, selectedCafeId]
  );

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
            if (data.count === 0) {
              setShowNoCafesModal(true);
            }
          }
    } catch {
          // Silently fail — user can still search manually
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
    // Clear address pin when doing a name search
    setSearchedAddress(null);

  }, [userLocation, setSearchedAddress]);

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
    // Clear address pin
    setSearchedAddress(null);
    // Force update map bounds to reload viewport cafes
    updateMapBounds();
  }, [setSearchQuery, setActiveSearchQuery, setSearchedAddress, updateMapBounds]);

  // Handle address selection from autocomplete dropdown
  const handleSelectAddress = useCallback((address: AddressSuggestion) => {
    // Set the address pin in global state
    setSearchedAddress(address);
    // Clear active search query so viewport mode takes over
    setActiveSearchQuery(null);
    // Update the search input to show the address
    setSearchQuery(address.label);
    setSearchError(null);

    // Fly map to the address location
    const map = mapRef.current?.getMap();
    if (map) {
      map.flyTo({
        center: [address.lng, address.lat],
        zoom: 15,
        duration: 1000,
      });
    }
  }, [setSearchedAddress, setActiveSearchQuery, setSearchQuery]);

  // Handle "Search for cafes" confirmation from modal
  const handleSearchGeoapify = useCallback(async () => {
    if (!userLocation) return;

    setIsSearchingGeoapify(true);

    try {
      const response = await fetch(
        `/api/cafes/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch cafes from Geoapify');
      }

      const data = await response.json();
      updateMapBounds();

      if (data.count === 0) {
        setSearchError('No cafes found in this area. Try a different location.');
      }
    } catch {
      setSearchError('Failed to search for cafes. Please try again.');
    } finally {
      setIsSearchingGeoapify(false);
    }
  }, [userLocation, updateMapBounds]);

  // Center map on cafe with bottom padding to account for bottom sheet
  const centerMapOnCafe = useCallback((cafe: Cafe) => {
    const map = mapRef.current?.getMap();
    if (map) {
      const bottomPadding = isMobile ? window.innerHeight * 0.5 : 0;
      const currentZoom = map.getZoom();
      map.flyTo({
        center: [cafe.location.lng, cafe.location.lat],
        zoom: Math.max(currentZoom, 15),
        padding: { top: 0, bottom: bottomPadding, left: 0, right: 0 },
        duration: 1000,
      });
    }
  }, [isMobile]);

  // Handle cafe panel item click - open rating panel
  const handleCafeClick = (cafe: Cafe) => {
    setSelectedCafeId(cafe.id);
    setSelectedCafeForRating(cafe);
    setShowRatingPanel(true);

    centerMapOnCafe(cafe);

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
    setSelectedCafeId(cafe.id);
    setSelectedCafeForRating(cafe);
    setShowRatingPanel(true);

    centerMapOnCafe(cafe);

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

  // Handle adding a user-submitted cafe
  const handleAddCafe = async (data: { name: string; googleMapsLink: string }) => {
    if (!droppedPinLocation) {
      throw new Error('No location selected');
    }

    try {
      const response = await fetch('/api/cafes/user-submitted', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          googleMapsLink: data.googleMapsLink,
          location: droppedPinLocation,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add cafe');
      }

      showToast(`Cafe "${data.name}" submitted for review. Thanks for contributing!`, 5000);

      setAddCafeMode(false);
      setDroppedPinLocation(null);
      updateMapBounds();
    } catch (error) {
      console.error('Error adding cafe:', error);
      throw error;
    }
  };

  return (
    <div className="w-full h-full relative">
      {/* Map base layer */}
      <div className="absolute inset-0">
        <Map
          ref={mapRef}
          initialViewState={viewStateRef.current}
          onMoveEnd={evt => {
            // Update ref for persistence (no re-render)
            viewStateRef.current = {
              longitude: evt.viewState.longitude,
              latitude: evt.viewState.latitude,
              zoom: evt.viewState.zoom,
            };
            debouncedSaveState();
          }}
          onClick={(evt) => {
            // Handle map click for dropping pin in add cafe mode
            if (isAddCafeMode) {
              const { lng, lat } = evt.lngLat;
              setDroppedPinLocation({ lng, lat });
            }
          }}
          cursor={isAddCafeMode ? 'crosshair' : 'default'}
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
                <div className="absolute -inset-3 bg-c2c-orange rounded-full opacity-20 animate-pulse" />
                {/* Center dot */}
                <div className="w-5 h-5 bg-c2c-orange rounded-full border-3 border-white shadow-lg relative z-10" />
              </div>
            </Marker>
          )}

          {/* Cafe markers - render non-selected first, then selected last so it's always on top */}
          {nonSelectedCafes.map((cafe) => (
            <CafeMarker
              key={cafe.id}
              cafe={cafe}
              isSelected={false}
              zoom={currentZoom}
              onClick={handlePinClick}
            />
          ))}

          {/* Selected marker rendered last - ensures it's always on top */}
          {selectedCafe && (
            <CafeMarker
              key={`selected-${selectedCafeId}`}
              cafe={selectedCafe}
              isSelected={true}
              zoom={currentZoom}
              onClick={handlePinClick}
            />
          )}

          {/* Address search pin */}
          {searchedAddress && (
            <Marker
              longitude={searchedAddress.lng}
              latitude={searchedAddress.lat}
              anchor="bottom"
              style={{ zIndex: 25 }}
            >
              <div className="flex flex-col items-center">
                <MapPin
                  size={40}
                  className="drop-shadow-lg"
                  fill="#f4512c"
                  stroke="#e64524"
                  strokeWidth={1.5}
                />
                <div className="mt-1 px-2 py-0.5 bg-white border border-gray-300 rounded shadow-sm max-w-[200px]">
                  <p className="text-xs text-gray-700 truncate font-medium">
                    {searchedAddress.label}
                  </p>
                </div>
              </div>
            </Marker>
          )}

          {/* Dropped pin for adding new cafe */}
          {isAddCafeMode && droppedPinLocation && (
            <Marker
              longitude={droppedPinLocation.lng}
              latitude={droppedPinLocation.lat}
              anchor="bottom"
              style={{ zIndex: 30 }}
            >
              <div
                ref={droppedPinRef}
                className="relative group"
                onMouseEnter={() => setIsDroppedPinHovered(true)}
                onMouseLeave={() => setIsDroppedPinHovered(false)}
              >
                {/* Pin shape with coffee icon inside - matching CafeMarker style */}
                <div className="transform transition-transform hover:scale-110 relative cursor-pointer">
                  {/* Calculate pin size based on zoom level */}
                  {(() => {
                    const baseSize = 50;
                    const zoomScale = Math.max(0.8, Math.min(1.5, currentZoom / 13));
                    const pinSize = baseSize * zoomScale;
                    const iconSize = Math.round(24 * zoomScale);
                    const iconTop = Math.round(8 * zoomScale);

                    return (
                      <>
                        {/* Map pin icon - styled to match cafe pin but with distinct color */}
                        <MapPin
                          size={pinSize}
                          className="drop-shadow-lg text-c2c-orange"
                          fill="#f4512c"
                          stroke="#f4512c"
                        />
                        {/* Coffee icon inside the pin */}
                        <div
                          className="absolute left-1/2 transform -translate-x-1/2 flex items-center justify-center"
                          style={{
                            top: `${iconTop}px`,
                            width: `${iconSize}px`,
                            height: `${iconSize}px`,
                            backgroundColor: '#f4512c',
                            borderRadius: 0
                          }}
                        >
                          <Image
                            src="/assets/cafe-icon.webp"
                            alt="Cafe"
                            width={iconSize}
                            height={iconSize}
                            className="object-contain pixel-image"
                            unoptimized
                            priority
                            fetchPriority="high"
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </Marker>
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

      {/* Left Panel overlay - hidden in add cafe mode */}
      {!isAddCafeMode && (
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
          isRatingPanelOpen={showRatingPanel}
          onSelectAddress={handleSelectAddress}
        />
      )}

      {/* Add Cafe Mode Indicator */}
      {isAddCafeMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40
                        bg-c2c-orange border-2 border-c2c-orange-dark
                        px-6 py-3 shadow-lg text-sm font-sans rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="text-white font-bold">
              {droppedPinLocation ? 'Pin dropped! Adjust if needed.' : 'Click on the map to drop a pin'}
            </span>
            <button
              onClick={() => {
                setAddCafeMode(false);
                setDroppedPinLocation(null);
              }}
              className="ml-2 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-white font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add a cafe here button - appears when pin is dropped */}
      {isAddCafeMode && droppedPinLocation && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={() => setShowAddCafeModal(true)}
            className="bg-c2c-orange hover:bg-c2c-orange-dark text-white font-bold
                       px-6 py-3 rounded-lg shadow-lg border-2 border-c2c-orange-dark
                       transition-all transform hover:scale-105 font-sans text-sm"
          >
            Add a cafe here
          </button>
        </div>
      )}

      {/* Location status indicator - shows dropped pin coordinates when in add mode, otherwise user location */}
      {(isAddCafeMode && droppedPinLocation) || userLocation ? (
        <div className="absolute bottom-4 left-4 bg-c2c-orange border-2 border-c2c-orange-dark px-4 py-2 shadow-lg text-xs font-sans z-20 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white animate-pulse rounded-full" />
            <span className="text-white font-medium">
              {isAddCafeMode && droppedPinLocation ? (
                <>PIN: {droppedPinLocation.lat.toFixed(6)}, {droppedPinLocation.lng.toFixed(6)}</>
              ) : userLocation ? (
                <>LOC: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}</>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}

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

      {/* Dropped Pin Tooltip - rendered via Portal */}
      {isDroppedPinHovered && droppedPinLocation && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed pointer-events-none z-[10000] transition-opacity"
          style={{
            top: `${droppedPinTooltipPosition.top}px`,
            left: `${droppedPinTooltipPosition.left}px`,
            transform: 'translate(-50%, -100%)',
            marginBottom: '8px',
          }}
        >
          <div className="bg-c2c-orange border-2 border-c2c-orange-dark px-3 py-2 shadow-lg whitespace-nowrap rounded-lg">
            <p className="text-xs font-bold text-white font-sans">Dropped Pin</p>
            <p className="text-xs text-white/90 font-sans mt-1">
              {droppedPinLocation.lat.toFixed(6)}, {droppedPinLocation.lng.toFixed(6)}
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* Add Cafe Modal */}
      {droppedPinLocation && (
        <AddCafeModal
          isOpen={showAddCafeModal}
          onClose={() => setShowAddCafeModal(false)}
          onSubmit={handleAddCafe}
          location={droppedPinLocation}
        />
      )}
    </div>
  );
}
