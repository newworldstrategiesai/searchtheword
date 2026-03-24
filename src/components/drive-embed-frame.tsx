"use client";

import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

type DriveEmbedFrameProps = {
  embedUrl: string;
  originalUrl: string;
  /** Short label for iframe title / a11y */
  documentLabel?: string;
  className?: string;
};

/**
 * Embedded document preview. The hosted file must be viewable by the person loading the page.
 */
export function DriveEmbedFrame({ embedUrl, originalUrl, documentLabel = "Sermon document", className }: DriveEmbedFrameProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-muted/20 shadow-sm ring-1 ring-border/50 dark:bg-muted/10 dark:ring-border/30">
        <div className="relative w-full" style={{ minHeight: "min(85vh, 56rem)" }}>
          <iframe
            title={documentLabel}
            src={embedUrl}
            className="absolute inset-0 h-full min-h-[min(85vh,56rem)] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allow="autoplay *; fullscreen *; encrypted-media *"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 text-center">
        <p className="text-xs text-muted-foreground">
          Preview may require permission to view this file. If it stays blank, open it in a new tab.
        </p>
        <a
          href={originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-2")}
          aria-label="Open source document in a new tab"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Open original
        </a>
      </div>
    </div>
  );
}
