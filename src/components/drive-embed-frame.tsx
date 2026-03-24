"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2, Search } from "lucide-react";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { escapeRegExp, findTranscriptSnippets } from "@/lib/transcript-search";

type DriveEmbedFrameProps = {
  embedUrl: string;
  /** Short label for iframe title / a11y */
  documentLabel?: string;
  /** When set, fullscreen search matches against this text (e.g. sermon full_text). */
  fullText?: string | null;
  className?: string;
};

function highlightSnippet(snippet: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return snippet;
  const parts = snippet.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="rounded-sm bg-primary/25 text-foreground dark:bg-primary/35">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/**
 * Embedded document preview. The hosted file must be viewable by the person loading the page.
 * Cross-origin embeds cannot be searched from JavaScript; when `fullText` is absent, search focuses the iframe and prompts for ⌘F / Ctrl+F.
 */
export function DriveEmbedFrame({
  embedUrl,
  documentLabel = "Sermon document",
  fullText,
  className,
}: DriveEmbedFrameProps) {
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFindHint, setShowFindHint] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const searchId = useId();
  const exit = useCallback(() => setExpanded(false), []);

  const hasTranscript = Boolean(fullText?.trim());

  const transcriptSnippets = useMemo(() => {
    if (!expanded || !hasTranscript || searchQuery.trim().length < 2) return [];
    return findTranscriptSnippets(fullText!, searchQuery, 15);
  }, [expanded, fullText, hasTranscript, searchQuery]);

  const focusIframeForBrowserFind = useCallback(() => {
    iframeRef.current?.focus();
    setShowFindHint(true);
    window.setTimeout(() => setShowFindHint(false), 10_000);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) {
      setSearchQuery("");
      setShowFindHint(false);
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (searchQuery.trim()) {
        e.preventDefault();
        setSearchQuery("");
        return;
      }
      exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, exit, searchQuery]);

  return (
    <div
      className={cn(
        "flex flex-col",
        expanded
          ? "fixed inset-0 z-[100] min-h-0 overscroll-none bg-background pb-[env(safe-area-inset-bottom)]"
          : "space-y-3",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center justify-between gap-3",
          expanded
            ? "hidden"
            : "gap-y-2",
        )}
      >
        {!expanded && (
          <p className="text-xs text-muted-foreground">
            If the preview is blank, you may need permission to view this file.
          </p>
        )}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "ml-auto inline-flex shrink-0 items-center gap-2",
          )}
          aria-expanded={expanded}
          aria-label="Full screen"
        >
          <Maximize2 className="size-3.5" aria-hidden />
          Full screen
        </button>
      </div>

      {expanded && (
        <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-muted/40 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm dark:bg-muted/20">
          <div className="flex flex-col gap-3 px-4 pb-3 md:flex-row md:items-center md:gap-4">
            <p className="min-w-0 shrink-0 truncate text-sm font-medium text-foreground md:max-w-[min(36vw,14rem)] lg:max-w-xs">
              {documentLabel}
            </p>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" data-document-search>
              <div className="relative min-w-0 flex-1 md:max-w-xl">
                <label htmlFor={searchId} className="sr-only">
                  {hasTranscript ? "Search sermon transcript" : "Find in embedded document"}
                </label>
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id={searchId}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !hasTranscript) {
                      e.preventDefault();
                      focusIframeForBrowserFind();
                    }
                  }}
                  placeholder={hasTranscript ? "Search transcript…" : "Find in document…"}
                  className="h-9 pl-9"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "inline-flex shrink-0 items-center gap-2",
                )}
                aria-label="Exit full screen"
              >
                <Minimize2 className="size-3.5" aria-hidden />
                Exit full screen
              </button>
            </div>
          </div>
          {showFindHint && !hasTranscript && (
            <p className="border-t border-border/60 px-4 pb-3 text-xs text-muted-foreground dark:border-border/40">
              Document focused — use ⌘F (Mac) or Ctrl+F (Windows) to search inside the file.
            </p>
          )}
          {hasTranscript && searchQuery.trim().length >= 2 && (
            <div className="border-t border-border/60 bg-muted/30 px-4 py-3 dark:border-border/40 dark:bg-muted/15">
              {transcriptSnippets.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matches in the saved transcript.</p>
              ) : (
                <>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {transcriptSnippets.length} match{transcriptSnippets.length === 1 ? "" : "es"} in transcript
                  </p>
                  <ul className="max-h-36 space-y-2 overflow-y-auto text-sm leading-snug">
                    {transcriptSnippets.map((snippet, i) => (
                      <li
                        key={i}
                        className="rounded-md border border-border/70 bg-background/90 px-3 py-2 text-foreground shadow-sm dark:bg-background/60"
                      >
                        {highlightSnippet(snippet, searchQuery)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "min-h-0 overflow-hidden bg-muted/20 shadow-sm ring-1 ring-border/50 dark:bg-muted/10 dark:ring-border/30",
          expanded
            ? "flex min-h-0 flex-1 flex-col rounded-none border-0 ring-0 shadow-none"
            : "rounded-xl border border-border",
        )}
      >
        <div
          className={cn("relative w-full", expanded && "min-h-0 flex-1")}
          style={expanded ? undefined : { minHeight: "min(70vh, 48rem)" }}
        >
          <iframe
            ref={iframeRef}
            title={documentLabel}
            src={embedUrl}
            tabIndex={-1}
            className={cn(
              "absolute inset-0 w-full border-0",
              expanded ? "h-full" : "min-h-[min(70vh,48rem)] h-full",
            )}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allow="autoplay *; fullscreen *; encrypted-media *"
          />
        </div>
      </div>
    </div>
  );
}
