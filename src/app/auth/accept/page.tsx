import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptInviteForm } from "@/components/accept-invite-form";

export const metadata: Metadata = {
  title: "Accept invitation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-12 text-center text-muted-foreground">Loading…</div>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
