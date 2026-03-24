/**
 * True when public Supabase env vars are set (trimmed, non-empty).
 * Use to avoid creating clients that throw at construction time.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}
