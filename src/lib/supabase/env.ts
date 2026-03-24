/**
 * True when public Supabase env vars are set (trimmed, non-empty).
 * Use to avoid creating clients that throw at construction time.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

/** Use for server/client; throws with deploy-focused hint if missing. */
export function getPublicSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error(
      "Supabase env missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. " +
        "Local: add them to .env.local and restart dev. " +
        "Vercel: Project → Settings → Environment Variables (check Production and Preview), then Redeploy — " +
        "NEXT_PUBLIC_* values are baked in at build time, so a new build is required after adding or changing them.",
    );
  }
  return { url, anonKey };
}
