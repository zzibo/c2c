import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Get Supabase client for server-side operations (API routes, Server Components)
 * This properly reads cookies from the request
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Get the current session in server-side context (API routes)
 */
export async function getServerSession() {
  const supabase = await getServerSupabase();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting server session:', error);
    return null;
  }

  return session;
}

/**
 * Get the current user in server-side context (API routes)
 */
export async function getServerUser() {
  const session = await getServerSession();
  return session?.user ?? null;
}
