/** Escape a string for safe use inside `new RegExp(...)` when matching literally. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Non-overlapping excerpts around each case-insensitive match. */
export function findTranscriptSnippets(text: string, query: string, max = 15): string[] {
  const q = query.trim();
  if (q.length < 2 || !text) return [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: string[] = [];
  let start = 0;
  while (out.length < max) {
    const i = lower.indexOf(needle, start);
    if (i === -1) break;
    const from = Math.max(0, i - 50);
    const to = Math.min(text.length, i + needle.length + 90);
    let snippet = text.slice(from, to);
    if (from > 0) snippet = `…${snippet}`;
    if (to < text.length) snippet = `${snippet}…`;
    out.push(snippet);
    start = i + needle.length;
  }
  return out;
}
