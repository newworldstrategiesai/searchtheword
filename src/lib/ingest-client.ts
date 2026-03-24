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
    throw new Error("Import did not return a result");
  }
  return result;
}
