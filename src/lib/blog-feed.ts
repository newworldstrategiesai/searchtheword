import { XMLParser } from "fast-xml-parser";

export type BlogPost = {
  title: string;
  href: string;
  publishedAt: string | null;
  excerpt: string;
};

const SUBSTACK_FEED_URL = "https://professortoto.substack.com/feed";

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getProfessorTotoBlogPosts(limit = 3): Promise<BlogPost[]> {
  try {
    const res = await fetch(SUBSTACK_FEED_URL, {
      next: { revalidate: 60 * 30 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      processEntities: true,
    });
    const parsed = parser.parse(xml) as {
      rss?: {
        channel?: {
          item?: Array<{
            title?: string;
            link?: string;
            pubDate?: string;
            description?: string;
            "content:encoded"?: string;
          }> | {
            title?: string;
            link?: string;
            pubDate?: string;
            description?: string;
            "content:encoded"?: string;
          };
        };
      };
    };

    return asArray(parsed.rss?.channel?.item)
      .slice(0, limit)
      .map((item) => ({
        title: String(item.title ?? "Untitled post"),
        href: String(item.link ?? SUBSTACK_FEED_URL),
        publishedAt: item.pubDate ? String(item.pubDate) : null,
        excerpt: stripHtml(item.description || item["content:encoded"]).slice(0, 220),
      }));
  } catch {
    return [];
  }
}
