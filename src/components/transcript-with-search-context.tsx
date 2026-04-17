"use client";

import { useEffect, useId, useMemo, useState, ReactNode } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { escapeRegExp } from "@/lib/transcript-search";
import { Button } from "@/components/ui/button";

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

  const plan = useMemo(() => planMatch(text, query), [text, query]);
  const hasQuery = query.trim().length > 0;
  const hasMatch = plan.kind === "literal" && plan.needle !== null;

  const matchClassName = "scroll-mt-32 rounded-sm bg-primary/20 text-foreground transition-colors duration-200 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground dark:bg-primary/25 dark:data-[active=true]:bg-primary/40";

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

  const scrollToMatch = (index: number) => {
    // Debug logging
    console.log(`Attempting to scroll to match index: ${index}`);
    
    const el = document.querySelector(`mark[data-match-index="${index}"]`);
    if (el) {
      // Clear previous active state
      document.querySelectorAll('mark[data-match-index]').forEach(m => m.removeAttribute('data-active'));
      // Set new active state
      el.setAttribute('data-active', 'true');
      
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        console.log(`Successfully scrolled to match index: ${index}`);
      }, 50);
    } else {
      console.error(`Could not find mark element with index: ${index}`);
      console.log('Available marks:', document.querySelectorAll('mark[data-match-index]'));
      // Set error flag for push if no errors functionality
      document.body.setAttribute('data-has-errors', 'true');
    }
  };

  useEffect(() => {
    if (!hasQuery || !hasMatch || count === 0) return;
    // Initial scroll to first match
    const tid = window.requestAnimationFrame(() => {
      scrollToMatch(0);
    });
    return () => window.cancelAnimationFrame(tid);
  }, [hasQuery, hasMatch, count]);

  useEffect(() => {
    if (!hasQuery || hasMatch || !fallbackScrollId) return;
    const el = document.getElementById(fallbackScrollId);
    if (!el) return;
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [hasQuery, hasMatch, fallbackScrollId]);

  const handleNext = () => {
    const next = (currentMatchIndex + 1) % totalMatches;
    setCurrentMatchIndex(next);
    scrollToMatch(next);
  };

  const handlePrev = () => {
    const prev = (currentMatchIndex - 1 + totalMatches) % totalMatches;
    setCurrentMatchIndex(prev);
    scrollToMatch(prev);
  };

  const handleNext = () => {
    const next = (currentMatchIndex + 1) % totalMatches;
    setCurrentMatchIndex(next);
    scrollToMatch(next);
  };

  const handleAll = () => {
    // Reset to first match and scroll to top
    setCurrentMatchIndex(0);
    scrollToMatch(0);
  };

  const handlePushIfNoErrors = () => {
    // Check if there are any console errors from navigation attempts
    const hasErrors = document.querySelector('[data-has-errors="true"]');
    if (!hasErrors) {
      // No errors found, push to next match
      handleNext();
    }
  };

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
    <div className="space-y-4">
      <div className="sticky top-16 z-10 flex items-center justify-between rounded-lg border border-border bg-background/95 p-2 shadow-sm backdrop-blur-md sm:top-20">
        <div className="flex items-center gap-2 px-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            &quot;{query.trim()}&quot;
          </span>
          <span className="text-xs text-muted-foreground">
            ({totalMatches > 0 ? currentMatchIndex + 1 : 0} of {totalMatches})
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
