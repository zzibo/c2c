'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase-client';
import type { Profile } from '../supabase';
import { getProfile, signOut as authSignOut } from '../auth';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  isOnboarded: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  
  // Store AbortController for in-flight profile fetches
  const profileFetchControllerRef = useRef<AbortController | null>(null);
  // Store the user ID for the current fetch to detect stale results
  const currentFetchUserIdRef = useRef<string | null>(null);

  const handleSessionChange = useCallback((session: Session | null) => {
    // Abort any in-flight profile fetch
    if (profileFetchControllerRef.current) {
      profileFetchControllerRef.current.abort();
      profileFetchControllerRef.current = null;
    }
    
    setSession(session);
    const newUser = session?.user ?? null;
    setUser(newUser);
    setIsLoading(false);

    // Fetch profile if user exists
    if (newUser) {
      setIsProfileLoading(true);
      
      // Create new AbortController for this fetch
      const controller = new AbortController();
      profileFetchControllerRef.current = controller;
      currentFetchUserIdRef.current = newUser.id;
      
      getProfile(newUser.id, controller.signal)
        .then((userProfile) => {
          // Check if fetch was aborted or user ID changed
          if (controller.signal.aborted || currentFetchUserIdRef.current !== newUser.id) {
            return;
          }
          setProfile(userProfile);
        })
        .catch((error) => {
          // Ignore abort errors
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
          // Only set error state if fetch wasn't aborted and user ID still matches
          if (!controller.signal.aborted && currentFetchUserIdRef.current === newUser.id) {
            console.error('Error fetching profile:', error);
            setProfile(null);
          }
        })
        .finally(() => {
          // Only update loading state if this is still the current fetch
          if (profileFetchControllerRef.current === controller) {
            setIsProfileLoading(false);
            profileFetchControllerRef.current = null;
            currentFetchUserIdRef.current = null;
          }
        });
    } else {
      setProfile(null);
      setIsProfileLoading(false);
      currentFetchUserIdRef.current = null;
    }
  }, []);

  const refreshProfile = useCallback(async (userId: string | null) => {
    // Abort any in-flight profile fetch
    if (profileFetchControllerRef.current) {
      profileFetchControllerRef.current.abort();
      profileFetchControllerRef.current = null;
    }
    
    if (!userId) {
      setProfile(null);
      setIsProfileLoading(false);
      currentFetchUserIdRef.current = null;
      return;
    }

    setIsProfileLoading(true);
    
    // Create new AbortController for this fetch
    const controller = new AbortController();
    profileFetchControllerRef.current = controller;
    currentFetchUserIdRef.current = userId;
    
    try {
      const userProfile = await getProfile(userId, controller.signal);
      
      // Check if fetch was aborted or user ID changed
      if (controller.signal.aborted || currentFetchUserIdRef.current !== userId) {
        return;
      }
      
      setProfile(userProfile);
    } catch (error) {
      // Ignore abort errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      
      // Only set error state if fetch wasn't aborted and user ID still matches
      if (!controller.signal.aborted && currentFetchUserIdRef.current === userId) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      }
    } finally {
      // Only update loading state if this is still the current fetch
      if (profileFetchControllerRef.current === controller) {
        setIsProfileLoading(false);
        profileFetchControllerRef.current = null;
        currentFetchUserIdRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSessionChange(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionChange(session);
    });

    return () => subscription.unsubscribe();
  }, [handleSessionChange]);

  const handleSignOut = async () => {
    // Abort any in-flight profile fetch
    if (profileFetchControllerRef.current) {
      profileFetchControllerRef.current.abort();
      profileFetchControllerRef.current = null;
    }
    
    await authSignOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    currentFetchUserIdRef.current = null;
  };

  const value: AuthContextType = {
    user,
    profile,
    session,
    isLoading,
    isProfileLoading,
    isOnboarded: profile?.is_onboarded ?? false,
    signOut: handleSignOut,
    refreshProfile: () => refreshProfile(user?.id ?? null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
