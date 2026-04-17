"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { IngestProgressEvent } from "@/lib/ingest/process";
import { consumeIngestNdjsonStream } from "@/lib/ingest-client";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ImportLiveState = {
  headline: string;
  totalRows?: number;
  currentRow?: number;
  sheetRow?: number;
  title?: string;
  detail?: string;
};

function mergeImportLive(prev: ImportLiveState | null, event: IngestProgressEvent): ImportLiveState {
  if (event.kind === "phase") {
    return {
      headline: event.message,
      totalRows: prev?.totalRows,
      currentRow: prev?.currentRow,
      sheetRow: prev?.sheetRow,
      title: prev?.title,
      detail: prev?.detail,
    };
  }
  if (event.kind === "parsed") {
    return {
      headline: `Found ${event.rowCount} data row${event.rowCount === 1 ? "" : "s"} (${event.fileKind.toUpperCase()})`,
      totalRows: event.rowCount,
      currentRow: 0,
      sheetRow: prev?.sheetRow,
      title: prev?.title,
      detail: prev?.detail,
    };
  }
  return {
    headline: "Importing rows",
    totalRows: event.totalRows,
    currentRow: event.dataRow,
    sheetRow: event.sheetRow,
    title: event.title,
    detail: event.detail,
  };
}

function maybeToastImportProgress(tid: string | number, event: IngestProgressEvent) {
  if (event.kind === "phase") {
    toast.loading("Importing…", { id: tid, description: event.message });
    return;
  }
  if (event.kind === "parsed") {
    toast.loading("Importing…", { id: tid, description: `Processing ${event.rowCount} rows…` });
    return;
  }
  const { dataRow, totalRows, detail } = event;
  if (dataRow === 1 || dataRow % 6 === 0 || dataRow === totalRows) {
    toast.loading("Importing…", { id: tid, description: `Row ${dataRow}/${totalRows} · ${detail}` });
  }
}

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importLive, setImportLive] = useState<ImportLiveState | null>(null);
  const [reindexLoading, setReindexLoading] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user?.app_metadata?.role === "admin") {
          setIsAuthenticated(true);
          return true; // Authenticated, no need to show UI
        } else {
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setIsAuthenticated(false);
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, []);

  // Show loading state while checking auth
  if (!authChecked) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium text-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show error state if not authenticated
  if (authChecked && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-lg text-muted-foreground mb-6">
            You must be an administrator to access this page.
          </p>
          <div className="space-x-4">
            <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to Home
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "default", size: "sm" })}>
              Admin Login
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            If you believe this is an error, please contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  // If authenticated, show admin interface
  if (isAuthenticated) {
    // Rest of the component logic remains the same...
    return (
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">Upload &amp; edit</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Import sermons, follow weekly SOP, and use template fields below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Home
            </Link>
            <Link href="/admin/sermons" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              All sermons
            </Link>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="upload">Upload documents</TabsTrigger>
            <TabsTrigger value="template">Template &amp; SOP</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Import sermons (CSV / Excel)</CardTitle>
                <CardDescription>
                  Primary path for bulk import. Maps columns to your sermon database (title, preacher, date,
                  scripture, summary, full text, keywords, series, etc.).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sheet">Spreadsheet file</Label>
                    <Input
                      id="sheet"
                      name="file"
                      type="file"
                      accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="gap-2">
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Importing…
                      </>
                    ) : (
                      "Upload & import"
                    )}
                  </Button>

                  {loading && importLive && (
                    <div
                      className="rounded-lg border border-border bg-muted/40 p-4 dark:bg-muted/20"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="flex items-start gap-3">
                        <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" aria-hidden />
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-sm font-medium text-foreground">{importLive.headline}</p>
                          {importLive.totalRows != null && importLive.currentRow != null && (
                            <div className="h-full bg-primary transition-[width] duration-200 ease-out" style={{ width: `${Math.min(100, (importLive.currentRow / importLive.totalRows) * 100)}%` }} />
                            <p className="text-xs text-muted-foreground">
                              Data row {importLive.currentRow} of {importLive.totalRows}
                              {importLive.sheetRow != null ? ` · spreadsheet row ${importLive.sheetRow}` : ""}
                              {importLive.title && ` · ${importLive.title}`}
                              {importLive.detail && ` · ${importLive.detail}`}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {status && <p className="text-sm text-muted-foreground">{status}</p>}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Semantic search &amp; Ask (embeddings)</CardTitle>
              <CardDescription>
                Rebuild vector chunks for all sermons so Search (mode &quot;All&quot;) can blend semantic matches
                and Ask can retrieve transcript excerpts. Requires{" "}
                <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> on server.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="secondary"
                disabled={reindexLoading}
                className="gap-2"
                onClick={() => void onReindexEmbeddings()}
              >
                {reindexLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Reindexing…
                  </>
                ) : (
                  "Reindex all embeddings"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backfill transcript from Google Drive</CardTitle>
              <CardDescription>
                For sermons that have a <code className="rounded bg-muted px-1">Source document URL</code> or Drive{" "}
                <code className="rounded bg-muted px-1">media_url</code> but empty{" "}
                <code className="rounded bg-muted px-1">full_text</code>, pull plain text from{" "}
                <strong>native</strong> Google Docs, Sheets, or Slides. PDFs and other file types cannot be exported as
                text automatically — paste a transcript manually or convert to Google Docs first. Set{" "}
                <code className="rounded bg-muted px-1">GOOGLE_SERVICE_ACCOUNT_JSON</code> on the server and share each
                file (or folder) with that service account&apos;s <code className="rounded bg-muted px-1">client_email</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                type="button"
                variant="secondary"
                disabled={backfillLoading}
                className="gap-2"
                onClick={() => void onBackfillFullText()}
              >
                {backfillLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Backfilling…
                  </>
                ) : (
                  "Backfill full_text from Google (batch)"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Processes up to 15 sermons per click. After backfill, run &quot;Reindex all embeddings&quot; if you use
                semantic search (or wait — each updated row triggers a background reindex when OpenAI is configured).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PDF upload (weekly)</CardTitle>
              <CardDescription>
                Target: about <strong>3 sermons per week</strong> as PDFs. Store originals for records; use
                template below so transcripts and metadata are searchable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onPdfPlaceholder} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pdf">PDF file</Label>
                  <Input
                    id="pdf"
                    name="pdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button type="submit" variant="secondary">
                  Queue PDF (preview)
                </Button>
                {pdfStatus && <p className="text-sm text-muted-foreground">{pdfStatus}</p>}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sermon row template</CardTitle>
              <CardDescription>
                Each row is one sermon. Align spreadsheet columns with these fields (hashtags / keywords help
                search).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 font-semibold">Field</th>
                      <th className="px-3 py-2 font-semibold">Required</th>
                      <th className="px-3 py-2 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-3 py-2 font-medium">Title</td>
                      <td className="px-3 py-2 text-muted-foreground">Yes</td>
                      <td className="px-3 py-2 text-muted-foreground">Sermon title as shown</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Date</td>
                      <td className="px-3 py-2 text-muted-foreground">Yes</td>
                      <td className="px-3 py-2 text-muted-foreground">Service date (ISO or spreadsheet date)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Series</td>
                      <td className="px-3 py-2 text-muted-foreground">Recommended</td>
                      <td className="px-3 py-2 text-muted-foreground">Series name or season</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Transcript</td>
                      <td className="px-3 py-2 text-muted-foreground">Yes for search</td>
                      <td className="px-3 py-2 text-muted-foreground">Full text for FTS / snippets</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium">Category / Keywords</td>
                      <td className="px-3 py-2 text-muted-foreground">Recommended</td>
                      <td className="px-3 py-2 text-muted-foreground">Subject covered (comma-separated or hashtags)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Your ingest pipeline may use column names like <code className="rounded bg-muted px-1">sermon_title</code>,{" "}
                <code className="rounded bg-muted px-1">keywords</code>, <code className="rounded bg-muted px-1">full_text</code> — see
                import mapping in code.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("No file selected", { description: "Choose a CSV or Excel file to import." });
      setStatus("Choose a CSV or Excel file.");
      return;
    }
    setLoading(true);
    setStatus(null);
    setImportLive({ headline: "Sending file to server…", detail: file.name });
    const form = new FormData();
    form.append("file", file);

    const tid = toast.loading("Importing…", { description: file.name });

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = json.error ?? `Upload failed (${res.status})`;
        toast.error("Import failed", { id: tid, description: msg });
        setStatus(msg);
        return;
      }

      if (!res.body) {
        toast.error("Import failed", { id: tid, description: "No response body from server." });
        setStatus("No response from server.");
        return;
      }

      const json = await consumeIngestNdjsonStream(res.body, (event) => {
        setImportLive((prev) => mergeImportLive(prev, event));
        maybeToastImportProgress(tid, event);
      });

      const ins = json.inserted ?? 0;
      const upd = json.updated ?? 0;
      const notes = json.errors.length ? `Notes: ${json.errors.join("; ")}` : "";
      toast.success("Import complete", {
        id: tid,
        description: `Inserted ${ins}, updated ${upd}.${notes ? ` ${notes}` : ""}`,
      });
      setStatus(
        `Inserted ${ins}, updated ${upd}. ${json.errors.length ? `Notes: ${json.errors.join("; ")}` : ""}`,
      );
      setFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not complete import.";
      toast.error("Import failed", { id: tid, description: message });
      setStatus(message);
    } finally {
      setLoading(false);
      setImportLive(null);
    }
  }

  function onPdfPlaceholder(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile) {
      toast.error("No PDF selected", { description: "Choose a PDF file first." });
      setPdfStatus("Choose a PDF file.");
      return;
    }
    const msg =
      "PDF text extraction is not wired yet. Export transcript text from PDF, then use spreadsheet template (Title, Date, Series, Transcript, Category/Keywords) and upload as .xlsx or .csv.";
    toast.info("PDF queued (preview)", { description: msg });
    setPdfStatus(msg);
    setPdfFile(null);
  }

  async function signOut() {
    const t = toast.loading("Signing out…");
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out", { id: t, description: "Redirecting to home." });
    window.location.href = "/";
  }

  async function onReindexEmbeddings() {
    setReindexLoading(true);
    const tid = toast.loading("Reindexing embeddings…", {
      description: "This may take several minutes.",
    });
    try {
      const res = await fetch("/api/admin/reindex-embeddings", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        sermonsProcessed?: number;
        chunksWritten?: number;
        errors?: string[];
      };
      if (!res.ok) {
        toast.error("Reindex failed", { id: tid, description: json.error ?? res.statusText });
        return;
      }
      const errNote = json.errors?.length ? ` Warnings: ${json.errors.slice(0, 3).join("; ")}` : "";
      toast.success("Embeddings reindexed", {
        id: tid,
        description: `Processed ${json.sermonsProcessed ?? 0} sermons, ${json.chunksWritten ?? 0} chunks.${errNote}`,
      });
    } catch (e) {
      toast.error("Reindex failed", {
        id: tid,
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setReindexLoading(false);
    }
  }

  async function onBackfillFullText() {
    setBackfillLoading(true);
    const tid = toast.loading("Pulling text from Google…", {
      description: "Exports native Docs/Sheets/Slides via Drive API (up to 15 per run).",
    });
    try {
      const res = await fetch("/api/admin/backfill-full-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ limit: 15 }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        results?: Array<{ id: string; status: string; detail?: string }>;
        serviceAccountEmail?: string | null;
        note?: string;
      };
      if (!res.ok) {
        toast.error("Backfill failed", { id: tid, description: json.error ?? res.statusText });
        return;
      }
      const r = json.results ?? [];
      const u = r.filter((x) => x.status === "updated").length;
      const e = r.filter((x) => x.status === "error").length;
      const s = r.filter((x) => x.status === "skipped").length;
      const errSample = r.find((x) => x.status === "error")?.detail;
      toast.success("Backfill batch finished", {
        id: tid,
        description: `Updated ${u}, skipped ${s}, errors ${e}.${errSample ? ` First error: ${errSample.slice(0, 120)}${errSample.length > 120 ? "…" : ""}` : ""} Run again for more rows.`,
      });
    } catch (e) {
      toast.error("Backfill failed", {
        id: tid,
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setBackfillLoading(false);
    }
  }
}
