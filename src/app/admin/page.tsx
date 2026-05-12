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
      toast.success("Done", {
        id: tid,
        description: `Added ${ins}, updated ${upd}.${notes ? ` ${notes}` : ""}`,
      });
      setStatus(
        `Added ${ins}, updated ${upd}. ${json.errors.length ? `Notes: ${json.errors.join("; ")}` : ""}`,
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

  async function onBackfillFullText() {
    setBackfillLoading(true);
    const tid = toast.loading("Copying from Google…", { description: "Up to 15 sermons this time." });
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
        toast.error("Google copy failed", { id: tid, description: json.error ?? res.statusText });
        return;
      }
      const r = json.results ?? [];
      const u = r.filter((x) => x.status === "updated").length;
      const e = r.filter((x) => x.status === "error").length;
      const s = r.filter((x) => x.status === "skipped").length;
      const errSample = r.find((x) => x.status === "error")?.detail;
      toast.success("Google copy finished", {
        id: tid,
        description: `Updated ${u}. Skipped ${s}. Problems: ${e}.${errSample ? ` ${errSample.slice(0, 100)}${errSample.length > 100 ? "…" : ""}` : ""} Click again if you have more.`,
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
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Church admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add sermons and keep search working.</p>
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
        </TabsList>

        <TabsContent value="upload" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload a spreadsheet</CardTitle>
              <CardDescription>Put many sermons in at once with a .csv or Excel file.</CardDescription>
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
            <CardHeader>
              <CardTitle>Add a PDF</CardTitle>
              <CardDescription>One sermon file at a time. We pull the words out of the PDF for you.</CardDescription>
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
                      placeholder="Optional — we can use the file name"
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

          <Card>
            <CardHeader>
              <CardTitle>Copy from Google Docs</CardTitle>
              <CardDescription>
                If a sermon already has a Google Doc link saved, this button copies the words into the site. Only works
                for Google Docs-style files your tech person has hooked up. Click again to do the next batch.
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
                    Working…
                  </>
                ) : (
                  "Copy from Google"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Update search</CardTitle>
              <CardDescription>
                Run this after you add or change a lot of sermons. Wait until it finishes — it can take a while.
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
                    Working…
                  </>
                ) : (
                  "Refresh search for all sermons"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="template" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>What goes in the spreadsheet</CardTitle>
              <CardDescription>Each row is one sermon. Ask a leader if you are not sure about your columns.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <span className="font-medium text-foreground">Must have:</span> title, date, speaker, and the full
                  words of the sermon (or a strong summary).
                </li>
                <li>
                  <span className="font-medium text-foreground">Nice to have:</span> series name and tags (topics people
                  might search).
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Simple weekly steps</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Gather the new sermon files or notes.</li>
                <li>Add them to your spreadsheet (or upload a PDF on the other tab).</li>
                <li>Upload the spreadsheet here.</li>
                <li>Tap “Refresh search for all sermons” and wait.</li>
                <li>Check the home page to see that the new sermon shows up.</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
