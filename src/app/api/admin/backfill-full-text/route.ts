import { extractGoogleDriveFileId } from "@/lib/google-drive-embed";
import {
  fetchNativeGoogleFileAsPlaintext,
  getGoogleServiceAccountEmail,
  googleDriveExportConfigured,
} from "@/lib/google-drive/export-plaintext";
import { scheduleSermonEmbeddingReindex } from "@/lib/embeddings/schedule-reindex";
import { getAdminSupabase } from "@/lib/require-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
/** Long runs when `until_done` is true (loops until no successful exports in a batch). */
export const maxDuration = 120;

const PAGE = 30;
/** Per batch: Google calls + DB writes are sequential; keep each request bounded for timeouts and quotas. */
const MAX_PER_REQUEST = 40;
/** Avoid scanning the whole table when most rows already have transcripts. */
const MAX_PAGES_PER_REQUEST = 80;

/** Stop `until_done` after this many total row outcomes (updated + error + skipped). */
const MAX_TOTAL_OUTCOMES = 2500;
/** Wall time budget inside one HTTP request for `until_done` (ms). */
const UNTIL_DONE_BUDGET_MS = 110_000;

type RowResult = { id: string; status: "updated" | "skipped" | "error"; detail?: string };

type SermonRow = {
  id: string;
  title: string;
  full_text: string | null;
  summary: string | null;
  google_drive_url: string | null;
  media_url: string | null;
};

function pickExportSourceUrl(row: SermonRow): string | null {
  const g = row.google_drive_url?.trim();
  if (g && extractGoogleDriveFileId(g)) return g;
  const m = row.media_url?.trim();
  if (m && extractGoogleDriveFileId(m)) return m;
  return null;
}

function needsBackfill(row: SermonRow, force: boolean): boolean {
  if (force) return Boolean(pickExportSourceUrl(row));
  return !row.full_text?.trim() && Boolean(pickExportSourceUrl(row));
}

async function processOneRow(
  supabase: SupabaseClient,
  row: SermonRow,
  force: boolean,
): Promise<RowResult> {
  if (!force && row.full_text?.trim()) {
    return { id: row.id, status: "skipped", detail: "full_text already set" };
  }

  const url = pickExportSourceUrl(row);
  if (!url) {
    return { id: row.id, status: "skipped", detail: "no Google Doc/Drive URL" };
  }

  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) {
    return { id: row.id, status: "skipped", detail: "URL is not a supported Google export link" };
  }

  const exported = await fetchNativeGoogleFileAsPlaintext(fileId);
  if (!exported.ok) {
    return { id: row.id, status: "error", detail: exported.error };
  }

  const { error: upErr } = await supabase
    .from("sermons")
    .update({ full_text: exported.text })
    .eq("id", row.id);

  if (upErr) {
    return { id: row.id, status: "error", detail: upErr.message };
  }

  scheduleSermonEmbeddingReindex(supabase, {
    id: row.id,
    title: row.title,
    full_text: exported.text,
    summary: row.summary,
  });

  return {
    id: row.id,
    status: "updated",
    detail: exported.name ? `from “${exported.name}”` : undefined,
  };
}

async function runScanBatch(
  supabase: SupabaseClient,
  limit: number,
  force: boolean,
): Promise<{ results: RowResult[]; updatedCount: number }> {
  const results: RowResult[] = [];
  let updatedCount = 0;
  let offset = 0;
  let pages = 0;
  let remaining = limit;

  while (remaining > 0 && pages < MAX_PAGES_PER_REQUEST) {
    const { data: page, error } = await supabase
      .from("sermons")
      .select("id,title,full_text,summary,google_drive_url,media_url")
      .order("updated_at", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (error) {
      throw new Error(error.message);
    }
    if (!page?.length) break;

    for (const raw of page) {
      if (remaining <= 0) break;
      const row = raw as SermonRow;
      if (!needsBackfill(row, force)) continue;
      remaining -= 1;
      const r = await processOneRow(supabase, row, force);
      results.push(r);
      if (r.status === "updated") updatedCount += 1;
    }

    offset += PAGE;
    pages += 1;
    if (page.length < PAGE) break;
  }

  return { results, updatedCount };
}

/** Admin-only: return whether Drive export is configured and the service account email (for sharing instructions). */
export async function GET() {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    googleDriveExportConfigured: googleDriveExportConfigured(),
    serviceAccountEmail: getGoogleServiceAccountEmail(),
    maxPerBatch: MAX_PER_REQUEST,
  });
}

