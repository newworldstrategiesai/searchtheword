import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Max time to wait on Supabase auth before treating the session as unverifiable.
 * When Supabase is unreachable, `getUser()` otherwise hangs ~19s and then throws
 * (the auth client receives an HTML 5xx page and fails to JSON.parse it), which
 * crashes the middleware for every protected route. Fail closed, but fast.
 */
const AUTH_TIMEOUT_MS = 4000;

type SessionCheck = { user: { app_metadata?: { role?: string } } | null; degraded: boolean };

/**
 * Resolve the current user, but never hang or throw: on timeout or any error
 * (e.g. Supabase outage), return `degraded: true` so callers fail closed.
 */
async function getUserSafely(
  supabase: ReturnType<typeof createServerClient>,
): Promise<SessionCheck> {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), AUTH_TIMEOUT_MS),
      ),
    ]);
    if (result === "timeout") {
      return { user: null, degraded: true };
    }
    return { user: result.data?.user ?? null, degraded: false };
  } catch {
    return { user: null, degraded: true };
  }
}

export async function proxy(request: NextRequest) {
  const isAdminPage = request.nextUrl.pathname.startsWith("/admin");
  const isAdminApi = request.nextUrl.pathname.startsWith("/api/admin");
  const isIngestApi = request.nextUrl.pathname === "/api/ingest";
  const isAccountPage = request.nextUrl.pathname.startsWith("/account");
  const isProtectedPath = isAdminPage || isAdminApi || isIngestApi || isAccountPage;

  if (!isProtectedPath) {
    return NextResponse.next({ request });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  const hasSupabaseSessionCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") || name.toLowerCase().includes("supabase"));

  if (!hasSupabaseSessionCookie) {
    if (isAdminApi || isIngestApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const { user, degraded } = await getUserSafely(supabase);

  /**
   * Auth backend unreachable: don't grant access (fail closed) but signal a
   * transient condition rather than an auth failure. APIs get 503 so callers
   * can retry; pages bounce to /login as before.
   */
  if (degraded) {
    if (isAdminApi || isIngestApi) {
      return NextResponse.json(
        { error: "Authentication service temporarily unavailable. Please try again shortly." },
        { status: 503 },
      );
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAdminPage || isAdminApi || isIngestApi) {
    if (!user || user.app_metadata?.role !== "admin") {
      if (isAdminApi || isIngestApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isAccountPage) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/api/admin/:path*", "/api/ingest"],
};
