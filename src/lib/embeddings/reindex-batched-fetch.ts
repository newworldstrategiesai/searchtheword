/**
 * Client-side: run embedding reindex in small server batches (avoids serverless timeouts).
 */

export const REINDEX_BATCH_SIZE = 20;
export const REINDEX_MAX_BATCHES = 500;

export type ReindexBatchedResult =
  | {
      ok: true;
      totalSermons: number;
      totalChunks: number;
      errors: string[];
      batches: number;
    }
  | {
      ok: false;
      error: string;
      totalSermons: number;
      totalChunks: number;
      errors: string[];
      batches: number;
    };

type ReindexApiJson = {
  ok?: boolean;
  error?: string;
  partial?: boolean;
  nextSkip?: number | null;
  sermonsProcessed?: number;
  chunksWritten?: number;
  errors?: string[];
};

export async function fetchReindexEmbeddingsBatched(options?: {
  takePerRequest?: number;
  onProgress?: (p: {
    batchIndex: number;
    totalSermons: number;
    totalChunks: number;
  }) => void;
}): Promise<ReindexBatchedResult> {
  const take = options?.takePerRequest ?? REINDEX_BATCH_SIZE;
  const onProgress = options?.onProgress;

  let skip = 0;
  let totalSermons = 0;
  let totalChunks = 0;
  const errors: string[] = [];
  let batches = 0;

  for (; batches < REINDEX_MAX_BATCHES; batches++) {
    const res = await fetch("/api/admin/reindex-embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ skip, take }),
    });

    const json = (await res.json()) as ReindexApiJson;

    if (!res.ok) {
      return {
        ok: false,
        error: json.error ?? res.statusText,
        totalSermons,
        totalChunks,
        errors,
        batches,
      };
    }

    totalSermons += json.sermonsProcessed ?? 0;
    totalChunks += json.chunksWritten ?? 0;
    if (json.errors?.length) errors.push(...json.errors);

    onProgress?.({ batchIndex: batches, totalSermons, totalChunks });

    if (!json.partial) {
      return { ok: true, totalSermons, totalChunks, errors, batches: batches + 1 };
    }

    skip = json.nextSkip ?? skip + take;
  }

  return {
    ok: false,
    error: "Stopped after max batches — click reindex again to continue.",
    totalSermons,
    totalChunks,
    errors,
    batches,
  };
}
