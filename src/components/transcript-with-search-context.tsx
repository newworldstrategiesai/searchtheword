"use client";

import { useEffect, useId, useMemo, useRef, type ReactNode, type RefObject } from "react";
import { escapeRegExp } from "@/lib/transcript-search";

type MatchPlan =
  | { kind: "none"; needle: null }
  | { kind: "literal"; needle: string };

function planMatch(text: string, rawQuery: string): MatchPlan {
  const q = rawQuery.trim();
  if (!q) return { kind: "none", needle: null };

  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  if (lower.includes(qLower)) {
    return { kind: "literal", needle: q };
  }

  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  for (const t of tokens) {
    if (lower.includes(t.toLowerCase())) {
      return { kind: "literal", needle: t };
    }
  }

  return { kind: "none", needle: null };
}

function renderHighlighted(text: string, needle: string, firstMarkRef: RefObject<HTMLElement | null>) {
  const re = new RegExp(escapeRegExp(needle), "gi");
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let first = true;
  const r = new RegExp(re.source, re.flags);
  while ((m = r.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    const hit = m[0];
    nodes.push(
      <mark
        key={`${m.index}-${hit}`}
        ref={first ? firstMarkRef : undefined}
        className="scroll-mt-28 rounded-sm bg-primary/20 text-foreground dark:bg-primary/25"
      >
        {hit}
      </mark>,
    );
    first = false;
    last = m.index + hit.length;
    if (hit.length === 0) r.lastIndex++;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}

type TranscriptWithSearchContextProps = {
  text: string;
  query: string;
  /** When set and there is no literal match in `text`, scroll this element into view. */
  fallbackScrollId?: string;
};

export function TranscriptWithSearchContext({
  text,
  query,
  fallbackScrollId,
}: TranscriptWithSearchContextProps) {
  const liveId = useId();
  const firstMarkRef = useRef<HTMLElement | null>(null);
  const plan = useMemo(() => planMatch(text, query), [text, query]);
  const hasQuery = query.trim().length > 0;
  const hasMatch = plan.kind === "literal" && plan.needle !== null;

  useEffect(() => {
    if (!hasQuery || !hasMatch) return;
    const el = firstMarkRef.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [hasQuery, hasMatch, text, plan]);

  useEffect(() => {
    if (!hasQuery || hasMatch || !fallbackScrollId) return;
    const el = document.getElementById(fallbackScrollId);
    if (!el) return;
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [hasQuery, hasMatch, fallbackScrollId]);

  if (!hasQuery) {
    return (
      <div className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap text-muted-foreground">
        {text}
      </div>
    );
  }

  if (!hasMatch) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          No exact match for &quot;{query.trim()}&quot; in this transcript. This result may have matched
          scripture references, topics, or other metadata—check the sections above.
        </p>
        <div className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap text-muted-foreground">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p id={liveId} className="text-sm text-muted-foreground" aria-live="polite">
        Showing matches for &quot;{query.trim()}&quot; in the transcript below.
      </p>
      <div
        className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap text-muted-foreground [&_mark]:rounded-sm [&_mark]:bg-primary/20 [&_mark]:text-foreground dark:[&_mark]:bg-primary/25"
        aria-describedby={liveId}
      >
        {renderHighlighted(text, plan.needle!, firstMarkRef)}
      </div>
    </div>
  );
}
