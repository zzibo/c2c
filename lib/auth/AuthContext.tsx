'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  const handleSessionChange = useCallback((session: Session | null) => {
    setSession(session);
    const newUser = session?.user ?? null;
    setUser(newUser);
    setIsLoading(false);

    // Fetch profile if user exists
    if (newUser) {
      setIsProfileLoading(true);
      getProfile(newUser.id)
        .then((userProfile) => {
          setProfile(userProfile);
        })
        .catch((error) => {
          console.error('Error fetching profile:', error);
          setProfile(null);
        })
        .finally(() => {
          setIsProfileLoading(false);
        });
    } else {
      setProfile(null);
      setIsProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async (userId: string | null) => {
    if (!userId) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    try {
      const userProfile = await getProfile(userId);
      setProfile(userProfile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setIsProfileLoading(false);
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
    await authSignOut();
    setUser(null);
    setProfile(null);
    setSession(null);
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
