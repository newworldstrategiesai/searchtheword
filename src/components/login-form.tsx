"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let loadingToast: string | number | undefined;
    try {
      const supabase = createClient();
      loadingToast = toast.loading("Logging in…", { description: "Checking your credentials." });

      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });

      if (signErr) {
        toast.dismiss(loadingToast);
        toast.error("Could not sign in", { description: signErr.message });
        setError(signErr.message);
        setLoading(false);
        return;
      }

      toast.success("Signed in", {
        id: loadingToast,
        description: "Loading your workspace…",
        duration: 2800,
      });

      router.push(redirect);
      router.refresh();
    } catch (err) {
      if (loadingToast !== undefined) toast.dismiss(loadingToast);
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error("Sign-in unavailable", { description: message });
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
      <Card className={cn("relative overflow-hidden", loading && "ring-2 ring-primary/20")}>
        <div
          className={cn(
            "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm transition-opacity",
            loading ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={!loading}
          aria-live="polite"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-medium text-foreground">Logging in…</p>
          <p className="max-w-[240px] text-center text-xs text-muted-foreground">
            Securing your session and redirecting.
          </p>
        </div>

        <CardHeader>
          <CardTitle>Admin sign in</CardTitle>
          <CardDescription>
            Sign in with a Supabase user that has <code className="text-xs">app_metadata.role = admin</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/" className="underline underline-offset-4">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
