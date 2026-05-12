import type { Metadata } from "next";
import { SermonCard } from "@/components/sermon-card";
import { STATIC_OG, staticOgImage } from "@/lib/seo";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { SearchFilters } from "@/components/search-filters";
import { SearchModeTabs } from "@/components/search-mode-tabs";
import { searchSermonsServer } from "@/lib/sermons";
import { getKeywordsForSermonIds } from "@/lib/keywords-batch";
import { filterSermonResults } from "@/lib/filter-sermons";
import type { SearchMode } from "@/lib/types";
import { createPublicSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const searchDescription =
  "Filter sermons by scripture, topic, speaker, series, and date — full-text and tag-aware search built for church libraries.";

export const metadata: Metadata = {
  title: "Search archive",
  description: searchDescription,
  alternates: {
    canonical: "/search",
  },
  openGraph: {
    title: "Search the sermon archive · SearchTheWord",
    description: searchDescription,
    url: "/search",
    images: [staticOgImage(STATIC_OG.search)],
  },
  twitter: {
    title: "Search the sermon archive · SearchTheWord",
    description: searchDescription,
    images: [STATIC_OG.search],
  },
};

const PAGE_SIZE = 20;

const MODES: SearchMode[] = ["all", "scripture", "topic", "fulltext"];

async function getSearchableTextForSermonIds(ids: string[]) {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const supabase = createPublicSupabaseClient();
  const { data } = await supabase
    .from("sermon_chunks")
    .select("sermon_id, chunk_index, content")
    .in("sermon_id", ids)
    .order("sermon_id", { ascending: true })
    .order("chunk_index", { ascending: true });

  for (const row of data ?? []) {
    const sermonId = String((row as { sermon_id?: string }).sermon_id ?? "");
    const content = String((row as { content?: string }).content ?? "").trim();
    if (!sermonId || !content) continue;
    map.set(sermonId, [map.get(sermonId), content].filter(Boolean).join("\n\n"));
  }

  return map;
}

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    page?: string;
    preacher?: string;
    series?: string;
    document_type?: string;
    mode?: string;
    from?: string;
    to?: string;
  }>;
};

function parseMode(raw: string | undefined): SearchMode {
  const m = (raw ?? "all").toLowerCase();
  return MODES.includes(m as SearchMode) ? (m as SearchMode) : "all";
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const preacher = sp.preacher ?? "";
  const series = sp.series ?? "";
  const documentType = sp.document_type ?? "";
  const mode = parseMode(sp.mode);
  const from = sp.from ?? "";
  const to = sp.to ?? "";
  const hasDateFilters = !!(from || to);

  let results: Awaited<ReturnType<typeof searchSermonsServer>>["results"] = [];
  let total = 0;
  let error: string | null = null;

  try {
    const fetchLimit = hasDateFilters ? 500 : PAGE_SIZE;
    const fetchPage = hasDateFilters ? 1 : page;
    const { results: raw, total: rpcTotal } = await searchSermonsServer({
      q,
      page: fetchPage,
      limit: fetchLimit,
      mode,
      filterPreacher: preacher || undefined,
      filterSeries: series || undefined,
      filterDocumentType: documentType || undefined,
    });
    const filtered = filterSermonResults(raw, { from, to });
    if (hasDateFilters) {
      total = filtered.length;
      const start = (page - 1) * PAGE_SIZE;
      results = filtered.slice(start, start + PAGE_SIZE);
    } else {
      results = filtered;
      total = rpcTotal;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Search failed";
  }

  const ids = results.map((r) => r.id);
  const [kwMap, searchableTextMap] = await Promise.all([
    getKeywordsForSermonIds(ids),
    getSearchableTextForSermonIds(ids),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterQuery = {
    q: q || undefined,
    mode: mode !== "all" ? mode : undefined,
    preacher: preacher || undefined,
    series: series || undefined,
    document_type: documentType || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Layer 1 · Searchable database</p>
        <h1 className="text-3xl font-bold tracking-tight">Search archive</h1>
        <p className="text-base text-muted-foreground">
          Use the search bar in the header. Choose a mode to focus on scripture references, topics, or full
          text.
        </p>
        <SearchModeTabs
          q={q}
          active={mode}
          extraParams={{
            ...(preacher && { preacher }),
            ...(series && { series }),
            ...(documentType && { document_type: documentType }),
            ...(from && { from }),
            ...(to && { to }),
          }}
        />
        {hasDateFilters && (
          <p className="text-base text-muted-foreground">
            Date filters are applied to the result set after search. For very large archives, narrow your
            query as well.
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-6">
          {!error && (
            <p className="text-base text-muted-foreground" aria-live="polite">
              {total} result{total === 1 ? "" : "s"}
              {q.trim() ? (
                <>
                  {" "}
                  for <span className="font-medium text-foreground">&quot;{q.trim()}&quot;</span>
                </>
              ) : null}
            </p>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-base text-destructive">
              {error}
              <span className="mt-1 block text-muted-foreground">
                Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
                <code className="rounded bg-muted px-1">.env.local</code> (local) or Vercel → Environment
                Variables, then <strong>redeploy</strong> — Next bakes <code className="rounded bg-muted px-1">NEXT_PUBLIC_*</code> at{" "}
                <strong>build</strong> time. Ensure DB has run <code className="rounded bg-muted px-1">supabase/setup_complete.sql</code>.
              </span>
            </div>
          )}
          {!error && results.length === 0 && <EmptyState query={q} />}
          {!error && results.length > 0 && (
            <ul className="space-y-4">
              {results.map((s) => (
                <li key={s.id}>
                  <SermonCard
                    sermon={s}
                    keywords={kwMap.get(s.id) ?? []}
                    searchableText={searchableTextMap.get(s.id) ?? null}
                    highlightQuery={q.trim() ? q : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
          {!error && results.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              basePath="/search"
              query={{
                ...filterQuery,
                page: undefined,
              }}
            />
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SearchFilters
            q={q}
            mode={mode}
            preacher={preacher}
            series={series}
            documentType={documentType}
            from={from}
            to={to}
          />
        </aside>
      </div>
    </div>
  );
}
