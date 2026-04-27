"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type SearchResultCopyButtonProps = {
  textToCopy: string;
  label?: string;
};

export function SearchResultCopyButton({ textToCopy, label = "Copy excerpt" }: SearchResultCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const payload = textToCopy.trim();
    if (!payload) {
      toast.error("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success("Snippet copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed", { description: "Try selecting and copying manually." });
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void handleCopy()}
      className="gap-1.5"
      aria-label="Copy search excerpt"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
