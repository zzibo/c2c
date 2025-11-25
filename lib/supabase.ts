import { createClient } from '@supabase/supabase-js';

// Client-side Supabase client (safe to use in browser)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Type definitions for our database
export type Cafe = {
  id: string;
  geoapify_place_id: string;
  osm_id: string | null;
  name: string;
  address: string | null;
  location: string; // PostGIS geography
  phone: string | null;
  website: string | null;
  verified_name: string | null;
  verified_hours: any | null;
  user_photos: string[];
  first_discovered_at: string;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};

export type Rating = {
  id: string;
  cafe_id: string;
  user_id: string;
  coffee_rating: number | null;
  vibe_rating: number | null;
  wifi_rating: number | null;
  outlets_rating: number | null;
  seating_rating: number | null;
  noise_rating: number | null;
  overall_rating: number;
  comment: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
};

export type CafeWithStats = {
  id: string;
  geoapify_place_id: string;
  name: string;
  display_name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  distance_meters?: number;
  phone: string | null;
  website: string | null;
  user_photos: string[];
  verified_hours: any | null;
  rating_count: number;
  avg_coffee: number;
  avg_vibe: number;
  avg_wifi: number;
  avg_outlets: number;
  avg_seating: number;
  avg_noise: number;
  avg_overall: number;
  last_rated_at: string | null;
  created_at: string;
};

// Vibe preference type
export type VibeType = 'lock-in' | 'network' | 'chill';

// Profile metadata structure
export type ProfileMetadata = {
  vibe: VibeType;
  onboarded_at?: string;
  preferences?: {
    notifications?: boolean;
    theme?: 'light' | 'dark';
    map_style?: string;
  };
  stats?: {
    favorite_cafe_id?: string;
    total_check_ins?: number;
  };
};

// Profile table type
export type Profile = {
  id: string;
  username: string;
  is_onboarded: boolean;
  metadata: ProfileMetadata;
  created_at: string;
  updated_at: string;
};

// Profile with rating stats (from get_user_profile_with_stats function)
export type ProfileWithStats = {
  id: string;
  username: string;
  vibe: VibeType | null;
  is_onboarded: boolean;
  total_ratings: number;
  avg_rating: number;
  created_at: string;
};

// Rating with user info (for displaying ratings with usernames)
export type RatingWithUser = Rating & {
  username: string;
  user_vibe: VibeType | null;
};
