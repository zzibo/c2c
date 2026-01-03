import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook that persists state to localStorage automatically
 * without requiring useEffect
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage)
): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize state from localStorage or use initial value
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    
    try {
      const item = storage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        // Check if there's a timestamp and if it's expired (1 hour)
        if (parsed.timestamp && Date.now() - parsed.timestamp > 3600000) {
          storage.removeItem(key);
          return initialValue;
        }
        return parsed.value ?? initialValue;
      }
    } catch (error) {
      console.error(`Error loading ${key} from storage:`, error);
    }
    return initialValue;
  });

  // Use ref to track if this is the initial render
  const isInitialMount = useRef(true);

  // Custom setter that persists to localStorage
  const setPersistedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prevState) => {
        const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prevState) : value;
        
        // Persist to localStorage
        if (typeof window !== 'undefined') {
          try {
            const itemToStore = {
              value: newValue,
              timestamp: Date.now()
            };
            storage.setItem(key, JSON.stringify(itemToStore));
          } catch (error) {
            console.error(`Error saving ${key} to storage:`, error);
            // Handle quota exceeded
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
              try {
                storage.removeItem(key);
                storage.setItem(key, JSON.stringify({ value: newValue, timestamp: Date.now() }));
              } catch {
                // Give up if it still fails
              }
            }
          }
        }
        
        return newValue;
      });
    },
    [key, storage]
  );

  // Skip persistence on initial mount (already loaded from storage)
  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  return [state, setPersistedState];
}

