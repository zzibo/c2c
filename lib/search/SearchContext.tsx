'use client';

import { createContext, useContext, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: (query: string) => void;
  isSearching: boolean;
  setIsSearching: (isSearching: boolean) => void;
  registerSearchHandler: (handler: (query: string) => void) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchHandlerRef = useRef<((query: string) => void) | null>(null);

  const onSearch = useCallback((query: string) => {
    if (searchHandlerRef.current) {
      searchHandlerRef.current(query);
    }
  }, []);

  const registerSearchHandler = useCallback((handler: (query: string) => void) => {
    searchHandlerRef.current = handler;
  }, []);

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        onSearch,
        isSearching,
        setIsSearching,
        registerSearchHandler,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
}

