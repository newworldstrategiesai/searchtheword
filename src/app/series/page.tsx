import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Library } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { SermonCard } from "@/components/sermon-card";
import { buttonVariants } from "@/lib/button-variants";
import { getKeywordsForSermonIds } from "@/lib/keywords-batch";
import { searchSermonsServer } from "@/lib/sermons";
import { STATIC_OG, staticOgImage } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SeriesPageProps = {
  searchParams: Promise<{
    series?: string;
    page?: string;
  }>;
};

export async function generateMetadata({ searchParams }: SeriesPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const series = sp.series?.trim() ?? "";
  /** Segment only — root layout template adds " · SearchTheWord". */
  const title = series ? series : "Series";
  const description = series
    ? `Browse every sermon in “${series}” — scripture, summaries, and transcripts.`
    : "Browse sermons by teaching series.";

  return {
    title,
    description,
    alternates: {
      canonical: series ? `/series?series=${encodeURIComponent(series)}` : "/series",
    },
    openGraph: {
      title,
      description,
      url: series ? `/series?series=${encodeURIComponent(series)}` : "/series",
      images: [staticOgImage(STATIC_OG.search)],
    },
    twitter: {
      title,
      description,
      images: [STATIC_OG.search],
    },
  };
}

export default async function SeriesPage({ searchParams }: SeriesPageProps) {
  const sp = await searchParams;
  const series = sp.series?.trim() ?? "";
  if (!series) {
    redirect("/search");
  }

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  let results: Awaited<ReturnType<typeof searchSermonsServer>>["results"] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const { results: raw, total: rpcTotal } = await searchSermonsServer({
      q: "",
      page,
      limit: PAGE_SIZE,
      mode: "all",
      filterSeries: series,
    });
    results = raw;
    total = rpcTotal;
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load series";
  }

  const ids = results.map((r) => r.id);
  const kwMap = await getKeywordsForSermonIds(ids);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterQuery = { series };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 space-y-4">
        <Link
          href="/search"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 inline-flex items-center")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Search archive
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teaching series</p>
        <div className="flex flex-wrap items-start gap-3">
          <Library className="mt-1 h-8 w-8 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{series}</h1>
            <p className="text-sm text-muted-foreground">
              {total === 0 && !error
                ? "No sermons matched this series filter."
                : total === 1
                  ? "1 sermon in this series."
                  : `${total} sermons in this series.`}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!error && results.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
          Try the{" "}
          <Link href="/search" className="font-medium text-foreground underline underline-offset-4">
            full search
          </Link>{" "}
          if you expected more results.
        </p>
      )}

      {!error && results.length > 0 && (
        <>
          <ul className="space-y-4">
            {results.map((s) => (
              <li key={s.id}>
                <SermonCard sermon={s} keywords={kwMap.get(s.id) ?? []} />
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={totalPages} basePath="/series" query={filterQuery} />
        </>
      )}
    </div>
  );
}
