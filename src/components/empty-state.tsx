import Link from "next/link";
import { Search } from "lucide-react";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  query?: string;
};

export function EmptyState({ query }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
      <Search className="h-12 w-12 text-muted-foreground" aria-hidden />
      <div className="space-y-2">
        <p className="text-lg font-medium">
          {query ? `No sermons found for “${query}”` : "No sermons match your filters"}
        </p>
        <p className="max-w-md text-base text-muted-foreground">
          Try a different keyword, scripture reference, or browse topics from the home page.
        </p>
      </div>
      <Link href="/" className={cn(buttonVariants({ variant: "secondary" }))}>
        Back to home
      </Link>
    </div>
  );
}
