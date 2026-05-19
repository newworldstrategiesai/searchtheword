import type { IngestProgressEvent, IngestResult } from "@/lib/ingest/process";

type IngestStreamPayload =
  | { type: "progress"; event: IngestProgressEvent }
  | { type: "complete"; result: IngestResult }
  | { type: "error"; message: string };

/**
 * Reads NDJSON lines from POST /api/ingest streaming response.
 */
export async function consumeIngestNdjsonStream(
  body: ReadableStream<Uint8Array>,
  onProgress: (event: IngestProgressEvent) => void,
): Promise<IngestResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: IngestResult | null = null;
  let lastRowCurrent = 0;
  let lastRowTotal = 0;

  function processLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: IngestStreamPayload;
    try {
      msg = JSON.parse(trimmed) as IngestStreamPayload;
    } catch {
      return;
    }
    if (msg.type === "progress") {
      if (msg.event.kind === "row") {
        lastRowCurrent = msg.event.dataRow;
        lastRowTotal = msg.event.totalRows;
      }
      onProgress(msg.event);
    } else if (msg.type === "complete") {
      result = msg.result;
    } else if (msg.type === "error") {
      throw new Error(msg.message);
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      processLine(line);
    }
    if (done) break;
  }
  if (buffer.trim()) {
    processLine(buffer);
  }
  if (!result) {
    const progress =
      lastRowTotal > 0
        ? ` (stopped around row ${lastRowCurrent} of ${lastRowTotal})`
        : "";
    throw new Error(
      `Import stopped before it could finish${progress}. The connection may have timed out. Rows processed before the stop may already be saved — check Admin → Sermons. Then open Advanced → “Refresh search for all sermons” so Ask/search picks up new text.`,
    );
  }
  return result;
}
