'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/lib/toast/ToastContext';

/**
 * Component that watches for profile changes and shows welcome back toast
 * when a returning user signs in
 */
export function WelcomeBackHandler() {
  const { user, profile, isProfileLoading } = useAuth();
  const { showToast } = useToast();
  const previousUserRef = useRef<string | null>(null);
  const hasShownWelcomeRef = useRef<string | null>(null);

  useEffect(() => {
    // Don't show toast while loading
    if (isProfileLoading) return;

    // If user just signed in (was null before, now has user) and profile exists with username
    if (user && profile?.username) {
      const userId = user.id;
      
      // Check if this is a new sign-in (user changed from null/other to this user)
      if (previousUserRef.current !== userId && hasShownWelcomeRef.current !== userId) {
        // User has a profile with username, so they're a returning user
        showToast('Welcome back!', 3000);
        hasShownWelcomeRef.current = userId;
      }
    }

    // Update previous user ref
    if (user) {
      previousUserRef.current = user.id;
    } else {
      previousUserRef.current = null;
      // Reset welcome flag when user signs out
      hasShownWelcomeRef.current = null;
    }
  }, [user, profile, isProfileLoading, showToast]);

  return null;
}

