import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountClient } from "@/components/account-client";
import { isAdmin } from "@/lib/auth";
import { STATIC_OG, staticOgImage } from "@/lib/seo";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const description = "Manage your sign-in, password, and (for administrators) workspace users.";

export const metadata: Metadata = {
  title: "Account",
  description,
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
  openGraph: {
    title: "Account · SearchTheWord",
    description,
    url: "/account",
    images: [staticOgImage(STATIC_OG.login)],
  },
  twitter: {
    title: "Account · SearchTheWord",
    description,
    images: [STATIC_OG.login],
  },
};

export default async function AccountPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account");
  }

  return (
    <AccountClient
      email={user.email ?? ""}
      isAdmin={isAdmin(user)}
    />
  );
}
