import Link from "next/link";
import { ArrowLeft, Calendar, ExternalLink, Folder, Library, User } from "lucide-react";
import type { SermonWithKeywords } from "@/lib/types";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { KeywordBadge } from "@/components/keyword-badge";
import { DriveEmbedFrame } from "@/components/drive-embed-frame";
import { TranscriptWithSearchContext } from "@/components/transcript-with-search-context";
import { SearchContextFallback } from "@/components/search-context-fallback";
import { getGoogleDriveEmbedInfo, isDriveFolderUrl } from "@/lib/google-drive-embed";
import { seriesListHref } from "@/lib/series-url";
import { SermonDetailAdminControls } from "@/components/sermon-detail-admin-controls";

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1) || null;
    }
    if (u.searchParams.get("v")) {
      return u.searchParams.get("v");
    }
    if (u.pathname.includes("/embed/")) {
      return u.pathname.split("/embed/")[1]?.split("/")[0] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function MediaBlock({
  url,
  fullText,
  initialTranscriptSearch,
}: {
  url: string;
  fullText?: string | null;
  initialTranscriptSearch?: string | null;
}) {
  const ytId = extractYoutubeId(url);
  if (ytId) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
        <iframe
          title="Sermon video"
          src={`https://www.youtube.com/embed/${ytId}`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (/\.(mp3|m4a|wav|ogg)(\?|$)/i.test(url)) {
    return (
      <audio controls className="w-full" preload="metadata">
        <source src={url} />
        Your browser does not support audio.
      </audio>
    );
  }
  const driveEmbed = getGoogleDriveEmbedInfo(url);
  if (driveEmbed) {
    return (
      <DriveEmbedFrame
        embedUrl={driveEmbed.embedUrl}
        documentLabel="Sermon media"
        fullText={fullText}
        initialTranscriptSearch={initialTranscriptSearch}
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: "outline" }), "inline-flex items-center")}
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      Open media
    </a>
  );
}

function formatRef(r: NonNullable<SermonWithKeywords["scripture_refs"]>[0]): string {
  const vs =
    r.verse_start != null
      ? r.verse_end != null && r.verse_end !== r.verse_start
        ? `${r.verse_start}–${r.verse_end}`
        : String(r.verse_start)
      : "";
  const mid = vs ? `:${vs}` : "";
  return `${r.book} ${r.chapter}${mid}`;
}

type SermonDetailProps = {
  sermon: SermonWithKeywords;
  /** From `?q=` when opening a sermon from search; highlights and scrolls in transcript. */
  highlightQuery?: string;
};

function SourceDocumentSection({
  url,
  title,
  fullText,
}: {
  url: string;
  title: string;
  fullText?: string | null;
  initialTranscriptSearch?: string | null;
}) {
  if (fullText?.trim()) {
    return (
      <div className="rounded-xl border border-border bg-muted/25 p-5 dark:bg-muted/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Original source document</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This teaching is shown above as searchable text so readers can jump directly to matched words.
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex shrink-0 items-center gap-2")}
            aria-label={`Open source document for ${title}`}
          >
            <ExternalLink className="h-4 w-4" />
            Open source
          </a>
        </div>
      </div>
    );
  }
  const embed = getGoogleDriveEmbedInfo(url);
  if (embed) {
    return (
      <DriveEmbedFrame
        embedUrl={embed.embedUrl}
        documentLabel={`${title} — source document`}
        fullText={fullText}
      />
    );
  }
  if (isDriveFolderUrl(url)) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-6 text-center dark:bg-muted/10">
        <Folder className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          This source is a folder and can’t be shown inline. Open it to browse its contents.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-4 inline-flex items-center gap-2",
          )}
          aria-label="View folder in a new tab"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          View folder
        </a>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex items-center gap-2")}
      aria-label="View source in a new tab"
    >
      <ExternalLink className="h-4 w-4" />
      View source
    </a>
  );
}

