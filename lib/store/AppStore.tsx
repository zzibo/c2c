'use client';

import { createContext, useContext, useReducer, ReactNode, useCallback, useRef } from 'react';

// State interface
interface AppState {
  // Sidebar state
  isPanelCollapsed: boolean;

  // Search state
  searchQuery: string; // Current text in search input
  activeSearchQuery: string | null; // Active search triggering API call (null = viewport mode)
}

// Action types
type AppAction =
  | { type: 'SET_PANEL_COLLAPSED'; payload: boolean }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_ACTIVE_SEARCH_QUERY'; payload: string | null }
  | { type: 'CLEAR_SEARCH' };

// Initial state
const initialState: AppState = {
  isPanelCollapsed: false,
  searchQuery: '',
  activeSearchQuery: null,
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

    case 'CLEAR_SEARCH':
      return { ...state, searchQuery: '', activeSearchQuery: null };

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
  clearSearch: () => void;
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
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return {
            ...initial,
            isPanelCollapsed: parsed.isPanelCollapsed ?? initial.isPanelCollapsed,
          };
        } catch {
          return initial;
        }
      }
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

  const clearSearch = useCallback(() => {
    dispatch({ type: 'CLEAR_SEARCH' });
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
    clearSearch,
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
