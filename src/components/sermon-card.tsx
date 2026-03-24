import Link from "next/link";
import { Calendar, User } from "lucide-react";
import type { SermonSearchRow } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeywordBadge } from "@/components/keyword-badge";
import { sanitizeHeadlineHtml } from "@/lib/sanitize-headline";
import { seriesListHref } from "@/lib/series-url";

type SermonCardProps = {
  sermon: SermonSearchRow;
  keywords?: string[];
};

export function SermonCard({ sermon, keywords = [] }: SermonCardProps) {
  const hl =
    sermon.highlight_summary?.trim() ||
    sermon.highlight_body?.trim() ||
    null;
  const excerpt =
    hl ||
    sermon.summary?.slice(0, 220) ||
    sermon.full_text?.slice(0, 220) ||
    "No summary available.";
  const truncated = !hl && excerpt.length >= 220 ? `${excerpt}…` : excerpt;

  return (
    <Card className="scroll-mt-28 transition-shadow hover:shadow-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl leading-snug">
          <Link href={`/sermon/${sermon.id}`} className="hover:underline">
            {sermon.title}
          </Link>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5" aria-hidden />
            {sermon.preacher}
          </span>
          {sermon.date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              {sermon.date}
            </span>
          )}
          {sermon.scripture_ref && (
            <span className="font-medium text-foreground">{sermon.scripture_ref}</span>
          )}
          {sermon.series && (
            <span className="text-muted-foreground">
              Series:{" "}
              <Link
                href={seriesListHref(sermon.series)}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {sermon.series}
              </Link>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hl ? (
          <div
            className="text-sm text-muted-foreground [&_mark]:rounded-sm [&_mark]:bg-primary/20 [&_mark]:text-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHeadlineHtml(hl) }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{truncated}</p>
        )}
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keywords.slice(0, 8).map((k, i) => (
              <KeywordBadge key={`${k}-${i}`} name={k} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
