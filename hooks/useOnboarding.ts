import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth/AuthContext';

/**
 * Hook to handle onboarding redirection
 * Redirects users to onboarding if they're authenticated but not onboarded
 */
export function useOnboarding() {
  const { user, isOnboarded, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    // Don't redirect if already on onboarding page
    if (pathname === '/onboarding') return;

    // Don't redirect if on auth callback
    if (pathname === '/auth/callback') return;

    // If user is authenticated but not onboarded, redirect to onboarding
    if (user && !isOnboarded) {
      router.push('/onboarding');
    }
  }, [user, isOnboarded, isLoading, pathname, router]);

  return {
    needsOnboarding: user !== null && !isOnboarded,
    isLoading,
  };
}
