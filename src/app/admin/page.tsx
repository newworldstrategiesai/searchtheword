"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { IngestProgressEvent } from "@/lib/ingest/process";
import { consumeIngestNdjsonStream } from "@/lib/ingest-client";
import { fetchReindexEmbeddingsBatched } from "@/lib/embeddings/reindex-batched-fetch";
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
    };
  }
  return {
    headline: "Working on rows…",
    totalRows: event.totalRows,
    currentRow: event.dataRow,
    sheetRow: event.sheetRow,
    title: event.title,
    detail: event.detail,
  };
}

function maybeToastImportProgress(tid: string | number, event: IngestProgressEvent) {
  if (event.kind === "phase") {
    toast.loading("Uploading…", { id: tid, description: event.message });
    return;
  }
  if (event.kind === "parsed") {
    toast.loading("Uploading…", { id: tid, description: `Working on ${event.rowCount} rows…` });
    return;
  }
  const { dataRow, totalRows } = event;
  if (dataRow === 1 || dataRow % 6 === 0 || dataRow === totalRows) {
    toast.loading("Uploading…", { id: tid, description: `Row ${dataRow} of ${totalRows}` });
  }
}

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreacher, setPdfPreacher] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfDate, setPdfDate] = useState("");
  const [pdfSeries, setPdfSeries] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importLive, setImportLive] = useState<ImportLiveState | null>(null);
  const [reindexLoading, setReindexLoading] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [dedupeLoading, setDedupeLoading] = useState(false);
  const [driveSetup, setDriveSetup] = useState<{
    googleDriveExportConfigured: boolean;
    serviceAccountEmail: string | null;
    maxPerBatch: number;
  } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setIsAuthenticated(user?.app_metadata?.role === "admin");
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/backfill-full-text", { credentials: "same-origin" });
        const j = (await res.json()) as {
          googleDriveExportConfigured?: boolean;
          serviceAccountEmail?: string | null;
          maxPerBatch?: number;
        };
        if (!cancelled && res.ok) {
          setDriveSetup({
            googleDriveExportConfigured: Boolean(j.googleDriveExportConfigured),
            serviceAccountEmail: j.serviceAccountEmail ?? null,
            maxPerBatch: typeof j.maxPerBatch === "number" ? j.maxPerBatch : 40,
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  // Show access denied if not admin
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">You can’t open this page</h1>
          <p className="text-lg text-muted-foreground">Ask a leader for the admin login, or go back home.</p>
          <div className="space-x-4">
            <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}>
              Home
            </Link>
            <Link href="/login" className={cn(buttonVariants(), "inline-flex")}>
              Log in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Pick a file first", { description: "Use a spreadsheet (.csv or Excel)." });
      setStatus("Pick a spreadsheet file.");
      return;
    }
    setLoading(true);
    setStatus(null);
    setImportLive({ headline: "Sending file…", detail: file.name });
    const form = new FormData();
    form.append("file", file);

    const tid = toast.loading("Uploading…", { description: file.name });

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = json.error ?? `Upload failed (${res.status})`;
        toast.error("Upload didn’t work", { id: tid, description: msg });
        setStatus(msg);
        return;
      }

      if (!res.body) {
        toast.error("Upload didn’t work", { id: tid, description: "No answer from the server." });
        setStatus("No answer from the server.");
        return;
      }

      const json = await consumeIngestNdjsonStream(res.body, (event) => {
        setImportLive((prev) => mergeImportLive(prev, event));
        maybeToastImportProgress(tid, event);
      });

      const ins = json.inserted ?? 0;
      const upd = json.updated ?? 0;
      const notes = json.errors.length ? `Notes: ${json.errors.join("; ")}` : "";
      const reindexHint =
        ins + upd > 0
          ? " Open Advanced → Refresh search for all sermons so Ask/search includes this import."
          : "";
      toast.success("Done", {
        id: tid,
        description: `Added ${ins}, updated ${upd}.${notes ? ` ${notes}` : ""}${reindexHint}`,
      });
      setStatus(
        `Added ${ins}, updated ${upd}. ${json.errors.length ? `Notes: ${json.errors.join("; ")}` : ""}${reindexHint}`,
      );
      setFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not complete import.";
      toast.error("Upload didn’t work", { id: tid, description: message });
      setStatus(message);
    } finally {
      setLoading(false);
      setImportLive(null);
    }
  }

  async function onPdfUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile) {
      toast.error("Pick a PDF first");
      setPdfStatus("Choose a PDF file.");
      return;
    }
    if (!pdfPreacher.trim()) {
      toast.error("Who spoke?", { description: "Type the speaker’s name." });
      setPdfStatus("Type the speaker’s name.");
      return;
    }

    const tid = toast.loading("Adding PDF…");
    setPdfLoading(true);
    try {
      const body = new FormData();
      body.set("file", pdfFile);
      body.set("preacher", pdfPreacher.trim());
      if (pdfTitle.trim()) body.set("title", pdfTitle.trim());
      if (pdfDate.trim()) body.set("date", pdfDate.trim());
      if (pdfSeries.trim()) body.set("series", pdfSeries.trim());

      const res = await fetch("/api/admin/upload-pdf", {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        inserted?: boolean;
        id?: string;
        charactersExtracted?: number;
      };

      if (!res.ok) {
        toast.error("PDF didn’t work", { id: tid, description: json.error ?? res.statusText });
        setPdfStatus(json.error ?? "Something went wrong.");
        return;
      }

      const excerpt = `${json.inserted === false ? "Updated" : "Added"} — pulled ${json.charactersExtracted ?? 0} characters from the PDF.`;
      toast.success("PDF added", {
        id: tid,
        description: excerpt,
        action:
          json.id != null
            ? {
                label: "See in list",
                onClick: () => {
                  window.location.href = `/admin/sermons#${json.id}`;
                },
              }
            : undefined,
      });
      setPdfStatus(`${excerpt} You can edit details in All sermons.`);
      setPdfFile(null);
      const input = document.getElementById("pdf") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error("PDF didn’t work", { id: tid, description: message });
      setPdfStatus(message);
    } finally {
      setPdfLoading(false);
    }
  }

  async function signOut() {
    const t = toast.loading("Signing out…");
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out", { id: t, description: "Going to the home page." });
    window.location.href = "/";
  }


  async function onDedupeSermons(apply: boolean) {
    setDedupeLoading(true);
    const tid = toast.loading(apply ? "Removing duplicates…" : "Scanning for duplicates…");
    try {
      const res = await fetch("/api/admin/dedupe-sermons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ dryRun: !apply }),
      });
      const json = (await res.json()) as {
        error?: string;
        totalSermons?: number;
        duplicateGroups?: number;
        toDelete?: number;
        toKeep?: number;
        deleted?: number;
        sampleGroups?: { keeperTitle: string; removeCount: number }[];
      };
      if (!res.ok) {
        toast.error("Duplicate scan failed", { id: tid, description: json.error ?? res.statusText });
        return;
      }
      if (apply) {
        toast.success("Duplicates removed", {
          id: tid,
          description: `Deleted ${json.deleted ?? 0} rows. ${json.toKeep ?? 0} sermons remain.`,
        });
        return;
      }
      const sample =
        json.sampleGroups?.slice(0, 3).map((g) => `"${g.keeperTitle}" (×${g.removeCount + 1})`).join(", ") ?? "";
      toast.success("Duplicate scan complete", {
        id: tid,
        description: `${json.totalSermons ?? 0} total · ${json.duplicateGroups ?? 0} duplicate groups · would remove ${json.toDelete ?? 0}.${sample ? ` e.g. ${sample}` : ""}`,
      });
    } catch (e) {
      toast.error("Duplicate scan failed", {
        id: tid,
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setDedupeLoading(false);
    }
  }

  async function onReindexEmbeddings() {
    setReindexLoading(true);
    const tid = toast.loading("Updating search…", { description: "This may take a few minutes." });
    try {
      const result = await fetchReindexEmbeddingsBatched({
        onProgress: ({ totalSermons }) => {
          toast.loading("Updating search…", {
            id: tid,
            description: `Done so far: ${totalSermons} sermons`,
          });
        },
      });
      if (!result.ok) {
        toast.error("Search update failed", { id: tid, description: result.error });
        return;
      }
      const errNote =
        result.errors.length > 0
          ? ` Some sermons had a problem — check with your tech person if search looks wrong.`
          : "";
      toast.success("Search updated", {
        id: tid,
        description: `Finished ${result.totalSermons} sermons.${errNote}`,
      });
    } catch (e) {
      toast.error("Search update failed", {
        id: tid,
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setReindexLoading(false);
    }
  }

  async function onBackfillFullText(untilDone: boolean) {
    setBackfillLoading(true);
    const limit = driveSetup?.maxPerBatch ?? 40;
    const tid = toast.loading(
      untilDone ? "Copying from Google (all batches)…" : "Copying from Google…",
      {
        description: untilDone
          ? "Runs multiple batches until no more succeed, or time limit."
          : `Up to ${limit} rows this run.`,
      },
    );
    try {
      const res = await fetch("/api/admin/backfill-full-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(untilDone ? { until_done: true } : { limit }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        until_done?: boolean;
        aggregate?: {
          iterations: number;
          total_updated: number;
          total_errors: number;
          total_skipped: number;
          stopped_reason: string;
        };
        results?: Array<{ id: string; status: string; detail?: string }>;
        note?: string;
      };
      if (!res.ok) {
        toast.error("Google copy failed", { id: tid, description: json.error ?? res.statusText });
        return;
      }
      if (json.until_done && json.aggregate) {
        const a = json.aggregate;
        toast.success("Google copy finished", {
          id: tid,
          description: `${a.total_updated} updated · ${a.total_skipped} skipped · ${a.total_errors} errors · ${a.iterations} batch(es) · ${a.stopped_reason}.${json.note ? ` ${json.note}` : ""}`,
        });
        return;
      }
      const r = json.results ?? [];
      const u = r.filter((x) => x.status === "updated").length;
      const e = r.filter((x) => x.status === "error").length;
      const s = r.filter((x) => x.status === "skipped").length;
      const errSample = r.find((x) => x.status === "error")?.detail;
      toast.success("Google copy finished", {
        id: tid,
        description: `Updated ${u}. Skipped ${s}. Problems: ${e}.${errSample ? ` ${errSample.slice(0, 100)}${errSample.length > 100 ? "…" : ""}` : ""} Run again or use Copy all if you have more.`,
      });
    } catch (e) {
      toast.error("Google copy failed", {
        id: tid,
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setBackfillLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Church admin</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Home
          </Link>
          <Link href="/admin/sermons" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Sermon list
          </Link>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="upload">Add sermons</TabsTrigger>
          <TabsTrigger value="template">Spreadsheet help</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Spreadsheet</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sheet">File</Label>
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
                      Working…
                    </>
                  ) : (
                    "Upload"
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
                        {importLive.totalRows != null && importLive.currentRow != null && importLive.totalRows > 0 && (
                          <>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-primary transition-[width] duration-200 ease-out"
                                style={{
                                  width: `${Math.min(100, (importLive.currentRow / importLive.totalRows) * 100)}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Row {importLive.currentRow} of {importLive.totalRows}
                            </p>
                          </>
                        )}
                        {importLive.title && (
                          <p className="truncate text-sm text-foreground" title={importLive.title}>
                            Now: {importLive.title}
                          </p>
                        )}
                        {importLive.detail && (
                          <p className="text-sm text-muted-foreground">{importLive.detail}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {status && <p className="text-sm text-muted-foreground">{status}</p>}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => void onPdfUpload(e)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="pdf-preacher">Who spoke? (required)</Label>
                    <Input
                      id="pdf-preacher"
                      name="preacher"
                      type="text"
                      autoComplete="name"
                      placeholder="Name"
                      value={pdfPreacher}
                      onChange={(e) => setPdfPreacher(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pdf-title">Title</Label>
                    <Input
                      id="pdf-title"
                      name="title"
                      type="text"
                      placeholder="Optional"
                      value={pdfTitle}
                      onChange={(e) => setPdfTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pdf-date">Date</Label>
                    <Input id="pdf-date" name="date" type="date" value={pdfDate} onChange={(e) => setPdfDate(e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="pdf-series">Series</Label>
                    <Input
                      id="pdf-series"
                      name="series"
                      type="text"
                      placeholder="Optional"
                      value={pdfSeries}
                      onChange={(e) => setPdfSeries(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdf">PDF</Label>
                  <Input
                    id="pdf"
                    name="pdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={pdfLoading} className="gap-2">
                  {pdfLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Working…
                    </>
                  ) : (
                    "Add PDF"
                  )}
                </Button>
                {pdfStatus && <p className="text-sm text-muted-foreground">{pdfStatus}</p>}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="template" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Columns & steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                <li>Each row = one sermon.</li>
                <li>Need: title, date, speaker, sermon text (or summary).</li>
                <li>Optional: series, topics, keywords.</li>
              </ul>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Add rows (or use a PDF on Add sermons).</li>
                <li>Upload the file on Add sermons.</li>
                <li>
                  On <span className="font-medium text-foreground">Advanced</span>: refresh search, then check the site.
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tools</CardTitle>
              <CardDescription>Run after bulk imports or when Drive text is missing.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={dedupeLoading || backfillLoading || reindexLoading}
                className="gap-2"
                onClick={() => void onDedupeSermons(false)}
              >
                {dedupeLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Working…
                  </>
                ) : (
                  "Scan for duplicates"
                )}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={dedupeLoading || backfillLoading || reindexLoading}
                className="gap-2"
                onClick={() => void onDedupeSermons(true)}
              >
                Remove duplicates
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={backfillLoading}
                className="gap-2"
                onClick={() => void onBackfillFullText(false)}
              >
                {backfillLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Working…
                  </>
                ) : (
                  "Copy from Google"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={backfillLoading}
                className="gap-2"
                onClick={() => void onBackfillFullText(true)}
              >
                Copy all (until idle)
              </Button>
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
                    Working…
                  </>
                ) : (
                  "Refresh search for all sermons"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What “Copy from Google” does</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                The site stores each sermon as a database row. Some rows have a Google Drive link but an empty{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">full_text</code> field. The
                backfill job finds those rows and asks Google’s API (using a{" "}
                <strong className="text-foreground">service account</strong>, not anyone’s personal login) to export
                readable text from native Google files (Docs, Sheets, Slides) and, where supported, PDFs on Drive. Each
                single run processes up to{" "}
                <strong className="text-foreground">{driveSetup?.maxPerBatch ?? 40}</strong> sermons that still need
                text (capped so one web request stays within hosting time limits and Google rate limits).{" "}
                <strong className="text-foreground">Copy all (until idle)</strong> runs many batches in one request:
                it keeps going until a full batch produces zero successful exports (nothing left to pull, or only
                errors/skips left), or it hits a time budget (~2 minutes) or a safety cap on total rows — then you can
                run it again to continue.
              </p>
              <p>
                <strong className="text-foreground">“File not found” or repeated errors</strong> usually means the file
                or its parent folder was never shared with the service account. Google only returns content the account
                can read. Share the Doc/Sheet/Slide (or the whole folder / Shared drive) with this email as{" "}
                <em>Viewer</em> (or higher):
              </p>
              {driveSetup?.serviceAccountEmail ? (
                <p className="rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground dark:bg-muted/30">
                  {driveSetup.serviceAccountEmail}
                </p>
              ) : (
                <p>
                  The server could not read a service-account email (check{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">GOOGLE_SERVICE_ACCOUNT_JSON</code>{" "}
                  is set and valid). Your tech person can open the JSON and copy the{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">client_email</code> field — that
                  is the address to share with.
                </p>
              )}
              <p>
                Rows that show <strong className="text-foreground">updated</strong> in logs are files the service
                account could read (export succeeded). Rows that show <strong className="text-foreground">error</strong>{" "}
                are often the same few file IDs until those files are shared. PDFs uploaded directly on the Add sermons
                tab do not need Drive sharing for search text; Drive PDFs still need access if you rely on this job.
              </p>
              <p className="text-xs">
                Google Drive export configured:{" "}
                <span className="font-medium text-foreground">
                  {driveSetup?.googleDriveExportConfigured ? "yes" : "unknown / no"}
                </span>
                .
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What “Refresh search for all sermons” does</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                Ask / search uses embeddings over chunks of sermon text. After you import or edit many rows, chunk rows
                in <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">sermon_chunks</code> need to
                be rebuilt and re-embedded. This button calls the admin reindex API in batches until every sermon is
                covered. It requires <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">OPENAI_API_KEY</code>{" "}
                (or your configured embedding provider) on the server. It can take several minutes on large libraries;
                leave the tab open until the toast reports completion.
              </p>
              <p>
                If some sermons fail, the toast may mention errors — often missing body text, oversized content, or API
                limits. Fix the underlying sermon row and run refresh again.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Environment checklist (operators)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <code className="rounded bg-muted px-1 text-xs text-foreground">OPENAI_API_KEY</code> — required for
                  embeddings / reindex.
                </li>
                <li>
                  <code className="rounded bg-muted px-1 text-xs text-foreground">GOOGLE_SERVICE_ACCOUNT_JSON</code> —
                  required for Drive export / backfill; must be the full JSON key for the account you share files with.
                </li>
                <li>Supabase service role + URL — used by ingest and admin routes.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spreadsheet column aliases (ingest)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto text-sm text-muted-foreground">
              <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-foreground">
                    <th className="py-2 pr-3 font-medium">Concept</th>
                    <th className="py-2 pr-3 font-medium">Example column names</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Stable ID (updates, not duplicates)</td>
                    <td className="py-2 font-mono text-[11px] text-foreground/90">
                      id, external_id, sermon_id, record_id
                    </td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Title</td>
                    <td className="py-2 font-mono text-[11px] text-foreground/90">sermon_title, title</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Speaker</td>
                    <td className="py-2 font-mono text-[11px] text-foreground/90">speaker, preacher</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Date</td>
                    <td className="py-2 font-mono text-[11px] text-foreground/90">date, date_delivered</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Series</td>
                    <td className="py-2 font-mono text-[11px] text-foreground/90">series</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Summary</td>
                    <td className="py-2 font-mono text-[11px] text-foreground/90">summary</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Body / transcript</td>
                    <td className="py-2 font-mono text-[11px] text-foreground/90">full_text</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Topics & keyword labels</td>
                    <td className="py-2 font-mono text-[11px] text-foreground/90">topics, keywords</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-3">Media or Drive link</td>
                    <td className="py-2 font-mono text-[11px] text-foreground/90">
                      media_url, google_drive_link (also sets stored Drive URL)
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-xs">
                Exact matching is defined in ingest code; if a column is ignored, try one of the aliases above or ask
                your developer to add a new header synonym.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
