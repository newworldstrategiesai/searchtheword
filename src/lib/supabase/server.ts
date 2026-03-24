import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

/**
 * Supabase client for Server Components / Route Handlers that need the user session (cookies).
 */
export async function createServerSupabaseClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; ignore if read-only
          }
        },
      },
    },
  );
}

/**
 * Anonymous server client for public reads (no cookies). Use in API routes that do not need auth.
 */
export function createPublicSupabaseClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createSupabaseClient(
    url,
    anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
