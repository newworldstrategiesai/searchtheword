import { mapSearchRpcRow } from "@/lib/search";
import type { SearchMode, SermonSearchRow } from "@/lib/types";
import { createPublicSupabaseClient } from "@/lib/supabase/server";

export type SearchSermonsParams = {
  q: string;
  page: number;
  limit: number;
  mode?: SearchMode;
  filterSeries?: string;
  filterDocumentType?: string;
  filterPreacher?: string;
};

export async function searchSermonsServer(
  params: SearchSermonsParams,
): Promise<{ results: SermonSearchRow[]; total: number }> {
  const { q, page, limit, mode = "all", filterSeries, filterDocumentType, filterPreacher } = params;
  const offset = (page - 1) * limit;
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
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const total = rows.length ? Number(rows[0]!.total_count ?? 0) : 0;
  const results = rows.map(mapSearchRpcRow);
  return { results, total };
}
