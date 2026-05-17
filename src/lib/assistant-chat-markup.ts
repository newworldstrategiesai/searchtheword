/**
 * Client-safe helpers for rendering assistant chat text (links, bold,
 * and bracket-style suggest_navigation the model sometimes prints as prose).
 */

export type AssistantNavChip = { url: string; label: string };

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  return String(v);
}

/** Same URL rules as server `execSuggestNavigation` in admin-assistant/tools. */
export function buildSuggestNavigationUrl(args: Record<string, string>): AssistantNavChip {
  const destination = str(args.destination)?.trim() || "/admin";
  const label = str(args.label)?.trim() || "Go";
  const fragment = str(args.fragment)?.trim();

  const urlBase = destination.startsWith("/")
    ? destination
    : `/${destination.replace(/^\/+/, "")}`;

  let url = urlBase;
  if (fragment) url += `#${fragment}`;
  return { url, label };
}

/** Parses `key="a", label='b'` style argument lists (order-independent). */
export function parseQuotedNavArgs(inner: string): Record<string, string> {
  const out: Record<string, string> = {};
  const reDq = /(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = reDq.exec(inner)) !== null) {
    out[m[1].toLowerCase()] = m[2].replace(/\\"/g, '"');
  }
  const reSq = /(\w+)\s*=\s*'((?:[^'\\]|\\.)*)'/g;
  while ((m = reSq.exec(inner)) !== null) {
    const k = m[1].toLowerCase();
    if (!(k in out)) out[k] = m[2].replace(/\\'/g, "'");
  }
  return out;
}

const NAV_BRACKET_GLOBAL = /\[suggest_navigation\]\s*\(\s*[^)]*\s*\)/gi;

/**
 * Removes literal `[suggest_navigation](...)` lines the model sometimes prints
 * instead of calling the tool; returns chips the UI can merge with tool_results.
 */
export function stripAndExtractNavigationBrackets(text: string): {
  cleanText: string;
  navigations: AssistantNavChip[];
} {
  const navigations: AssistantNavChip[] = [];
  const seen = new Set<string>();

  const innerRe = /\[suggest_navigation\]\s*\(\s*([^)]*)\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = innerRe.exec(text)) !== null) {
    const inner = (match[1] ?? "").trim();
    if (!inner) continue;
    const kv = parseQuotedNavArgs(inner);
    const destination = kv.destination;
    if (!destination) continue;
    try {
      const chip = buildSuggestNavigationUrl({
        destination,
        label: kv.label || "Go",
        fragment: kv.fragment,
      });
      const dedupe = `${chip.url}\t${chip.label}`;
      if (!seen.has(dedupe)) {
        seen.add(dedupe);
        navigations.push(chip);
      }
    } catch {
      /* ignore malformed */
    }
  }

  const cleanText = text
    .replace(NAV_BRACKET_GLOBAL, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();

  return { cleanText, navigations };
}

export function isSafeAssistantHref(href: string): boolean {
  const t = href.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) return false;
  if (t.startsWith("/") && !t.startsWith("//")) return true;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function isAssistantNavChipResult(r: unknown): r is AssistantNavChip {
  return (
    r != null &&
    typeof r === "object" &&
    "url" in r &&
    "label" in r &&
    typeof (r as AssistantNavChip).url === "string" &&
    typeof (r as AssistantNavChip).label === "string"
  );
}

/** Dedupes by url+label; keeps original tool result order, appends bracket-derived chips. */
export function mergeSuggestNavigationChips<T extends { name: string; result: unknown }>(
  toolResults: T[] | undefined,
  extra: AssistantNavChip[],
): T[] {
  const base = [...(toolResults ?? [])];
  const existing = new Set(
    base
      .filter((r) => r.name === "suggest_navigation" && isAssistantNavChipResult(r.result))
      .map((r) => `${(r.result as AssistantNavChip).url}\t${(r.result as AssistantNavChip).label}`),
  );
  const out = [...base] as T[];
  for (const n of extra) {
    const k = `${n.url}\t${n.label}`;
    if (existing.has(k)) continue;
    existing.add(k);
    out.push({ name: "suggest_navigation", result: n } as T);
  }
  return out;
}
