import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  totalPages: number;
  basePath: string;
  query: Record<string, string | undefined>;
};

export function Pagination({ page, totalPages, basePath, query }: PaginationProps) {
  if (totalPages <= 1) return null;

  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={makeHref(page - 1)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-1")}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled className="inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
      )}
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={makeHref(page + 1)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-1")}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled className="inline-flex items-center gap-1">
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </nav>
  );
}
