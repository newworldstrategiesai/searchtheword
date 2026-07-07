import type { IngestProgressEvent, IngestResult } from "@/lib/ingest/process";
import { ingestRows } from "@/lib/ingest/process";
import { getAdminSupabase } from "@/lib/require-admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * Each batch is a small slice of rows (default 50).  50 rows × ~4 DB
 * round-trips ≈ well under 60 s on any serverless tier.
 */
export const maxDuration = 120;

type BatchRequest = {
  rows: Record<string, string>[];
  /** Row number (1-indexed within the whole file) of the first row in this batch. */
  batchStart: number;
  /** Total rows in the whole file — used for progress display only. */
  totalRows: number;
};

type IngestStreamPayload =
  | { type: "progress"; event: IngestProgressEvent }
  | { type: "complete"; result: IngestResult }
  | { type: "error"; message: string };

/**
 * POST /api/ingest/batch
 *
 * Accepts a JSON body `{ rows, batchStart, totalRows }` and streams NDJSON
 * ingest progress + a final `complete` message — exactly like /api/ingest
 * but for a pre-parsed slice of rows.  Kept at a small maxDuration because
 * each batch is short-lived by design.
 */
export async function POST(request: Request) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  let body: BatchRequest;
  try {
    body = (await request.json()) as BatchRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { rows, batchStart = 1, totalRows } = body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: IngestStreamPayload) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const onProgress = (event: IngestProgressEvent) => {
          // Remap row numbers to be relative to the whole file, not just the batch.
          if (event.kind === "row") {
            send({
              type: "progress",
              event: {
                ...event,
                dataRow: batchStart + event.dataRow - 1,
                sheetRow: batchStart + event.dataRow,
                totalRows: totalRows ?? rows.length,
              },
            });
          } else {
            send({ type: "progress", event });
          }
        };

        const result = await ingestRows(supabase, rows, {
          onProgress,
          scheduleEmbeddingReindex: false,
        });

        send({ type: "complete", result });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Batch failed";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
