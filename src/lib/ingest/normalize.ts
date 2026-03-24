import { BOOK_ALIASES } from "@/lib/ingest/scripture-books";

const WS = /\s+/g;

/** Split comma-separated keywords, lowercase, trim, dedupe */
export function normalizeKeywords(raw: string | undefined | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  const parts = raw.split(/[,;]/).map((s) => s.trim().toLowerCase());
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/**
 * Normalize scripture reference to "Book Chapter:Verse" style when possible.
 * Examples: "Jn 3:16" → "John 3:16", "phil 4:6-7" → "Philippians 4:6-7"
 */
export function normalizeScriptureRef(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.replace(WS, " ").trim();
  if (!s) return null;

  const m = s.match(/^(.+?)\s+(\d+)(?::([\d\s\-–]+))?$/i);
  if (!m) return s;

  let bookPart = m[1].trim();
  const chapter = m[2];
  const versePart = m[3]?.trim();

  const lower = bookPart.toLowerCase().replace(/\./g, "");
  const canonical = BOOK_ALIASES[lower];
  if (canonical) {
    bookPart = canonical;
  } else {
    bookPart = bookPart.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (versePart) {
    return `${bookPart} ${chapter}:${versePart}`;
  }
  return `${bookPart} ${chapter}`;
}

/** Parse various date strings to YYYY-MM-DD or null */
export function normalizeDate(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;

  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(t)) return t;

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (us) {
    const [, mm, dd, yyyy] = us;
    return `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`;
  }

  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

/** Split topics / tags on comma, semicolon, or newlines; lowercase, trim, dedupe */
export function splitTagList(raw: string | undefined | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  const parts = raw.split(/[,;\n\r]+/).map((s) => s.trim().toLowerCase());
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/** Excel 1900 date serial to YYYY-MM-DD (UTC). */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const epochMs = Date.UTC(1899, 11, 30);
  const ms = epochMs + Math.round(serial) * 86400000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
