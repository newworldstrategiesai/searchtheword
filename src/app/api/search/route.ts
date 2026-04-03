import type { SearchMode } from "@/lib/types";
import { searchSermonsServer } from "@/lib/sermons";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MODES: SearchMode[] = ["all", "scripture", "topic", "fulltext"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const modeRaw = (searchParams.get("mode") ?? "all").toLowerCase();
  const mode: SearchMode = MODES.includes(modeRaw as SearchMode) ? (modeRaw as SearchMode) : "all";
  const filterSeries = searchParams.get("series") ?? undefined;
  const filterDocumentType = searchParams.get("document_type") ?? undefined;
  const filterPreacher = searchParams.get("preacher") ?? undefined;

  try {
    const { results, total } = await searchSermonsServer({
      q,
      page,
      limit,
      mode,
      filterSeries: filterSeries ?? undefined,
      filterDocumentType: filterDocumentType ?? undefined,
      filterPreacher: filterPreacher ?? undefined,
    });

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
