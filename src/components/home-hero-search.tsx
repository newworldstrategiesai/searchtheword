"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useSearchBarShortcut } from "@/hooks/use-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SearchMode } from "@/lib/types";

const MODES: { id: SearchMode; label: string }[] = [
  { id: "all", label: "AI search" },
  { id: "fulltext", label: "Exact match" },
  { id: "topic", label: "All words" },
];

const HINTS = [
  {
    title: "How smart search works",
    body: "Smart search finds related results across the whole message. A query like “Holy Spirit” can also surface sermons that say “Holy Ghost.”",
  },
  {
    title: "Exact match",
    body: "Use exact match when you want literal phrases from sermon text — helpful for titles, names, or specific wording.",
  },
  {
    title: "All words (topics)",
    body: "Topic mode weights tags and themes. Combine with a clear keyword for the best match to your question.",
  },
];

export function HomeHeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<SearchMode>("all");
  const [hintIndex, setHintIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useSearchBarShortcut(inputRef);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (mode !== "all") params.set("mode", mode);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="relative z-[1] mx-auto w-full max-w-2xl space-y-10 text-center">
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Sermon archive</p>
        <h1 className="text-balance font-heading text-[2.35rem] font-semibold leading-[1.12] tracking-tight text-foreground sm:text-5xl md:text-[3.15rem]">
          Search the message
          <span
            className="ml-1 inline-block h-[0.72em] w-[2px] translate-y-0.5 bg-primary align-middle animate-pulse sm:h-[0.7em]"
            aria-hidden
          />
        </h1>
        <div className="mx-auto max-w-xl space-y-3 text-balance">
          <p className="text-base font-medium leading-relaxed text-foreground sm:text-lg">
            Contained herein is the Hidden Manna for the Overcomers
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            —The theological life work of John Shane Vaughn, Founder of The Apostolic Assemblies and First Harvest
            Ministries International.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Within this archive, you may search in rich detail through his sermons, books, and doctrinal treatises—a gift to
            this generation, and to those who follow, if any remain.
          </p>
        </div>
        <p className="mx-auto max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
          Enter your search terms below — then browse results by scripture, topics, or full text.
        </p>
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Two ways to explore:</span>
          <Link href="/search" className="underline underline-offset-2 hover:text-foreground">
            Searchable database
          </Link>
          <span aria-hidden className="text-border">
            ·
          </span>
          <Link href="/ask" className="underline underline-offset-2 hover:text-foreground">
            Ask AI
          </Link>
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 text-left">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Enter your search terms here"
            className="h-12 rounded-xl border-border/90 bg-card pl-12 pr-4 text-base shadow-[0_2px_12px_-4px_oklch(0.35_0.06_255_/_0.12)] md:h-14 md:text-lg dark:shadow-black/20"
            autoComplete="off"
            aria-label="Search sermons"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start" role="radiogroup" aria-label="Search mode">
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/15"
                      : "border-border/80 bg-card/80 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <Button type="submit" size="lg" className="w-full shrink-0 sm:w-auto">
            Search
          </Button>
        </div>
      </form>

      <div className="rounded-2xl border border-border/70 bg-card/80 px-5 py-6 text-left shadow-[0_4px_24px_-8px_oklch(0.35_0.06_255_/_0.12)] backdrop-blur-[2px] dark:bg-card/60 dark:shadow-black/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hint #{hintIndex + 1}
        </p>
        <h2 className="mt-2 font-semibold text-foreground">{HINTS[hintIndex]!.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{HINTS[hintIndex]!.body}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setHintIndex((i) => (i - 1 + HINTS.length) % HINTS.length)}
            aria-label="Previous hint"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setHintIndex((i) => (i + 1) % HINTS.length)}
            aria-label="Next hint"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
