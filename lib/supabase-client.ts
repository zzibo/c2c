import { createBrowserClient } from '@supabase/ssr';

/**
 * Get Supabase client for client-side operations (React components, browser)
 * This properly handles cookie storage in the browser
 */
export function getSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Export a singleton instance for convenience
export const supabase = getSupabaseClient();
