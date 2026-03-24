"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setStatus("Choose a CSV or Excel file.");
      return;
    }
    setLoading(true);
    setStatus(null);
    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/ingest", {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const json = (await res.json()) as { inserted?: number; errors?: string[]; error?: string };
    setLoading(false);
    if (!res.ok) {
      setStatus(json.error ?? "Upload failed");
      return;
    }
    const ins = json.inserted ?? 0;
    const upd = (json as { updated?: number }).updated ?? 0;
    setStatus(
      `Inserted ${ins}, updated ${upd}. ${(json.errors ?? []).length ? `Notes: ${json.errors!.join("; ")}` : ""}`,
    );
    setFile(null);
  }

  function onPdfPlaceholder(e: React.FormEvent) {
    e.preventDefault();
    if (!pdfFile) {
      setPdfStatus("Choose a PDF file.");
      return;
    }
    setPdfStatus(
      "PDF text extraction is not wired yet. Export transcript text from the PDF, then use the spreadsheet template (Title, Date, Series, Transcript, Category/Keywords) and upload as .xlsx or .csv.",
    );
    setPdfFile(null);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
          <h1 className="text-2xl font-bold">Upload &amp; edit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Import sermons, follow the weekly SOP, and use the template fields below.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Home
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
                <Button type="submit" disabled={loading}>
                  {loading ? "Uploading…" : "Upload & import"}
                </Button>
                {status && <p className="text-sm text-muted-foreground">{status}</p>}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PDF upload (weekly)</CardTitle>
              <CardDescription>
                Target: about <strong>3 sermons per week</strong> as PDFs. Store originals for records; use
                the template below so transcripts and metadata are searchable.
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
        </TabsContent>

        <TabsContent value="template" className="mt-6 space-y-6">
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

          <Card>
            <CardHeader>
              <CardTitle>Standard operating procedure (SOP)</CardTitle>
              <CardDescription>Weekly rhythm for the team</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Receive PDFs</strong> (target ~3 per week) and file them in your
                  church&apos;s document store.
                </li>
                <li>
                  <strong className="text-foreground">Extract transcript</strong> from PDF or recording; paste into the
                  template row.
                </li>
                <li>
                  <strong className="text-foreground">Add metadata</strong>: title, date, series, category / keyword tags
                  (hashtags).
                </li>
                <li>
                  <strong className="text-foreground">Upload</strong> the CSV/XLSX via this admin screen to refresh the
                  searchable database.
                </li>
                <li>
                  <strong className="text-foreground">Verify</strong> on the home page and Search that new sermons appear
                  and snippets look correct.
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
