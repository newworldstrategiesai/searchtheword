"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SignUpForm() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    let loadingToast: string | number | undefined;
    try {
      const supabase = createClient();
      loadingToast = toast.loading("Creating account…", { description: "Sending verification email." });

      const loginUrl = new URL(`${window.location.origin}/login`);
      if (redirectParam) {
        loginUrl.searchParams.set("redirect", redirectParam);
      }
      const redirectTo = loginUrl.toString();
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (signUpErr) {
        toast.dismiss(loadingToast);
        toast.error("Could not sign up", { description: signUpErr.message });
        setError(signUpErr.message);
        setLoading(false);
        return;
      }

      toast.success("Account created!", {
        id: loadingToast,
        description: "Please check your email for a confirmation link.",
        duration: 5000,
      });

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      if (loadingToast !== undefined) toast.dismiss(loadingToast);
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error("Sign-up unavailable", { description: message });
      setError(message);
    }
  }

  if (success) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-12">
        <Card className="text-center">
          <CardHeader>
            <CardTitle>Verify your email</CardTitle>
            <CardDescription>
              We’ve sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please check your inbox (and spam folder) and click the link to activate your account.
              Once confirmed, you will be able to sign in.
            </p>
            <Link
              href={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : "/login"}
              className={cn(buttonVariants(), "w-full mt-4")}
            >
              Go to Sign In
            </Link>
          </CardContent>
        </Card>
      </div>
    );
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
          <p className="text-sm font-medium text-foreground">Creating account…</p>
          <p className="max-w-[240px] text-center text-xs text-muted-foreground">
            Registering and sending confirmation email.
          </p>
        </div>

        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Sign up to use the sermon assistant and explore teachings.</CardDescription>
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Sign up"
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : "/login"} className="underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
