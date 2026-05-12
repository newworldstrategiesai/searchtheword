import type { Metadata } from "next";
import Link from "next/link";
import { STATIC_OG, staticOgImage } from "@/lib/seo";
import { TopicCloud } from "@/components/topic-cloud";
import { SermonCard } from "@/components/sermon-card";
import { HomeHeroSearch } from "@/components/home-hero-search";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { searchSermonsServer } from "@/lib/sermons";
import { getKeywordsForSermonIds } from "@/lib/keywords-batch";
import type { Keyword, SermonSearchRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const homeDescription =
  "Search your church’s sermon archive by scripture, topic, speaker, or keyword — faithful teaching made easy to find for worship, study, and outreach.";

export const metadata: Metadata = {
  title: { absolute: "SearchTheWord — Sermon search for your church" },
  description: homeDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SearchTheWord — Sermon search for your church",
    description: homeDescription,
    url: "/",
    images: [staticOgImage(STATIC_OG.home)],
  },
  twitter: {
    title: "SearchTheWord — Sermon search for your church",
    description: homeDescription,
    images: [STATIC_OG.home],
  },
};

export default async function HomePage() {
  let keywords: Keyword[] = [];
  try {
    const supabase = createPublicSupabaseClient();
    const { data } = await supabase.from("keywords").select("id, name").order("name").limit(40);
    keywords = (data ?? []) as Keyword[];
  } catch {
    keywords = [];
  }

  let recent: SermonSearchRow[] = [];
  let kwMap = new Map<string, string[]>();
  try {
    const { results } = await searchSermonsServer({ q: "", page: 1, limit: 6 });
    recent = results;
    const recentIds = results.map((r) => r.id);
    kwMap = await getKeywordsForSermonIds(recentIds);
  } catch {
    recent = [];
  }

  return (
    <div>
      <section className="relative overflow-x-clip border-b border-border/50 bg-gradient-to-b from-accent/30 via-background to-background px-4 py-16 dark:from-primary/10 dark:via-background md:py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' stroke='oklch(0.5 0.05 265 / 0.12)' stroke-width='0.5'%3E%3Cpath d='M30 0v60M0 30h60'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
          aria-hidden
        />
        <HomeHeroSearch />
      </section>

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-14">
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Browse</p>
              <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-foreground">
                Popular topics
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Jump in with a tag from your archive.</p>
            </div>
            <Link href="/search" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}>
              Browse all
            </Link>
          </div>
          <TopicCloud keywords={keywords} />
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Latest</p>
              <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-foreground">
                Recent sermons
              </h2>
            </div>
            <Link
              href="/search"
              className={cn(buttonVariants({ variant: "link" }), "text-muted-foreground")}
            >
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-muted-foreground">
              No sermons yet. Import a CSV or spreadsheet via the admin tools after connecting Supabase.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {recent.map((s) => (
                <SermonCard key={s.id} sermon={s} keywords={kwMap.get(s.id) ?? []} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
