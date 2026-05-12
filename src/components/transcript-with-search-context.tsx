"use client";

import { useCallback, useEffect, useId, useMemo, useState, ReactNode } from "react";
import { ChevronDown, ChevronUp, Search, RotateCcw } from "lucide-react";
import { escapeRegExp } from "@/lib/transcript-search";
import { Button } from "@/components/ui/button";

type MatchPlan =
  | { kind: "none"; needle: null }
  | { kind: "literal"; needle: string };

function planMatch(text: string, rawQuery: string): MatchPlan {
  const q = rawQuery.trim();
  if (!q) return { kind: "none", needle: null };
  const escaped = escapeRegExp(q);
  const re = new RegExp(escaped, "gi");
  const hasLiteralMatch = re.test(text);
  return hasLiteralMatch ? { kind: "literal", needle: q } : { kind: "none", needle: null };
}

function renderHighlighted(text: string, needle: string, matchClass: string) {
  const re = new RegExp(escapeRegExp(needle), "gi");
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let count = 0;
  const r = new RegExp(re.source, re.flags);
  while ((m = r.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    const hit = m[0];
    const index = count++;
    nodes.push(
      <mark
        key={`${m.index}-${hit}`}
        data-match-index={index}
        className={matchClass}
      >
        {hit}
      </mark>,
    );
    last = m.index + hit.length;
    if (hit.length === 0) r.lastIndex++;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return { nodes, count };
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
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
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const hasQuery = query.trim().length >= 2;
  const plan = useMemo(() => planMatch(text, query), [text, query]);
  const hasMatch = plan.kind === "literal" && plan.needle !== null;
  const matchClassName =
    "scroll-mt-[max(10rem,calc(env(safe-area-inset-top,0px)+8.5rem))] lg:scroll-mt-[calc(env(safe-area-inset-top,0px)+5rem)] rounded-sm bg-primary/20 text-foreground transition-colors duration-200 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground dark:bg-primary/25 dark:data-[active=true]:bg-primary/40";

  const { nodes, count } = useMemo(() => {
    if (!hasMatch) return { nodes: [text], count: 0 };
    return renderHighlighted(text, plan.needle!, matchClassName);
  }, [text, plan, hasMatch, matchClassName]);

  useEffect(() => {
    setTimeout(() => {
      setTotalMatches(count);
      setCurrentMatchIndex(0);
    }, 0);
  }, [count]);

  const scrollToMatch = useCallback((index: number) => {
    const el = document.querySelector(`mark[data-match-index="${index}"]`);
    if (el) {
      document.querySelectorAll("mark[data-match-index]").forEach((m) => m.removeAttribute("data-active"));
      el.setAttribute("data-active", "true");
      setTimeout(() => {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 50);
    }
  }, []);

  useEffect(() => {
    if (!hasQuery || !hasMatch || count === 0) return;
    // Initial scroll to first match
    const tid = window.requestAnimationFrame(() => {
      scrollToMatch(0);
    });
    return () => window.cancelAnimationFrame(tid);
  }, [hasQuery, hasMatch, count, scrollToMatch]);

  useEffect(() => {
    if (!hasQuery || hasMatch || !fallbackScrollId) return;
    const el = document.getElementById(fallbackScrollId);
    if (!el) return;
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [hasQuery, hasMatch, fallbackScrollId]);

  const handlePrev = useCallback(() => {
    if (totalMatches <= 0) return;
    const prev = (currentMatchIndex - 1 + totalMatches) % totalMatches;
    setCurrentMatchIndex(prev);
    scrollToMatch(prev);
  }, [currentMatchIndex, scrollToMatch, totalMatches]);

  const handleNext = useCallback(() => {
    if (totalMatches <= 0) return;
    const nextIndex = (currentMatchIndex + 1) % totalMatches;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(nextIndex);
  }, [currentMatchIndex, scrollToMatch, totalMatches]);

  const handleAll = useCallback(() => {
    if (totalMatches <= 0) return;
    setCurrentMatchIndex(0);
    scrollToMatch(0);
  }, [scrollToMatch, totalMatches]);

  useEffect(() => {
    if (!hasQuery || !hasMatch || totalMatches <= 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) return;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        handleNext();
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, handlePrev, hasMatch, hasQuery, totalMatches]);

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
          scripture references, topics, or other metadata—check sections above.
        </p>
        <div className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap text-muted-foreground">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-[max(9.5rem,calc(env(safe-area-inset-top,0px)+7.75rem))] z-30 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/95 p-2 shadow-sm backdrop-blur-md lg:top-[calc(env(safe-area-inset-top,0px)+4.75rem)]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              &quot;{query.trim()}&quot;
            </span>
            <span className="text-xs text-muted-foreground">
              ({totalMatches > 0 ? currentMatchIndex + 1 : 0} of {totalMatches})
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Use arrow keys to move between matches
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePrev}
            disabled={totalMatches <= 1}
            aria-label="Previous match"
            aria-keyshortcuts="ArrowLeft ArrowUp"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNext}
            disabled={totalMatches <= 1}
            aria-label="Next match"
            aria-keyshortcuts="ArrowRight ArrowDown"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAll}
            className="h-8 px-3"
            aria-label="All matches - scroll to top"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p id={liveId} className="sr-only" aria-live="polite">
        Showing {totalMatches} matches for &quot;{query.trim()}&quot; in the transcript below.
      </p>

      <div
        className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap text-muted-foreground"
        aria-describedby={liveId}
        data-transcript-container="true"
      >
        {nodes}
      </div>
    </div>
  );
}
