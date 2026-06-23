import { buildIndexPlan, type SermonIndexStatusRow } from "@/lib/embeddings/index-plan";
import { indexSermonChunks } from "@/lib/embeddings/index-sermon";
import { embeddingsConfigured } from "@/lib/embeddings/openai-embed";
import { getAdminSupabase } from "@/lib/require-admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Avoid single invocations dying halfway through large catalogs (Vercel / OpenAI latency). */
export const maxDuration = 300;

const PAGE = 25;

/** No `take` in body → process entire catalog in one invocation (may still timeout on huge lists). */
const NO_BATCH_LIMIT = 1_000_000_000;

function parseSkip(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function parseTake(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(500, Math.max(1, Math.floor(n)));
}

type ReindexBody = { skip?: unknown; take?: unknown; onlyChanged?: unknown };

/**
 * Targeted reindex: only sermons that are new (no chunks) or changed (edited
 * since last indexed). Pages over a stable id list from admin_sermon_index_status
 * so repeated batched requests don't re-embed up-to-date sermons.
 */
async function reindexChangedOnly(
  supabase: SupabaseClient,
  skipInitial: number,
  takeLimit: number,
): Promise<Response> {
  const { data, error } = await supabase.rpc("admin_sermon_index_status");
  if (error) {
    const hint = /function .* does not exist|could not find/i.test(error.message)
      ? " Run database migration 006_sermon_index_status.sql, then try again."
      : "";
    return NextResponse.json({ error: `${error.message}.${hint}` }, { status: 500 });
  }

  const plan = buildIndexPlan((data ?? []) as SermonIndexStatusRow[]);
  const ids = plan.changedOrNewIds;
  const batchIds = ids.slice(skipInitial, skipInitial + takeLimit);

  let processed = 0;
  let chunkTotal = 0;
  const errors: string[] = [];

  if (batchIds.length > 0) {
    const { data: rows, error: rowErr } = await supabase
      .from("sermons")
      .select("id, title, full_text, summary")
      .in("id", batchIds);
    if (rowErr) {
      return NextResponse.json({ error: rowErr.message }, { status: 500 });
    }
    for (const row of rows ?? []) {
      const r = await indexSermonChunks(supabase, {
        id: row.id as string,
        title: String(row.title ?? ""),
        full_text: (row.full_text as string | null) ?? null,
        summary: (row.summary as string | null) ?? null,
      });
      processed += 1;
      if (r.ok) chunkTotal += r.chunks;
      else if (r.error) errors.push(`${row.id}: ${r.error}`);
    }
  }

  const nextSkip = skipInitial + batchIds.length;
  const partial = nextSkip < ids.length;
  return NextResponse.json({
    ok: true,
    done: !partial,
    partial,
    nextSkip: partial ? nextSkip : null,
    sermonsProcessed: processed,
    chunksWritten: chunkTotal,
    totalTargets: ids.length,
    errors,
  });
}

/**
 * Admin-only: rebuild embedding chunks for all sermons (sequential to respect OpenAI rate limits).
 *
 * Optional JSON body: `{ "skip": number, "take": number }` — process at most `take` sermons after
 * skipping the first `skip` rows (same `updated_at desc` order). Response includes `partial` and
 * `nextSkip` when more sermons remain.
 */
export async function POST(request: Request) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  if (!embeddingsConfigured()) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 400 });
  }

  let body: ReindexBody = {};
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      body = (await request.json()) as ReindexBody;
    }
  } catch {
    body = {};
  }

  const skipInitial = parseSkip(body.skip);
  const takeLimit = parseTake(body.take) ?? NO_BATCH_LIMIT;
  const onlyChanged = body.onlyChanged === true;

  const { supabase } = auth;

  if (onlyChanged) {
    return reindexChangedOnly(supabase, skipInitial, takeLimit);
  }

  let dbOffset = 0;
  /** Index of each row in `updated_at desc` ordering (resets each request; skip fast-forwards). */
  let ordinal = 0;
  let processed = 0;
  let chunkTotal = 0;
  const errors: string[] = [];

  for (;;) {
    const { data: rows, error } = await supabase
      .from("sermons")
      .select("id, title, full_text, summary")
      .order("updated_at", { ascending: false })
      .range(dbOffset, dbOffset + PAGE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!rows?.length) {
      return NextResponse.json({
        ok: true,
        done: true,
        partial: false,
        nextSkip: null,
        sermonsProcessed: processed,
        chunksWritten: chunkTotal,
        errors,
      });
    }

    for (const row of rows) {
      if (ordinal < skipInitial) {
        ordinal += 1;
        continue;
      }
      if (processed >= takeLimit) {
        return NextResponse.json({
          ok: true,
          done: false,
          partial: true,
          nextSkip: ordinal,
          sermonsProcessed: processed,
          chunksWritten: chunkTotal,
          errors,
        });
      }

      const r = await indexSermonChunks(supabase, {
        id: row.id as string,
        title: String(row.title ?? ""),
        full_text: (row.full_text as string | null) ?? null,
        summary: (row.summary as string | null) ?? null,
      });
      processed += 1;
      ordinal += 1;
      if (r.ok) chunkTotal += r.chunks;
      else if (r.error) errors.push(`${row.id}: ${r.error}`);
    }

    dbOffset += PAGE;
  }
}
