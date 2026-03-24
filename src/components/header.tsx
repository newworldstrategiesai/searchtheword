"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchBar } from "@/components/search-bar";
import { ModeToggle } from "@/components/mode-toggle";
import { PrimaryNav } from "@/components/primary-nav";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

function BrowseLink({ className }: { className?: string }) {
  return (
    <Link href="/search" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-9 whitespace-nowrap", className)}>
      Browse
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-[0_1px_0_0_oklch(0.75_0.08_75_/_0.08)] backdrop-blur-md dark:border-border/80 dark:bg-background/90 dark:shadow-[0_1px_0_0_oklch(0.95_0.02_85_/_0.06)]">
      <div className="mx-auto max-w-6xl px-3 pb-3 pt-0.5 sm:px-4 sm:pb-3.5">
        <div className="flex flex-col gap-2.5 sm:gap-3 lg:flex-row lg:items-center lg:gap-5 lg:gap-y-2">
          {/* Brand — mobile: theme (and Browse only on home) */}
          <div className="flex min-h-[2.75rem] items-center justify-between gap-3 lg:min-h-0 lg:shrink-0">
            <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
              <Link
                href="/"
                className="min-w-0 truncate font-heading text-lg font-semibold tracking-[0.02em] text-foreground sm:text-[1.35rem]"
              >
                SearchTheWord
              </Link>
              <span className="hidden shrink-0 text-[0.65rem] font-medium uppercase leading-none tracking-[0.16em] text-muted-foreground sm:inline sm:text-[0.7rem]">
                {isHome ? "Message search" : "Sermon search"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2 lg:hidden">
              {isHome && <BrowseLink />}
              <ModeToggle />
            </div>
          </div>

          <PrimaryNav className="lg:shrink-0" />

          {!isHome && (
            <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-1 lg:flex-row lg:items-center lg:gap-3 lg:border-l lg:border-border/50 lg:pl-5">
              <div className="min-w-0 flex-1">
                <SearchBar variant="header" className="w-full min-w-0" />
              </div>
              <div className="hidden shrink-0 items-center gap-1 sm:gap-2 lg:flex">
                <BrowseLink />
                <ModeToggle />
              </div>
            </div>
          )}

          {isHome && (
            <div className="hidden shrink-0 items-center gap-1 sm:gap-2 lg:ml-auto lg:flex">
              <BrowseLink />
              <ModeToggle />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
