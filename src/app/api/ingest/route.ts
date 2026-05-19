import type { IngestProgressEvent, IngestResult } from "@/lib/ingest/process";
import { ingestFromCsvString, ingestFromXlsxBuffer } from "@/lib/ingest/process";
import { getAdminSupabase } from "@/lib/require-admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Bulk spreadsheet ingest can run many DB round-trips; default serverless limit (~60s) cuts off mid-file. */
export const maxDuration = 300;

type IngestStreamPayload =
  | { type: "progress"; event: IngestProgressEvent }
  | { type: "complete"; result: IngestResult }
  | { type: "error"; message: string };

export async function POST(request: Request) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  const supabase = createAdminSupabaseClient();

  const form = await request.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: IngestStreamPayload) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        send({
          type: "progress",
          event: { kind: "phase", message: "Reading uploaded file…" },
        });

        const buffer = await file.arrayBuffer();

        const onProgress = (event: IngestProgressEvent) => {
          send({ type: "progress", event });
        };

        const ingestOpts = { onProgress, scheduleEmbeddingReindex: false as const };
        const result = isXlsx
          ? await ingestFromXlsxBuffer(supabase, buffer, ingestOpts)
          : await ingestFromCsvString(supabase, new TextDecoder().decode(buffer), ingestOpts);

        send({ type: "complete", result });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed";
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
