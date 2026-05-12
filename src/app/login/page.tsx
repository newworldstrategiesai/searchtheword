import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { STATIC_OG, staticOgImage } from "@/lib/seo";
import { LoginForm } from "@/components/login-form";
import { isAdmin } from "@/lib/auth";
import { isAdminOnlyRedirectPath } from "@/lib/post-login";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const loginDescription =
  "Secure sign-in for church staff managing sermon imports and the searchable message archive.";

export const metadata: Metadata = {
  title: "Sign in",
  description: loginDescription,
  alternates: {
    canonical: "/login",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Sign in · SearchTheWord",
    description: loginDescription,
    url: "/login",
    images: [staticOgImage(STATIC_OG.login)],
  },
  twitter: {
    title: "Sign in · SearchTheWord",
    description: loginDescription,
    images: [STATIC_OG.login],
  },
};

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const rawRedirect = sp.redirect;
  const redirectParam = typeof rawRedirect === "string" ? rawRedirect : undefined;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (isAdmin(user)) {
      redirect("/admin");
    }
    const r = redirectParam?.trim();
    if (r?.startsWith("/") && !r.startsWith("//") && !isAdminOnlyRedirectPath(r)) {
      redirect(r);
    }
    redirect("/account");
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-12 text-center text-muted-foreground">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
