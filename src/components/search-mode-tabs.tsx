import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SearchMode } from "@/lib/types";

const MODES: { id: SearchMode; label: string }[] = [
  { id: "all", label: "All" },
  { id: "scripture", label: "Scripture" },
  { id: "topic", label: "Topics" },
  { id: "fulltext", label: "Full text" },
];

type SearchModeTabsProps = {
  q: string;
  active: SearchMode;
  extraParams?: Record<string, string | undefined>;
};

export function SearchModeTabs({ q, active, extraParams = {} }: SearchModeTabsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Search mode">
      {MODES.map((m) => {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        params.set("mode", m.id);
        Object.entries(extraParams).forEach(([k, v]) => {
          if (v) params.set(k, v);
        });
        const href = `/search?${params.toString()}`;
        const isActive = active === m.id;
        return (
          <Link
            key={m.id}
            href={href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "rounded-full border px-3 py-1 text-base transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            {m.label}
          </Link>
        );
      })}
    </div>
  );
}
