"use client";

import { useEffect } from "react";

type SearchContextFallbackProps = {
  query: string;
  /** When false, {@link TranscriptWithSearchContext} owns scroll + messaging. */
  hasFullText: boolean;
  fallbackScrollId?: string;
};

/**
 * When the user opens a sermon with `?q=` but there is no transcript body, scroll to scripture/metadata.
 */
export function SearchContextFallback({
  query,
  hasFullText,
  fallbackScrollId,
}: SearchContextFallbackProps) {
  const q = query.trim();
  useEffect(() => {
    if (hasFullText || !q || !fallbackScrollId) return;
    const el = document.getElementById(fallbackScrollId);
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [hasFullText, q, fallbackScrollId]);

  if (hasFullText || !q) return null;

  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      You searched for &quot;{q}&quot;. This sermon may match in scripture references, topics, or other
      details above—there is no saved transcript to jump to.
    </p>
  );
}
