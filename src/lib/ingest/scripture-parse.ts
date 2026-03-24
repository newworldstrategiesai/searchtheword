import { normalizeScriptureRef } from "@/lib/ingest/normalize";

export type ParsedScriptureRef = {
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  raw: string;
  search_text: string;
};

/** Split a cell that may contain multiple references (semicolon / newline). */
export function splitScriptureRefs(raw: string | undefined | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[;\n\r]+/)
    .map((s) => s.trim().replace(/\u00a0/g, " "))
    .filter(Boolean);
}

/**
 * Parse one reference string into structured fields + search_text for trigram matching.
 * Uses normalizeScriptureRef for book names, then extracts chapter/verses.
 */
export function parseScriptureRefToParts(raw: string): ParsedScriptureRef | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const normalized = normalizeScriptureRef(trimmed);
  if (!normalized) return null;

  const m = normalized.match(/^(.+?)\s+(\d+)(?::(.+))?$/i);
  if (!m) {
    return null;
  }

  const book = m[1]!.trim();
  const chapter = Number.parseInt(m[2]!, 10);
  const versePart = m[3]?.trim();

  let verse_start: number | null = null;
  let verse_end: number | null = null;
  if (versePart) {
    const cleaned = versePart.replace(/[–—]/g, "-");
    const nums = cleaned
      .split(/[-,\s]+/)
      .map((x) => Number.parseInt(x, 10))
      .filter((n) => !Number.isNaN(n));
    if (nums.length) {
      verse_start = nums[0]!;
      verse_end = nums.length > 1 ? nums[nums.length - 1]! : nums[0]!;
    }
  }

  const bookKey = book.toLowerCase().replace(/\s+/g, " ").trim();
  const st = verse_start != null
    ? `${bookKey} ${chapter} ${verse_start}${verse_end != null && verse_end !== verse_start ? ` ${verse_end}` : ""}`
    : `${bookKey} ${chapter}`;

  return {
    book,
    chapter,
    verse_start,
    verse_end,
    raw: trimmed,
    search_text: st.replace(/\s+/g, " ").trim(),
  };
}
