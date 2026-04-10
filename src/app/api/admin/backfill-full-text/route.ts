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

const PAGE = 30;
const MAX_PER_REQUEST = 40;
/** Avoid scanning the whole table when most rows already have transcripts. */
const MAX_PAGES_PER_REQUEST = 80;

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

/**
 * Admin-only: pull plain text from linked Google Docs / Sheets / Slides into `full_text`.
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON (service account with Drive read access; files must be shared with its client_email).
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

  let body: { limit?: number; sermonId?: string; force?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty body */
  }

  const limit = Math.min(
    Math.max(1, Number.isFinite(body.limit) ? Number(body.limit) : 15),
    MAX_PER_REQUEST,
  );
  const force = Boolean(body.force);
  const onlyId = typeof body.sermonId === "string" ? body.sermonId.trim() : "";

  const { supabase } = auth;
  const results: Array<{
    id: string;
    status: "updated" | "skipped" | "error";
    detail?: string;
  }> = [];

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
    await processOne(supabase, row as SermonRow, force, results);
    return NextResponse.json({
      ok: true,
      serviceAccountEmail: getGoogleServiceAccountEmail(),
      results,
    });
  }

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!page?.length) break;

    for (const raw of page) {
      if (remaining <= 0) break;
      const row = raw as SermonRow;
      if (!needsBackfill(row, force)) continue;
      remaining -= 1;
      await processOne(supabase, row, force, results);
    }

    offset += PAGE;
    pages += 1;
    if (page.length < PAGE) break;
  }

  return NextResponse.json({
    ok: true,
    serviceAccountEmail: getGoogleServiceAccountEmail(),
    results,
    note: "Run again to process more rows, or pass { \"sermonId\": \"…\" } for one sermon.",
  });
}

async function processOne(
  supabase: SupabaseClient,
  row: SermonRow,
  force: boolean,
  results: Array<{ id: string; status: "updated" | "skipped" | "error"; detail?: string }>,
) {
  if (!force && row.full_text?.trim()) {
    results.push({ id: row.id, status: "skipped", detail: "full_text already set" });
    return;
  }

  const url = pickExportSourceUrl(row);
  if (!url) {
    results.push({ id: row.id, status: "skipped", detail: "no Google Doc/Drive URL" });
    return;
  }

  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) {
    results.push({ id: row.id, status: "skipped", detail: "URL is not a supported Google export link" });
    return;
  }

  const exported = await fetchNativeGoogleFileAsPlaintext(fileId);
  if (!exported.ok) {
    results.push({ id: row.id, status: "error", detail: exported.error });
    return;
  }

  const { error: upErr } = await supabase
    .from("sermons")
    .update({ full_text: exported.text })
    .eq("id", row.id);

  if (upErr) {
    results.push({ id: row.id, status: "error", detail: upErr.message });
    return;
  }

  scheduleSermonEmbeddingReindex(supabase, {
    id: row.id,
    title: row.title,
    full_text: exported.text,
    summary: row.summary,
  });

  results.push({
    id: row.id,
    status: "updated",
    detail: exported.name ? `from “${exported.name}”` : undefined,
  });
}
