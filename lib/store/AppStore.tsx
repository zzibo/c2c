'use client';

import { createContext, useContext, useReducer, ReactNode, useCallback, useRef } from 'react';

// Search filters interface
export interface SearchFilters {
  maxDistance: number;
  minOverallRating: number;
  minWifiRating: number;
  minOutletsRating: number;
  minCoffeeRating: number;
  minVibeRating: number;
  minSeatingRating: number;
  minNoiseRating: number;
  minReviews: number;
  sortBy: 'relevance' | 'distance' | 'rating' | 'reviews';
  hasWifi: boolean | null;
  hasOutlets: boolean | null;
  goodForWork: boolean | null;
  quietWorkspace: boolean | null;
  spacious: boolean | null;
  maxPriceLevel: number;
}

// State interface
interface AppState {
  // Sidebar state
  isPanelCollapsed: boolean;

  // Search state
  searchQuery: string; // Current text in search input
  activeSearchQuery: string | null; // Active search triggering API call (null = viewport mode)
  searchFilters: SearchFilters; // Search filter preferences

  isAddCafeMode: boolean;
}

// Action types
type AppAction =
  | { type: 'SET_PANEL_COLLAPSED'; payload: boolean }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_ACTIVE_SEARCH_QUERY'; payload: string | null }
  | { type: 'SET_SEARCH_FILTERS'; payload: SearchFilters }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'SET_ADD_CAFE_MODE'; payload: boolean };

// Default filters
const defaultFilters: SearchFilters = {
  maxDistance: 10,
  minOverallRating: 0,
  minWifiRating: 0,
  minOutletsRating: 0,
  minCoffeeRating: 0,
  minVibeRating: 0,
  minSeatingRating: 0,
  minNoiseRating: 0,
  minReviews: 0,
  sortBy: 'relevance',
  hasWifi: null,
  hasOutlets: null,
  goodForWork: null,
  quietWorkspace: null,
  spacious: null,
  maxPriceLevel: -1,
};

// Initial state
const initialState: AppState = {
  isPanelCollapsed: false,
  searchQuery: '',
  activeSearchQuery: null,
  searchFilters: defaultFilters,
  isAddCafeMode: false,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PANEL_COLLAPSED':
      return { ...state, isPanelCollapsed: action.payload };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'SET_ACTIVE_SEARCH_QUERY':
      return { ...state, activeSearchQuery: action.payload };

    case 'SET_SEARCH_FILTERS':
      return { ...state, searchFilters: action.payload };

    case 'CLEAR_SEARCH':
      return { ...state, searchQuery: '', activeSearchQuery: null };

    case 'SET_ADD_CAFE_MODE':
      return { ...state, isAddCafeMode: action.payload };

    default:
      return state;
  }
}

// Context interface
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Convenience methods (like Redux actions)
  setPanelCollapsed: (collapsed: boolean) => void;
  setSearchQuery: (query: string) => void;
  setActiveSearchQuery: (query: string | null) => void;
  setSearchFilters: (filters: SearchFilters) => void;
  clearSearch: () => void;
  setAddCafeMode: (isAddMode: boolean) => void;
  // Search handler registration (for component communication)
  registerSearchHandler: (handler: (query: string) => void) => void;
  onSearch: (query: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage
  const [state, dispatch] = useReducer(appReducer, initialState, (initial) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mapState');
      const storedFilters = localStorage.getItem('searchFilters');
      let parsedState = initial;
      let parsedFilters = defaultFilters;

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsedState = {
            ...initial,
            isPanelCollapsed: parsed.isPanelCollapsed ?? initial.isPanelCollapsed,
          };
        } catch {
          // Keep initial
        }
      }

      if (storedFilters) {
        try {
          parsedFilters = JSON.parse(storedFilters);
        } catch {
          // Keep default
        }
      }

      return {
        ...parsedState,
        searchFilters: parsedFilters,
      };
    }
    return initial;
  });

  // Store search handler (for MapView to register its search function)
  const searchHandlerRef = useRef<((query: string) => void) | null>(null);

  // Convenience action creators
  const setPanelCollapsed = useCallback((collapsed: boolean) => {
    dispatch({ type: 'SET_PANEL_COLLAPSED', payload: collapsed });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  }, []);

  const setActiveSearchQuery = useCallback((query: string | null) => {
    dispatch({ type: 'SET_ACTIVE_SEARCH_QUERY', payload: query });
  }, []);

  const setSearchFilters = useCallback((filters: SearchFilters) => {
    dispatch({ type: 'SET_SEARCH_FILTERS', payload: filters });
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('searchFilters', JSON.stringify(filters));
    }
  }, []);

  const clearSearch = useCallback(() => {
    dispatch({ type: 'CLEAR_SEARCH' });
  }, []);

  const setAddCafeMode = useCallback((isAddMode: boolean) => {
    dispatch({ type: 'SET_ADD_CAFE_MODE', payload: isAddMode });
  }, []);

  // Search handler registration
  const registerSearchHandler = useCallback((handler: (query: string) => void) => {
    searchHandlerRef.current = handler;
  }, []);

  // Trigger search (calls registered handler)
  const onSearch = useCallback((query: string) => {
    if (searchHandlerRef.current) {
      searchHandlerRef.current(query);
    }
  }, []);

  const value: AppContextType = {
    state,
    dispatch,
    setPanelCollapsed,
    setSearchQuery,
    setActiveSearchQuery,
    setSearchFilters,
    clearSearch,
    setAddCafeMode,
    registerSearchHandler,
    onSearch,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Custom hook
export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within AppStoreProvider');
  }
  return context;
}
