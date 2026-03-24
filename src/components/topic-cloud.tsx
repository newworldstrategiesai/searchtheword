import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Keyword } from "@/lib/types";
import { cn } from "@/lib/utils";

type TopicCloudProps = {
  keywords: Keyword[];
  className?: string;
};

export function TopicCloud({ keywords, className }: TopicCloudProps) {
  if (!keywords.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Topics will appear here after sermons are imported.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {keywords.slice(0, 40).map((k) => (
        <Link key={k.id} href={`/search?q=${encodeURIComponent(k.name)}`}>
          <Badge
            variant="outline"
            className="cursor-pointer rounded-full border-border/80 px-3.5 py-1.5 text-sm font-normal transition-all hover:border-primary/40 hover:bg-primary/8 hover:text-foreground"
          >
            {k.name}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