export function SermonDetail({ sermon, highlightQuery = "" }: SermonDetailProps) {
  const drive = sermon.google_drive_url;
  const media = sermon.media_url;
  const searchableText = sermon.searchable_text?.trim() || null;
  const searchableTextSource = sermon.searchable_text_source ?? null;
  const transcriptSearch =
    highlightQuery.trim().length >= 2 ? highlightQuery.trim() : null;
  const scriptureFallbackId =
    sermon.scripture_refs && sermon.scripture_refs.length > 0
      ? "sermon-scripture-refs"
      : sermon.scripture_ref
        ? "sermon-scripture-ref"
        : undefined;

  const hasSearchableText = Boolean(searchableText);
  const searchableHeading =
    searchableTextSource === "chunks"
      ? "Searchable index text"
      : searchableTextSource === "source_document"
        ? "Full document text"
      : searchableTextSource === "record"
        ? "Searchable record"
        : "Transcript";
  const searchableDescription =
    searchableTextSource === "chunks"
      ? "This text comes from the vector search index, so keyword links can open directly to searchable content."
      : searchableTextSource === "source_document"
        ? "This text was pulled from the linked source document and is shown here so readers can search and highlight it without leaving the page."
      : searchableTextSource === "record"
        ? "This record is searchable from the archive metadata while a full transcript is being prepared."
        : null;

  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <SearchContextFallback
        query={highlightQuery}
        hasFullText={hasSearchableText}
        fallbackScrollId={scriptureFallbackId}
      />
      <div>
        <Link
          href="/search"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-4 inline-flex items-center",
          )}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to search
        </Link>
        <SermonDetailAdminControls sermonId={sermon.id} sermonTitle={sermon.title} />
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{sermon.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {sermon.external_id && (
            <span className="font-mono text-xs text-muted-foreground">{sermon.external_id}</span>
          )}
          <span className="inline-flex items-center gap-1">
            <User className="h-4 w-4" />
            {sermon.preacher}
          </span>
          {sermon.date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {sermon.date}
            </span>
          )}
          {sermon.document_type && <span>{sermon.document_type}</span>}
        </div>
        {sermon.series && (
          <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Library className="h-4 w-4 shrink-0" aria-hidden />
            <Link
              href={seriesListHref(sermon.series)}
              className="rounded-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {sermon.series}
            </Link>
          </p>
        )}
        {sermon.scripture_ref && !(sermon.scripture_refs && sermon.scripture_refs.length > 0) && (
          <p
            id="sermon-scripture-ref"
            className="scroll-mt-28 mt-2 text-sm font-medium text-foreground"
          >
            {sermon.scripture_ref}
          </p>
        )}
        {sermon.scripture_refs && sermon.scripture_refs.length > 0 && (
          <ul
            id="sermon-scripture-refs"
            className="scroll-mt-28 mt-2 list-inside list-disc text-sm text-foreground"
          >
            {sermon.scripture_refs.map((r, i) => (
              <li key={`${r.raw}-${i}`}>
                <span className="text-muted-foreground">({r.ref_kind})</span> {formatRef(r)}
                {r.raw !== formatRef(r) && <span className="text-muted-foreground"> — {r.raw}</span>}
              </li>
            ))}
          </ul>
        )}
        {sermon.keywords.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {sermon.keywords.map((k, i) => (
              <KeywordBadge key={`${k}-${i}`} name={k} />
            ))}
          </div>
        )}
      </div>

      <Separator />

      {searchableText && (
        <section className="scroll-mt-28 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{searchableHeading}</h2>
            {searchableDescription && (
              <p className="text-sm text-muted-foreground">{searchableDescription}</p>
            )}
          </div>
          <TranscriptWithSearchContext
            text={searchableText}
            query={highlightQuery}
            fallbackScrollId={scriptureFallbackId}
          />
        </section>
      )}

      {sermon.summary && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Summary</h2>
          <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{sermon.summary}</p>
        </section>
      )}

      {sermon.core_doctrine && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Core doctrine</h2>
          <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{sermon.core_doctrine}</p>
        </section>
      )}

      {(drive || (media && media !== drive)) && <Separator />}

      {drive && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Source document</h2>
          <SourceDocumentSection
            url={drive}
            title={sermon.title}
            fullText={searchableText}
            initialTranscriptSearch={transcriptSearch}
          />
        </section>
      )}

      {media && media !== drive && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Media</h2>
          <MediaBlock
            url={media}
            fullText={searchableText}
            initialTranscriptSearch={transcriptSearch}
          />
        </section>
      )}

      {!sermon.summary && !searchableText && (
        <p className="text-muted-foreground">No written content for this teaching yet.</p>
      )}
    </article>
  );
}
