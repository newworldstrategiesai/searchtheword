import type { Metadata } from "next";
import { Suspense } from "react";
import { STATIC_OG, staticOgImage } from "@/lib/seo";
import { LoginForm } from "@/components/login-form";

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

export default function LoginPage() {
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
