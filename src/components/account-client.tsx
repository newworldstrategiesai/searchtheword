"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AccountClientProps = {
  email: string;
  isAdmin: boolean;
};

type ListedUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: string | null;
};

function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("Password too short", { description: "Use at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signErr) {
        toast.error("Current password incorrect", { description: signErr.message });
        setLoading(false);
        return;
      }

      const { error: upErr } = await supabase.auth.updateUser({ password: next });
      if (upErr) {
        toast.error("Could not update password", { description: upErr.message });
        setLoading(false);
        return;
      }

      toast.success("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error("Something went wrong", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="acc-current">Current password</Label>
        <Input
          id="acc-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="acc-new">New password</Label>
        <Input
          id="acc-new"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={8}
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="acc-confirm">Confirm new password</Label>
        <Input
          id="acc-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating…
          </>
        ) : (
          "Update password"
        )}
      </Button>
    </form>
  );
}

function AdminUsersSection() {
  const [users, setUsers] = useState<ListedUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [grantAdmin, setGrantAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = (await res.json()) as { users?: ListedUser[]; error?: string };
      if (!res.ok) {
        setLoadError(data.error ?? "Could not load users");
        setUsers([]);
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setLoadError("Could not load users");
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          role: grantAdmin ? "admin" : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; user?: { email?: string } };
      if (!res.ok) {
        toast.error("Could not create user", { description: data.error });
        return;
      }
      toast.success("User created", { description: data.user?.email ?? email });
      setEmail("");
      setPassword("");
      setGrantAdmin(false);
      await loadUsers();
    } catch (err) {
      toast.error("Request failed", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-muted-foreground" aria-hidden />
          Users
        </CardTitle>
        <CardDescription>
          Create sign-ins for your team. New admins get access to Admin and ingest tools.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={(e) => void createUser(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={creating}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="invite-password">Temporary password</Label>
              <Input
                id="invite-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">Minimum 8 characters. Ask them to change it after first sign-in.</p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={grantAdmin}
              onChange={(e) => setGrantAdmin(e.target.checked)}
              disabled={creating}
              className="size-4 rounded border-input"
            />
            Grant admin access
          </label>
          <Button type="submit" disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create user"
            )}
          </Button>
        </form>

        <Separator />

        <div>
          <h3 className="mb-3 text-sm font-medium text-foreground">Workspace accounts</h3>
          {loadError && (
            <p className="text-sm text-destructive">
              {loadError}
              <button
                type="button"
                onClick={() => void loadUsers()}
                className="ml-2 underline underline-offset-4"
              >
                Retry
              </button>
            </p>
          )}
          {users === null && !loadError && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading…
            </p>
          )}
          {users && users.length === 0 && !loadError && (
            <p className="text-sm text-muted-foreground">No users returned.</p>
          )}
          {users && users.length > 0 && (
            <ul className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2 text-sm dark:bg-muted/10">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <span className="min-w-0 truncate font-medium">{u.email || "—"}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {u.role === "admin" ? (
                      <Badge variant="secondary">Admin</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Member</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AccountClient({ email, isAdmin }: AccountClientProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Signed out");
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error("Could not sign out", {
        description: err instanceof Error ? err.message : undefined,
      });
      setSigningOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
        <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">Your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Update your password or sign out. {isAdmin && "As an admin, you can add users below."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-muted-foreground" aria-hidden />
            Session
          </CardTitle>
          <CardDescription>Signed in as {email || "—"}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <Badge variant="secondary" className="gap-1">
              <Shield className="h-3 w-3" aria-hidden />
              Admin
            </Badge>
          ) : (
            <Badge variant="outline">Member</Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden />
            )}
            Sign out
          </Button>
          {isAdmin && (
            <Link href="/admin" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Open admin
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change password</CardTitle>
          <CardDescription>Confirm your current password, then choose a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm email={email} />
        </CardContent>
      </Card>

      {isAdmin && <AdminUsersSection />}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/" className="underline underline-offset-4">
          Back to home
        </Link>
      </p>
    </div>
  );
}
