import { supabase } from './supabase';
import type { Profile, ProfileMetadata, VibeType } from './supabase';

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

/**
 * Get the current session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Check if user has completed onboarding
 * Returns null if no profile exists, otherwise returns the profile
 */
export async function checkOnboardingStatus(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // Profile doesn't exist yet
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data as Profile;
}

/**
 * Create a new user profile after signup
 */
export async function createProfile(
  userId: string,
  username: string,
  vibe: VibeType
): Promise<Profile> {
  const metadata: ProfileMetadata = {
    vibe,
    onboarded_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username,
      is_onboarded: true,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  updates: {
    username?: string;
    vibe?: VibeType;
    metadata?: Partial<ProfileMetadata>;
  }
): Promise<Profile> {
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', userId)
    .single();

  const updateData: any = {};

  if (updates.username) {
    updateData.username = updates.username;
  }

  if (updates.vibe || updates.metadata) {
    updateData.metadata = {
      ...currentProfile?.metadata,
      ...updates.metadata,
      ...(updates.vibe && { vibe: updates.vibe }),
    };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

/**
 * Check if a username is available
 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('is_username_available', { check_username: username });

  if (error) throw error;
  return data as boolean;
}

/**
 * Validate username format
 * Returns error message if invalid, null if valid
 */
export function validateUsername(username: string): string | null {
  if (!username) {
    return 'Username is required';
  }

  if (username.length < 3) {
    return 'Username must be at least 3 characters';
  }

  if (username.length > 30) {
    return 'Username must be 30 characters or less';
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username can only contain letters, numbers, and underscores';
  }

  return null;
}

/**
 * Sign in with email OTP
 */
export async function signInWithEmail(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Verify OTP code
 */
export async function verifyOTP(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get user profile by ID
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data as Profile;
}

/**
 * Get user profile with stats
 */
export async function getProfileWithStats(userId: string) {
  const { data, error } = await supabase
    .rpc('get_user_profile_with_stats', { user_uuid: userId });

  if (error) throw error;
  return data?.[0] || null;
}
