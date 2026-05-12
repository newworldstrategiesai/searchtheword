/**
 * After sign-in, we use a full-page navigation so Supabase cookies are visible on the
 * next request (client router transitions can load before the session is readable).
 *
 * Prefer NEXT_PUBLIC_APP_URL in production (e.g. https://www.searchthemessage.com).
 */
export function getPostLoginOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://www.searchthemessage.com";
}

/** Paths only admins may open (align with src/proxy.ts protected routes). */
export function isAdminOnlyRedirectPath(path: string): boolean {
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      const u = new URL(path);
      const p = u.pathname;
      return (
        p === "/admin" ||
        p.startsWith("/admin/") ||
        p.startsWith("/api/admin") ||
        p === "/api/ingest"
      );
    }
    const p = path.startsWith("/") ? path : `/${path}`;
    return (
      p === "/admin" ||
      p.startsWith("/admin/") ||
      p.startsWith("/api/admin") ||
      p === "/api/ingest"
    );
  } catch {
    return false;
  }
}

export function buildPostLoginHref(options: {
  isAdmin: boolean;
  redirectParam: string | null;
}): string {
  const base = getPostLoginOrigin();
  if (options.isAdmin) return `${base}/admin`;

  const r = options.redirectParam?.trim();
  if (r && !isAdminOnlyRedirectPath(r)) {
    if (r.startsWith("http://") || r.startsWith("https://")) return r;
    const path = r.startsWith("/") ? r : `/${r}`;
    return `${base}${path}`;
  }
  return `${base}/account`;
}
