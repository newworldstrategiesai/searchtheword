"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, GraduationCap, MessageSquare, Shield, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const PRIMARY_NAV_LINKS = [
  {
    href: "/",
    label: "Search",
    icon: Database,
    match: (p: string) => p === "/" || p.startsWith("/search") || p.startsWith("/sermon"),
  },
  {
    href: "/search?document_type=Bible%20Study",
    label: "Studies",
    icon: GraduationCap,
    match: () => false,
  },
  { href: "/ask", label: "Ask AI", icon: MessageSquare, match: (p: string) => p.startsWith("/ask") },
  { href: "/account", label: "Account", icon: UserCircle, match: (p: string) => p.startsWith("/account") },
  { href: "/admin", label: "Admin", icon: Shield, match: (p: string) => p.startsWith("/admin") },
] as const;

type PrimaryNavProps = {
  className?: string;
};

export function PrimaryNav({ className }: PrimaryNavProps) {
  const pathname = usePathname();

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className="-mx-1 overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <nav
          className="flex w-max max-w-none flex-nowrap items-center gap-1 sm:w-auto sm:flex-wrap sm:gap-1.5 lg:w-auto lg:gap-2"
          aria-label="Main"
        >
          {PRIMARY_NAV_LINKS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-2.5 text-sm font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-base lg:py-1.5 lg:text-sm",
                  "min-h-[2.75rem] sm:min-h-0 lg:min-h-0",
                  active
                    ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/20 dark:bg-primary/20 dark:ring-primary/30"
                    : "text-muted-foreground hover:bg-muted/90 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

type PrimaryNavDrawerProps = {
  onNavigate?: () => void;
  className?: string;
};

/** Full-width vertical links for mobile sheet menu */
export function PrimaryNavDrawer({ onNavigate, className }: PrimaryNavDrawerProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-0.5", className)} aria-label="Main">
      {PRIMARY_NAV_LINKS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-[3rem] items-center gap-3 rounded-xl px-3 py-2 text-base font-medium transition-colors",
              active
                ? "bg-primary/12 text-primary ring-1 ring-primary/20 dark:bg-primary/20"
                : "text-foreground hover:bg-muted/90",
            )}
          >
            <Icon className="size-5 shrink-0 opacity-80" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
