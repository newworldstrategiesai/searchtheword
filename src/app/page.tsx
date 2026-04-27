import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Flag, Radio, Search } from "lucide-react";
import { STATIC_OG, staticOgImage } from "@/lib/seo";
import { TopicCloud } from "@/components/topic-cloud";
import { SermonCard } from "@/components/sermon-card";
import { HomeHeroSearch } from "@/components/home-hero-search";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { searchSermonsServer } from "@/lib/sermons";
import { getKeywordsForSermonIds } from "@/lib/keywords-batch";
import { getProfessorTotoBlogPosts } from "@/lib/blog-feed";
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

const portals = [
  {
    title: "First Harvest Ministries",
    eyebrow: "Ministry library",
    href: "/search?preacher=Pastor%20Vaughn",
    description:
      "Sabbath services, Bible studies, free teachings, scriptures, topics, and Pastor Vaughn's searchable archive.",
    icon: BookOpen,
    action: "Enter ministry archive",
  },
  {
    title: "Professor Toto",
    eyebrow: "Americana portal",
    href: "/search?q=Professor%20Toto",
    description:
      "A distinct space for Professor Toto content, patriotic teaching, Tuesday night messages, and related topics.",
    icon: Flag,
    action: "Enter Professor Toto",
  },
  {
    title: "The Apostolic Assemblies",
    eyebrow: "Assemblies",
    href: "/search?q=Apostolic%20Assemblies",
    description:
      "A focused doorway for Apostolic Assemblies content, doctrine, studies, and connected ministry resources.",
    icon: Radio,
    action: "Enter assemblies",
  },
] as const;

const quickLinks = [
  {
    label: "Watch Professor Toto live Tuesdays at 7 Central",
    href: "https://www.youtube.com/@RealProfessorToto",
  },
  {
    label: "Watch First Harvest Ministries on YouTube",
    href: "https://www.youtube.com/@FirstHarvestMinistries",
  },
  {
    label: "Read the latest Professor Toto blog",
    href: "https://professortoto.substack.com",
  },
] as const;

export default async function HomePage() {
  const blogPostsPromise = getProfessorTotoBlogPosts(3);

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

  const blogPosts = await blogPostsPromise;

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border/50 bg-gradient-to-b from-accent/30 via-background to-background px-4 py-16 dark:from-primary/10 dark:via-background md:py-24">
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
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Three doors</p>
            <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Choose where you want to enter
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Separate entry points keep each ministry stream clear while sharing the same searchable archive.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {portals.map(({ title, eyebrow, href, description, icon: Icon, action }) => (
              <Link
                key={title}
                href={href}
                className="group flex min-h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:bg-card/70"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary dark:bg-primary/20">
                    {eyebrow}
                  </span>
                  <Icon className="h-5 w-5 text-muted-foreground transition group-hover:text-primary" aria-hidden />
                </div>
                <h3 className="font-heading text-xl font-semibold tracking-tight text-foreground">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {action}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-muted/25 p-4 dark:bg-muted/10">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Search className="h-4 w-4 text-primary" aria-hidden />
              Fast links requested from the client call
            </div>
            <div className="flex flex-wrap gap-2">
              {quickLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-background/80")}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Commentary feed</p>
              <h2 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-foreground">
                Professor Toto commentary
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                External Substack articles from Professor Toto, shown separately from Pastor Vaughn’s sermon archive.
              </p>
            </div>
            <a
              href="https://professortoto.substack.com"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
            >
              Subscribe
            </a>
          </div>
          {blogPosts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              Professor Toto commentary could not be loaded right now. Use the Subscribe link above to open Substack.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {blogPosts.map((post) => (
                <a
                  key={post.href}
                  href={post.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md dark:bg-card/70"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    }) : "Latest"}
                  </p>
                  <h3 className="font-heading mt-2 line-clamp-2 text-xl font-semibold tracking-tight text-foreground">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                      {post.excerpt}
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}
        </section>

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
