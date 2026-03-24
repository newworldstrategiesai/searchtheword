/**
 * Canonical site URL for Open Graph, canonical links, and JSON-LD.
 * Set NEXT_PUBLIC_APP_URL in production (e.g. https://searchtheword.vercel.app).
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://searchtheword.vercel.app";
}

export function getMetadataBase(): URL {
  return new URL(getSiteUrl());
}

/** Dimensions for PNGs in public/og/ (see npm run generate:og). */
export const STATIC_OG_DIMENSIONS = { width: 1200, height: 630 } as const;

/** Pre-generated static OG/Twitter images under public/og/ */
export const STATIC_OG = {
  home: "/og/home.png",
  search: "/og/search.png",
  ask: "/og/ask.png",
  login: "/og/login.png",
  admin: "/og/admin.png",
  adminSermons: "/og/admin-sermons.png",
  sermon: "/og/sermon-sample.png",
} as const;

export function staticOgImage(path: (typeof STATIC_OG)[keyof typeof STATIC_OG]) {
  return {
    url: path,
    width: STATIC_OG_DIMENSIONS.width,
    height: STATIC_OG_DIMENSIONS.height,
  };
}

/** Shared keywords for church / ministry discovery SEO */
export const CHURCH_SEO_KEYWORDS = [
  "sermon search",
  "church sermon archive",
  "Bible teaching",
  "scripture search",
  "sermon transcripts",
  "faith",
  "worship",
  "ministry",
  "Christian teaching",
] as const;