/**
 * Admin-only: pull plain text from linked Google Docs / Sheets / Slides into `full_text`.
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON (service account with Drive read access; files must be shared with its client_email).
 *
 * **Batch size**: each call processes at most `limit` sermons that need export (default = max 40). That bounds
 * serverless runtime, Google Drive quota bursts, and gives incremental feedback. Use `until_done: true` to loop
 * server-side until a batch produces zero successful exports (or time/cap limits).
 */
export async function POST(request: Request) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  if (!googleDriveExportConfigured()) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_SERVICE_ACCOUNT_JSON is not set. Add a service account key JSON string to env and share Drive files with that account’s email.",
        serviceAccountEmail: getGoogleServiceAccountEmail(),
      },
      { status: 400 },
    );
  }

  let body: { limit?: number; sermonId?: string; force?: boolean; until_done?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty body */
  }

  const untilDone = Boolean(body.until_done);
  const limit = Math.min(
    Math.max(1, Number.isFinite(body.limit) ? Number(body.limit) : MAX_PER_REQUEST),
    MAX_PER_REQUEST,
  );
  const force = Boolean(body.force);
  const onlyId = typeof body.sermonId === "string" ? body.sermonId.trim() : "";

  const { supabase } = auth;

  if (onlyId) {
    const { data: row, error } = await supabase
      .from("sermons")
      .select("id,title,full_text,summary,google_drive_url,media_url")
      .eq("id", onlyId)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: "Sermon not found" }, { status: 404 });
    }
    const one = await processOneRow(supabase, row as SermonRow, force);
    return NextResponse.json({
      ok: true,
      serviceAccountEmail: getGoogleServiceAccountEmail(),
      results: [one],
    });
  }

  if (!untilDone) {
    try {
      const { results } = await runScanBatch(supabase, limit, force);
      return NextResponse.json({
        ok: true,
        serviceAccountEmail: getGoogleServiceAccountEmail(),
        results,
        note: "Run again to process more rows, pass { \"until_done\": true } to loop until idle, or pass { \"sermonId\": \"…\" } for one sermon.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const deadline = Date.now() + UNTIL_DONE_BUDGET_MS;
  const allResults: RowResult[] = [];
  let iterations = 0;
  let stoppedReason: "no_updates" | "timeout" | "max_outcomes" = "no_updates";

  try {
    while (Date.now() < deadline) {
      if (allResults.length >= MAX_TOTAL_OUTCOMES) {
        stoppedReason = "max_outcomes";
        break;
      }

      const { results, updatedCount } = await runScanBatch(supabase, MAX_PER_REQUEST, force);
      iterations += 1;
      allResults.push(...results);

      if (updatedCount === 0) {
        stoppedReason = "no_updates";
        break;
      }

      if (allResults.length >= MAX_TOTAL_OUTCOMES) {
        stoppedReason = "max_outcomes";
        break;
      }

      if (Date.now() >= deadline) {
        stoppedReason = "timeout";
        break;
      }
    }

    const totalUpdated = allResults.filter((r) => r.status === "updated").length;
    const totalErrors = allResults.filter((r) => r.status === "error").length;
    const totalSkipped = allResults.filter((r) => r.status === "skipped").length;

    const maxSample = 80;
    const resultsSample =
      allResults.length > maxSample ? allResults.slice(-maxSample) : allResults;

    return NextResponse.json({
      ok: true,
      until_done: true,
      serviceAccountEmail: getGoogleServiceAccountEmail(),
      aggregate: {
        iterations,
        total_rows: allResults.length,
        total_updated: totalUpdated,
        total_errors: totalErrors,
        total_skipped: totalSkipped,
        stopped_reason: stoppedReason,
      },
      results: resultsSample,
      results_truncated: allResults.length > resultsSample.length,
      total_result_rows: allResults.length,
      note:
        stoppedReason === "no_updates"
          ? "No further successful exports in the last batch (either nothing left, or remaining rows only error/skip). Fix sharing errors and run again if needed."
          : stoppedReason === "timeout"
            ? "Stopped early because the time budget was reached. Run again to continue."
            : `Stopped after processing ${MAX_TOTAL_OUTCOMES} row outcomes (safety cap). Run again to continue.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
