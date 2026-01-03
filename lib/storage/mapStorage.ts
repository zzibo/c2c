import type { Coordinate, Cafe } from '@/types/cafe';

interface MapViewState {
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  userLocation: Coordinate | null;
  cafes: Cafe[];
  searchQuery: string;
  isPanelCollapsed: boolean;
  timestamp: number;
}

const STORAGE_KEY = 'c2c-map-state';
const MAX_AGE_MS = 3600000; // 1 hour

/**
 * Load persisted map state from localStorage
 * Returns null if no state exists or if state is older than MAX_AGE_MS
 */
export function loadMapState(): Partial<MapViewState> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const parsed: MapViewState = JSON.parse(saved);
    
    // Check if saved state is still valid (not expired)
    if (parsed.timestamp && Date.now() - parsed.timestamp < MAX_AGE_MS) {
      return parsed;
    }
    
    // State expired, remove it
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch (error) {
    console.error('Error loading map state from localStorage:', error);
    // Clear corrupted data
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore errors when clearing
    }
    return null;
  }
}

/**
 * Save map state to localStorage
 */
export function saveMapState(state: Omit<MapViewState, 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  
  const stateToSave: MapViewState = {
    ...state,
    timestamp: Date.now()
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  } catch (error) {
    console.error('Error saving map state to localStorage:', error);
    // Handle quota exceeded errors gracefully
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('LocalStorage quota exceeded, clearing old data');
      try {
        localStorage.removeItem(STORAGE_KEY);
        // Try saving again
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch {
        // Give up if it still fails
      }
    }
  }
}

/**
 * Clear persisted map state from localStorage
 */
export function clearMapState(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing map state from localStorage:', error);
  }
}

