"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSearchBarShortcut } from "@/hooks/use-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  className?: string;
  defaultQuery?: string;
  /** Softer, compact strip for the site header on large screens (outline submit, lighter weight). */
  variant?: "default" | "header";
};

export function SearchBar({ className, defaultQuery = "", variant = "default" }: SearchBarProps) {
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  useSearchBarShortcut(inputRef);

  useEffect(() => {
    setQ(defaultQuery);
  }, [defaultQuery]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/search?${params.toString()}`);
  }

  const isHeader = variant === "header";

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "relative flex w-full min-w-0 gap-2",
        isHeader
          ? "flex-row items-center"
          : "flex-col sm:flex-row sm:items-stretch",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
            isHeader ? "left-2.5 h-3.5 w-3.5" : "left-3 h-4 w-4",
          )}
        />
        <Input
          ref={inputRef}
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search topics, verses, or questions…"
          className={cn(
            "w-full",
            isHeader
              ? "h-9 border-border/80 bg-muted/30 pl-8 text-sm shadow-none dark:bg-muted/20"
              : "min-h-11 pl-9",
          )}
          autoComplete="off"
          aria-label="Search sermons"
        />
      </div>
      <Button
        type="submit"
        variant={isHeader ? "outline" : "default"}
        size={isHeader ? "lg" : "default"}
        className={cn(
          "shrink-0",
          !isHeader && "h-11 w-full sm:w-auto sm:min-w-[5.5rem]",
          isHeader && "min-w-[4.75rem] font-medium shadow-sm",
        )}
      >
        Search
      </Button>
    </form>
  );
}
