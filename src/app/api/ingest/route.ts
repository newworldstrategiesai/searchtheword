import { isAdmin } from "@/lib/auth";
import type { IngestProgressEvent, IngestResult } from "@/lib/ingest/process";
import { ingestFromCsvString, ingestFromXlsxBuffer } from "@/lib/ingest/process";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type IngestStreamPayload =
  | { type: "progress"; event: IngestProgressEvent }
  | { type: "complete"; result: IngestResult }
  | { type: "error"; message: string };

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

        const result = isXlsx
          ? await ingestFromXlsxBuffer(supabase, buffer, { onProgress })
          : await ingestFromCsvString(supabase, new TextDecoder().decode(buffer), { onProgress });

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
    },
  });
}
