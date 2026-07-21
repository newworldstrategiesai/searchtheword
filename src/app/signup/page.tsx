import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { STATIC_OG, staticOgImage } from "@/lib/seo";
import { SignUpForm } from "@/components/signup-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const signupDescription =
  "Create an account to ask questions and search the sermon archive.";

export const metadata: Metadata = {
  title: "Sign up",
  description: signupDescription,
  alternates: {
    canonical: "/signup",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Sign up · SearchTheWord",
    description: signupDescription,
    url: "/signup",
    images: [staticOgImage(STATIC_OG.login)],
  },
  twitter: {
    title: "Sign up · SearchTheWord",
    description: signupDescription,
    images: [STATIC_OG.login],
  },
};

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/account");
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-12 text-center text-muted-foreground">Loading…</div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
