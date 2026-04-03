import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkSermonForEmbedding } from "@/lib/embeddings/chunk-text";
import { DEFAULT_EMBEDDING_MODEL } from "@/lib/embeddings/constants";
import { embedTexts, embeddingsConfigured } from "@/lib/embeddings/openai-embed";

const MAX_CHUNKS_PER_SERMON = 80;

function formatVectorLiteral(v: number[]): string {
  return `[${v.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;
}

export async function deleteSermonChunks(supabase: SupabaseClient, sermonId: string): Promise<void> {
  await supabase.from("sermon_chunks").delete().eq("sermon_id", sermonId);
}

export type IndexSermonChunksResult = { ok: boolean; chunks: number; error?: string };

/**
 * Rebuilds embedding chunks for one sermon. Requires admin Supabase client (RLS).
 */
export async function indexSermonChunks(
  supabase: SupabaseClient,
  opts: {
    id: string;
    title: string;
    full_text: string | null;
    summary: string | null;
  },
): Promise<IndexSermonChunksResult> {
  if (!embeddingsConfigured()) {
    return { ok: false, chunks: 0, error: "OPENAI_API_KEY not configured" };
  }

  if (!opts.full_text?.trim()) {
    await deleteSermonChunks(supabase, opts.id);
    return { ok: true, chunks: 0 };
  }

  try {
    let pieces = chunkSermonForEmbedding({
      title: opts.title,
      fullText: opts.full_text,
      summary: opts.summary,
    });
    if (pieces.length > MAX_CHUNKS_PER_SERMON) {
      pieces = pieces.slice(0, MAX_CHUNKS_PER_SERMON);
    }
    if (pieces.length === 0) {
      await deleteSermonChunks(supabase, opts.id);
      return { ok: true, chunks: 0 };
    }

    const vectors = await embedTexts(pieces);
    await deleteSermonChunks(supabase, opts.id);

    const model = process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
    const rows = pieces.map((content, i) => ({
      sermon_id: opts.id,
      chunk_index: i,
      content,
      embedding: formatVectorLiteral(vectors[i]!),
      embedding_model: model,
    }));

    const { error } = await supabase.from("sermon_chunks").insert(rows);
    if (error) return { ok: false, chunks: 0, error: error.message };
    return { ok: true, chunks: pieces.length };
  } catch (e) {
    return { ok: false, chunks: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
