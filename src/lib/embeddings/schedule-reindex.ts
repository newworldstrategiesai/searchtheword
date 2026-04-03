import type { SupabaseClient } from "@supabase/supabase-js";
import { indexSermonChunks } from "@/lib/embeddings/index-sermon";

/** Fire-and-forget embedding reindex (admin RLS). Logs warnings on failure. */
export function scheduleSermonEmbeddingReindex(
  supabase: SupabaseClient,
  row: { id: string; title: string; full_text: string | null; summary: string | null },
): void {
  void indexSermonChunks(supabase, row).then((r) => {
    if (!r.ok && r.error) {
      console.warn(`[embeddings] sermon ${row.id}: ${r.error}`);
    }
  });
}
