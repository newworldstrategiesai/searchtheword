"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Phase = "checking" | "ready" | "invalid";

/**
 * Landing page for invite (and recovery) email links. Supabase redirects here
 * with a session in the URL; once the browser client establishes it, the user
 * chooses a password and is signed in.
 */
export function AcceptInviteForm() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient>(() => createClient());

  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let resolved = false;
    const markReady = (session: { user?: { email?: string | null } } | null) => {
      if (session && !resolved) {
        resolved = true;
        setEmail(session.user?.email ?? null);
        setPhase("ready");
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => markReady(session));

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        markReady(data.session);
      } else {
        // Token may still be parsing from the URL; give it a moment, then give up.
        window.setTimeout(() => {
          if (!resolved) setPhase("invalid");
        }, 2500);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password too short", { description: "Use at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error("Could not set password", { description: error.message });
        setSaving(false);
        return;
      }
      toast.success("Password set — you’re signed in");
      router.push("/account");
      router.refresh();
    } catch (err) {
      toast.error("Something went wrong", {
        description: err instanceof Error ? err.message : "Try again.",
      });
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Set your password</CardTitle>
          <CardDescription>
            {phase === "ready" && email
              ? `Choose a password for ${email}.`
              : "Finish setting up your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {phase === "checking" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Checking your invitation…
            </p>
          )}

          {phase === "invalid" && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                This invitation link is invalid or has expired. Ask your church admin to send a new
                invite, or sign in if you already set a password.
              </p>
              <Link href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
                Go to sign in
              </Link>
            </div>
          )}

          {phase === "ready" && (
            <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-new-password">New password</Label>
                <Input
                  id="invite-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-confirm-password">Confirm password</Label>
                <Input
                  id="invite-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  disabled={saving}
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Set password & sign in"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
