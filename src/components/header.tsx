"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchBar } from "@/components/search-bar";
import { ModeToggle } from "@/components/mode-toggle";
import { PrimaryNav } from "@/components/primary-nav";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 shadow-[0_1px_0_0_oklch(0.75_0.08_75_/_0.12)] backdrop-blur-md dark:shadow-[0_1px_0_0_oklch(0.95_0.02_85_/_0.08)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <Link
              href="/"
              className="font-heading text-xl font-semibold tracking-[0.02em] text-foreground sm:text-[1.35rem]"
            >
              SearchTheWord
            </Link>
            <span className="hidden text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground sm:inline">
              {isHome ? "Message search" : "Sermon search"}
            </span>
            <PrimaryNav />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isHome && <SearchBar className="w-full min-w-[12rem] sm:max-w-sm" />}
            <Link
              href="/search"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                !isHome ? "hidden sm:inline-flex" : "inline-flex",
              )}
            >
              Browse
            </Link>
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
