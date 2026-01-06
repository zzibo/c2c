'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

/**
 * React Query Provider for C2C
 *
 * Provides:
 * - Automatic caching (60s stale time, 5min garbage collection)
 * - Request deduplication
 * - Background refetching
 * - Optimistic updates
 * - Retry logic (3 attempts with exponential backoff)
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create client inside component to avoid sharing state between requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Consider data fresh for 1 minute
            staleTime: 60 * 1000,

            // Keep unused data in cache for 5 minutes
            gcTime: 5 * 60 * 1000,

            // Refetch when user returns to window
            refetchOnWindowFocus: true,

            // Refetch when network reconnects
            refetchOnReconnect: true,

            // Retry failed requests 3 times
            retry: 3,

            // Exponential backoff: 1s, 2s, 4s
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            // Retry mutations once
            retry: 1,

            // Faster retry for mutations
            retryDelay: 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools - only shows in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}
