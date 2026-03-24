"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { ModeToggle } from "@/components/mode-toggle";
import { PrimaryNav, PrimaryNavDrawer } from "@/components/primary-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-[0_1px_0_0_oklch(0.75_0.08_75_/_0.08)] backdrop-blur-md dark:border-border/80 dark:bg-background/90 dark:shadow-[0_1px_0_0_oklch(0.95_0.02_85_/_0.06)]">
      <div className="mx-auto max-w-6xl px-3 pb-2 pt-0.5 sm:px-4 lg:pb-3.5">
        {/* Mobile: single row — logo + theme + menu */}
        <div className="flex items-center justify-between gap-2 lg:hidden">
          <Link
            href="/"
            className="min-w-0 truncate font-heading text-lg font-semibold tracking-[0.02em] text-foreground"
          >
            SearchTheWord
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <ModeToggle />
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    aria-label="Open menu"
                    aria-expanded={menuOpen}
                  >
                    <Menu className="size-5" aria-hidden />
                  </Button>
                }
              />
              <SheetContent side="right" className="w-[min(100vw-1rem,20rem)] gap-0 p-0 sm:max-w-sm">
                <SheetHeader className="border-b border-border px-4 pb-4 pt-5 text-left">
                  <SheetTitle className="font-heading text-lg">SearchTheWord</SheetTitle>
                  <SheetDescription className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {isHome ? "Message search" : "Sermon search"}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4 px-4 py-4">
                  <BrowseLink className="h-11 w-full justify-start px-4 text-base font-medium" />
                  <PrimaryNavDrawer onNavigate={() => setMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Desktop: full toolbar */}
        <div className="hidden lg:flex lg:flex-row lg:items-center lg:gap-5 lg:gap-y-2">
          <div className="flex min-w-0 shrink-0 items-baseline gap-3">
            <Link
              href="/"
              className="min-w-0 truncate font-heading text-[1.35rem] font-semibold tracking-[0.02em] text-foreground"
            >
              SearchTheWord
            </Link>
            <span className="hidden shrink-0 text-[0.7rem] font-medium uppercase leading-none tracking-[0.16em] text-muted-foreground sm:inline">
              {isHome ? "Message search" : "Sermon search"}
            </span>
          </div>

          <PrimaryNav className="shrink-0" />

          {!isHome && (
            <div className="flex min-w-0 flex-1 flex-row items-center gap-3 border-l border-border/50 pl-5">
              <div className="min-w-0 flex-1">
                <SearchBar variant="header" className="w-full min-w-0" />
              </div>
              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <BrowseLink />
                <ModeToggle />
              </div>
            </div>
          )}

          {isHome && (
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <BrowseLink />
              <ModeToggle />
            </div>
          )}
        </div>

        {/* Mobile: search (second row only when not home) */}
        {!isHome && (
          <div className="mt-2 border-t border-border/40 pt-2 lg:hidden">
            <SearchBar variant="header" className="w-full min-w-0" />
          </div>
        )}
      </div>
    </header>
  );
}
