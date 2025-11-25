import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client (admin access, NEVER use in frontend)
// This file should only be imported in API routes and server components
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
