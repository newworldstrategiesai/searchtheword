import {
  CHUNK_MAX_CHARS,
  CHUNK_OVERLAP_CHARS,
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_BATCH_SIZE,
} from "@/lib/embeddings/constants";

/** Must mirror MAX_CHUNKS_PER_SERMON in index-sermon.ts (cap so estimates match reality). */
export const MAX_CHUNKS_PER_SERMON = 80;

/** OpenAI embeddings are roughly ~4 characters per token for English prose. */
const CHARS_PER_TOKEN = 4;

/** USD per 1,000,000 input tokens for OpenAI embedding models (as of 2026). */
const EMBEDDING_PRICE_PER_1M_TOKENS: Record<string, number> = {
  "text-embedding-3-small": 0.02,
  "text-embedding-3-large": 0.13,
  "text-embedding-ada-002": 0.1,
};

export function embeddingModelName(): string {
  return process.env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

export function embeddingPricePer1MTokens(model: string): number {
  return (
    EMBEDDING_PRICE_PER_1M_TOKENS[model] ??
    EMBEDDING_PRICE_PER_1M_TOKENS[DEFAULT_EMBEDDING_MODEL]!
  );
}

/**
 * Estimate the number of embedding chunks a sermon will produce from its
 * full_text length. Mirrors the overlapping-window chunker (stride = max - overlap)
 * and the per-sermon cap, so previews track actual indexing closely.
 */
export function estimateChunkCount(fullTextLen: number): number {
  if (fullTextLen <= 0) return 0;
  const stride = Math.max(1, CHUNK_MAX_CHARS - CHUNK_OVERLAP_CHARS);
  return Math.min(MAX_CHUNKS_PER_SERMON, Math.max(1, Math.ceil(fullTextLen / stride)));
}

export type SermonIndexStatusRow = {
  id: string;
  title: string;
  updated_at: string | null;
  full_text_len: number;
  chunk_count: number;
  last_indexed_at: string | null;
};

export type IndexCategory = "new" | "changed" | "upToDate" | "empty";

/**
 * Classify a sermon for indexing:
 * - empty: no full_text → nothing to embed
 * - new: has text but no chunks yet
 * - changed: has chunks, but the sermon was edited after the last chunk was written
 * - upToDate: has chunks and has not changed since
 */
export function categorizeSermon(row: SermonIndexStatusRow): IndexCategory {
  if (row.full_text_len <= 0) return "empty";
  if (row.chunk_count <= 0) return "new";
  if (
    row.updated_at &&
    row.last_indexed_at &&
    new Date(row.updated_at).getTime() > new Date(row.last_indexed_at).getTime()
  ) {
    return "changed";
  }
  return "upToDate";
}

export type IndexPlan = {
  model: string;
  pricePer1MTokens: number;
  counts: {
    total: number;
    new: number;
    changed: number;
    upToDate: number;
    empty: number;
  };
  /** Estimated work for the new + changed set (the "safe" targeted reindex). */
  estimate: {
    sermons: number;
    chunks: number;
    requests: number;
    tokens: number;
    costUsd: number;
  };
  /** Stable, ordered ids of sermons that are new or changed. */
  changedOrNewIds: string[];
};

/**
 * Build an indexing plan from per-sermon status rows. Pure / no network — used
 * to preview cost before spending anything on OpenAI.
 */
export function buildIndexPlan(rows: SermonIndexStatusRow[]): IndexPlan {
  const model = embeddingModelName();
  const pricePer1MTokens = embeddingPricePer1MTokens(model);

  const counts = { total: rows.length, new: 0, changed: 0, upToDate: 0, empty: 0 };
  const changedOrNewIds: string[] = [];
  let chunks = 0;
  let requests = 0;
  let tokens = 0;

  for (const row of rows) {
    const category = categorizeSermon(row);
    counts[category] += 1;
    if (category === "new" || category === "changed") {
      changedOrNewIds.push(row.id);
      const c = estimateChunkCount(row.full_text_len);
      chunks += c;
      requests += Math.ceil(c / EMBEDDING_BATCH_SIZE);
      // Upper-bound the embedded characters by chunk count × window size.
      tokens += Math.ceil((c * CHUNK_MAX_CHARS) / CHARS_PER_TOKEN);
    }
  }

  const costUsd = (tokens / 1_000_000) * pricePer1MTokens;

  return {
    model,
    pricePer1MTokens,
    counts,
    estimate: { sermons: changedOrNewIds.length, chunks, requests, tokens, costUsd },
    changedOrNewIds,
  };
}
