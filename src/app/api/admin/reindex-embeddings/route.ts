import { indexSermonChunks } from "@/lib/embeddings/index-sermon";
import { embeddingsConfigured } from "@/lib/embeddings/openai-embed";
import { getAdminSupabase } from "@/lib/require-admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PAGE = 25;

/**
 * Admin-only: rebuild embedding chunks for all sermons (sequential to respect OpenAI rate limits).
 */
export async function POST() {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  if (!embeddingsConfigured()) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 400 });
  }

  const { supabase } = auth;
  let offset = 0;
  let processed = 0;
  let chunkTotal = 0;
  const errors: string[] = [];

  for (;;) {
    const { data: rows, error } = await supabase
      .from("sermons")
      .select("id, title, full_text, summary")
      .order("updated_at", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!rows?.length) break;

    for (const row of rows) {
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

    offset += PAGE;
  }

  return NextResponse.json({ ok: true, sermonsProcessed: processed, chunksWritten: chunkTotal, errors });
}
