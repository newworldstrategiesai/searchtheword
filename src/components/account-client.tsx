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
      <div className="sr-only">
        <Label htmlFor="acc-username-readonly">Account email</Label>
        <Input
          id="acc-username-readonly"
          type="email"
          name="username"
          autoComplete="username"
          value={email}
          readOnly
          tabIndex={-1}
        />
      </div>
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

function extractEmails(rows: Record<string, string>[]): string[] {
  const emails = new Set<string>();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const row of rows) {
    for (const value of Object.values(row)) {
      const trimmed = String(value || "").trim().toLowerCase();
      if (emailRegex.test(trimmed)) {
        emails.add(trimmed);
      }
    }
  }
  return Array.from(emails);
}

function AdminUsersSection() {
  const [users, setUsers] = useState<ListedUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [grantAdmin, setGrantAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<"invite" | "create" | "bulk">("invite");
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkFileLoading, setBulkFileLoading] = useState(false);

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

  async function handleBulkFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFileLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    let loadToast: string | number | undefined;
    try {
      loadToast = toast.loading("Parsing spreadsheet…");
      const res = await fetch("/api/ingest/parse", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { rows?: Record<string, string>[]; error?: string };
      if (!res.ok) {
        toast.error("Could not parse file", { id: loadToast, description: data.error });
        return;
      }

      const rows = data.rows ?? [];
      const extracted = extractEmails(rows);

      if (extracted.length === 0) {
        toast.warning("No emails found", {
          id: loadToast,
          description: "We couldn't locate any email addresses in the file.",
        });
      } else {
        setBulkEmails((prev) => {
          const existing = prev.trim()
            ? prev
                .split(/[,\s\n]+/)
                .map((em) => em.trim().toLowerCase())
                .filter(Boolean)
            : [];
          const combined = Array.from(new Set([...existing, ...extracted]));
          return combined.join("\n");
        });
        toast.success(`Found ${extracted.length} email(s)!`, {
          id: loadToast,
          description: "Review and edit the list below before sending.",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Parsing failed.";
      toast.error("Upload failed", { id: loadToast, description: msg });
    } finally {
      setBulkFileLoading(false);
      e.target.value = "";
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (mode === "bulk") {
      const emails = bulkEmails
        .split(/[,\s\n]+/)
        .map((em) => em.trim().toLowerCase())
        .filter((em) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em));

      if (emails.length === 0) {
        toast.error("No valid emails found", { description: "Please enter or upload valid email addresses." });
        return;
      }

      setCreating(true);
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      const loadingToast = toast.loading(`Sending invites: 0 / ${emails.length}…`);

      for (let i = 0; i < emails.length; i++) {
        const targetEmail = emails[i];
        toast.loading(`Inviting ${targetEmail} (${i + 1}/${emails.length})…`, { id: loadingToast });
        try {
          const res = await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: targetEmail,
              mode: "invite",
              role: grantAdmin ? "admin" : undefined,
            }),
          });
          const data = (await res.json()) as { error?: string };
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
            errors.push(`${targetEmail}: ${data.error ?? "error"}`);
          }
        } catch {
          failCount++;
          errors.push(`${targetEmail}: network error`);
        }
      }

      toast.dismiss(loadingToast);
      if (successCount > 0) {
        toast.success(`Sent ${successCount} invitation(s)`);
      }
      if (failCount > 0) {
        toast.error(`Failed for ${failCount} user(s)`, {
          description: errors.slice(0, 3).join("; "),
        });
      }
      setBulkEmails("");
      setGrantAdmin(false);
      await loadUsers();
      setCreating(false);
    } else {
      setCreating(true);
      try {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            mode,
            password: mode === "create" ? password : undefined,
            role: grantAdmin ? "admin" : undefined,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          invited?: boolean;
          user?: { email?: string };
        };
        if (!res.ok) {
          toast.error(mode === "invite" ? "Could not send invite" : "Could not create user", {
            description: data.error,
          });
          return;
        }
        if (data.invited) {
          toast.success("Invitation sent", {
            description: `${data.user?.email ?? email} will get an email to set their password.`,
          });
        } else {
          toast.success("User created", { description: data.user?.email ?? email });
        }
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
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-muted-foreground" aria-hidden />
          Users
        </CardTitle>
        <CardDescription>
          Invite people by email (they set their own password), create a sign-in with a
          temporary password, or send invitations to multiple emails at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="inline-flex rounded-lg border border-border p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setMode("invite")}
              disabled={creating || bulkFileLoading}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                mode === "invite"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Invite by email
            </button>
            <button
              type="button"
              onClick={() => setMode("create")}
              disabled={creating || bulkFileLoading}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                mode === "create"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Temporary password
            </button>
            <button
              type="button"
              onClick={() => setMode("bulk")}
              disabled={creating || bulkFileLoading}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                mode === "bulk"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Bulk invite
            </button>
          </div>

          {mode === "bulk" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bulk-file">Upload spreadsheet (optional)</Label>
                <Input
                  id="bulk-file"
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={creating || bulkFileLoading}
                  onChange={(e) => void handleBulkFileUpload(e)}
                />
                <p className="text-xs text-muted-foreground">
                  Upload an Excel (.xlsx/.xls) or CSV file. We will extract all email addresses found in the sheet.
                </p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bulk-emails">Emails to invite</Label>
                <textarea
                  id="bulk-emails"
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  disabled={creating || bulkFileLoading}
                  placeholder="pastor@example.com, member1@example.com&#10;member2@example.com"
                  className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enter email addresses separated by commas, spaces, or newlines.
                </p>
              </div>
            </div>
          ) : (
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
              {mode === "create" && (
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
              )}
            </div>
          )}

          {mode === "invite" && (
            <p className="text-xs text-muted-foreground">
              We’ll email a secure link so they can set their own password. (Requires email/SMTP set
              up in Supabase.)
            </p>
          )}
          {mode === "bulk" && (
            <p className="text-xs text-muted-foreground">
              We’ll email a secure link to each valid address in the list above so they can set their own passwords.
            </p>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={grantAdmin}
              onChange={(e) => setGrantAdmin(e.target.checked)}
              disabled={creating || bulkFileLoading}
              className="size-4 rounded border-input"
            />
            Grant admin access
          </label>
          <Button type="submit" disabled={creating || bulkFileLoading}>
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "bulk" ? "Inviting…" : mode === "invite" ? "Sending…" : "Creating…"}
              </>
            ) : mode === "bulk" ? (
              "Send invites"
            ) : mode === "invite" ? (
              "Send invite"
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
