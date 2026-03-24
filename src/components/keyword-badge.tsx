import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type KeywordBadgeProps = {
  name: string;
  className?: string;
};

export function KeywordBadge({ name, className }: KeywordBadgeProps) {
  return (
    <Link href={`/search?q=${encodeURIComponent(name)}`}>
      <Badge
        variant="secondary"
        className={cn(
          "cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground",
          className,
        )}
      >
        {name}
      </Badge>
    </Link>
  );
}
