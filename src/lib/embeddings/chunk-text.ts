import { CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS } from "@/lib/embeddings/constants";

function normalizeWhitespace(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

/**
 * Split sermon text into overlapping chunks for embedding. Deterministic for stable reindexes.
 */
export function chunkSermonForEmbedding(input: {
  title: string;
  fullText: string;
  summary?: string | null;
}): string[] {
  const title = input.title.trim();
  const summary = normalizeWhitespace(input.summary ?? "");
  const body = normalizeWhitespace(input.fullText);
  if (!body && !summary) return [];

  const header =
    title.length > 0 ? `Title: ${title}${summary ? `\nSummary: ${summary}` : ""}\n\n` : "";

  const full = normalizeWhitespace(header + (summary && !body ? summary : body));
  if (!full) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < full.length) {
    let end = Math.min(start + CHUNK_MAX_CHARS, full.length);
    if (end < full.length) {
      const slice = full.slice(start, end);
      const lastPara = slice.lastIndexOf("\n\n");
      const lastSpace = slice.lastIndexOf(" ");
      const breakAt =
        lastPara > CHUNK_MAX_CHARS * 0.4 ? lastPara + 2 : lastSpace > CHUNK_MAX_CHARS * 0.5 ? lastSpace + 1 : end;
      end = Math.min(start + breakAt, full.length);
    }
    const piece = full.slice(start, end).trim();
    if (piece.length > 0) chunks.push(piece);
    if (end >= full.length) break;
    start = Math.max(end - CHUNK_OVERLAP_CHARS, start + 1);
  }

  return chunks;
}
