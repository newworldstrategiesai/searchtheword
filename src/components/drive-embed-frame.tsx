"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

type DriveEmbedFrameProps = {
  embedUrl: string;
  /** Short label for iframe title / a11y */
  documentLabel?: string;
  className?: string;
};

/**
 * Embedded document preview. The hosted file must be viewable by the person loading the page.
 */
export function DriveEmbedFrame({ embedUrl, documentLabel = "Sermon document", className }: DriveEmbedFrameProps) {
  const [expanded, setExpanded] = useState(false);

  const exit = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, exit]);

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
            ? "border-b border-border bg-muted/40 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm dark:bg-muted/20"
            : "gap-y-2",
        )}
      >
        {expanded && (
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{documentLabel}</p>
        )}
        {!expanded && (
          <p className="text-xs text-muted-foreground">
            If the preview is blank, you may need permission to view this file.
          </p>
        )}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className={cn(
            buttonVariants({ variant: expanded ? "secondary" : "outline", size: "sm" }),
            "ml-auto inline-flex shrink-0 items-center gap-2",
          )}
          aria-expanded={expanded}
          aria-label={expanded ? "Exit full screen" : "Full screen"}
        >
          {expanded ? (
            <>
              <Minimize2 className="size-3.5" aria-hidden />
              Exit full screen
            </>
          ) : (
            <>
              <Maximize2 className="size-3.5" aria-hidden />
              Full screen
            </>
          )}
        </button>
      </div>

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
            title={documentLabel}
            src={embedUrl}
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
