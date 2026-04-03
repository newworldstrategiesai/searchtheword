import { mapSearchRpcRow } from "@/lib/search";
import type { SermonSearchRow } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const RRF_K = 60;
const FTS_SCAN_LIMIT = 500;
const SEM_LIMIT = 120;

export function vectorToPgLiteral(vec: number[]): string {
  return `[${vec.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;
}

type FtsRow = Record<string, unknown>;

function rrfMerge(
  ftsOrdered: { id: string; row: FtsRow }[],
  semOrdered: { id: string; similarity: number }[],
): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  ftsOrdered.forEach((r, i) => {
    scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1));
  });
  semOrdered.forEach((r, i) => {
    scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1));
  });
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

function leftSnippet(text: string | null, max: number): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * Hybrid FTS + vector RRF. Returns null if there are no semantic hits (use classic paginated FTS).
 */
export async function searchSermonsHybrid(params: {
  supabase: SupabaseClient;
  q: string;
  page: number;
  limit: number;
  filterSeries?: string;
  filterDocumentType?: string;
  filterPreacher?: string;
  queryEmbedding: number[];
}): Promise<{ results: SermonSearchRow[]; total: number } | null> {
  const {
    supabase,
    q,
    page,
    limit,
    filterSeries,
    filterDocumentType,
    filterPreacher,
    queryEmbedding,
  } = params;

  const offset = (page - 1) * limit;
  const vecLiteral = vectorToPgLiteral(queryEmbedding);

  const [ftsRes, semRes] = await Promise.all([
    supabase.rpc("search_sermons", {
      search_query: q,
      page_offset: 0,
      page_limit: FTS_SCAN_LIMIT,
      search_mode: "all",
      filter_series: filterSeries?.trim() || null,
      filter_document_type: filterDocumentType?.trim() || null,
      filter_preacher: filterPreacher?.trim() || null,
    }),
    supabase.rpc("semantic_top_sermons", {
      query_embedding: vecLiteral,
      result_limit: SEM_LIMIT,
      filter_series: filterSeries?.trim() || null,
      filter_document_type: filterDocumentType?.trim() || null,
      filter_preacher: filterPreacher?.trim() || null,
    }),
  ]);

  if (ftsRes.error) {
    throw new Error(ftsRes.error.message);
  }

  const ftsRows = (ftsRes.data ?? []) as FtsRow[];
  const ftsOrdered = ftsRows.map((row) => ({
    id: String(row.id),
    row,
  }));

  if (semRes.error) {
    return null;
  }

  const semData = (semRes.data ?? []) as { sermon_id: string; similarity: number }[];
  const semOrdered = semData.map((r) => ({
    id: String(r.sermon_id),
    similarity: Number(r.similarity),
  }));

  if (semOrdered.length === 0) {
    return null;
  }

  const merged = rrfMerge(ftsOrdered, semOrdered);
  const total = merged.length;
  const pageSlice = merged.slice(offset, offset + limit);
  const ftsById = new Map(ftsOrdered.map((x) => [x.id, x.row]));

  const missing = pageSlice.map((m) => m.id).filter((id) => !ftsById.has(id));
  const sermonById = new Map<string, Record<string, unknown>>();
  if (missing.length) {
    const { data: sermons, error: serErr } = await supabase
      .from("sermons")
      .select("*")
      .in("id", missing);
    if (serErr) throw new Error(serErr.message);
    for (const s of sermons ?? []) {
      sermonById.set(String((s as { id: string }).id), s as Record<string, unknown>);
    }
  }

  const results: SermonSearchRow[] = pageSlice
    .map(({ id, score }) => {
      const fts = ftsById.get(id);
      if (fts) {
        const row = mapSearchRpcRow(fts);
        return {
          ...row,
          rank: score,
          total_count: total,
        };
      }
      const s = sermonById.get(id);
      if (!s) {
        return null;
      }
      return {
        id: String(s.id),
        title: String(s.title ?? ""),
        preacher: String(s.preacher ?? ""),
        date: s.date ? String(s.date) : null,
        scripture_ref: s.scripture_ref != null ? String(s.scripture_ref) : null,
        summary: s.summary != null ? String(s.summary) : null,
        full_text: s.full_text != null ? String(s.full_text) : null,
        media_url: s.media_url != null ? String(s.media_url) : null,
        created_at: String(s.created_at),
        updated_at: String(s.updated_at),
        external_id: s.external_id != null ? String(s.external_id) : null,
        series: s.series != null ? String(s.series) : null,
        document_type: s.document_type != null ? String(s.document_type) : null,
        core_doctrine: s.core_doctrine != null ? String(s.core_doctrine) : null,
        google_drive_url: s.google_drive_url != null ? String(s.google_drive_url) : null,
        folder: s.folder != null ? String(s.folder) : null,
        rank: score,
        total_count: total,
        highlight_summary: leftSnippet(s.summary != null ? String(s.summary) : null, 220),
        highlight_body: leftSnippet(s.full_text != null ? String(s.full_text) : null, 360),
      };
    })
    .filter((x): x is SermonSearchRow => x != null);

  return { results, total };
}
