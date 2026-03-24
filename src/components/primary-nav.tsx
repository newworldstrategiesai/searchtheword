"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, MessageSquare, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Search", icon: Database, match: (p: string) => p === "/" || p.startsWith("/search") || p.startsWith("/sermon") },
  { href: "/ask", label: "Ask AI", icon: MessageSquare, match: (p: string) => p.startsWith("/ask") },
  { href: "/admin", label: "Admin", icon: Shield, match: (p: string) => p.startsWith("/admin") },
] as const;

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Main">
      {links.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/20 dark:bg-primary/20 dark:ring-primary/30"
                : "text-muted-foreground hover:bg-muted/90 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 opacity-80" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
