import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { mapSearchRpcRow } from "@/lib/search";
import type { SearchMode } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MODES: SearchMode[] = ["all", "scripture", "topic", "fulltext"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;
  const modeRaw = (searchParams.get("mode") ?? "all").toLowerCase();
  const mode: SearchMode = MODES.includes(modeRaw as SearchMode) ? (modeRaw as SearchMode) : "all";
  const filterSeries = searchParams.get("series") ?? null;
  const filterDocumentType = searchParams.get("document_type") ?? null;
  const filterPreacher = searchParams.get("preacher") ?? null;

  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase.rpc("search_sermons", {
      search_query: q,
      page_offset: offset,
      page_limit: limit,
      search_mode: mode,
      filter_series: filterSeries?.trim() || null,
      filter_document_type: filterDocumentType?.trim() || null,
      filter_preacher: filterPreacher?.trim() || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const total = rows.length ? Number(rows[0]!.total_count ?? 0) : 0;
    const results = rows.map(mapSearchRpcRow);

    return NextResponse.json({
      results,
      total,
      page,
      limit,
      mode,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
