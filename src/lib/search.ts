import type { SermonSearchRow } from "@/lib/types";

export function mapSearchRpcRow(row: Record<string, unknown>): SermonSearchRow {
  return {
    id: String(row.id),
    title: String(row.title),
    preacher: String(row.preacher),
    date: row.date ? String(row.date) : null,
    scripture_ref: row.scripture_ref != null ? String(row.scripture_ref) : null,
    summary: row.summary != null ? String(row.summary) : null,
    full_text: row.full_text != null ? String(row.full_text) : null,
    media_url: row.media_url != null ? String(row.media_url) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    external_id: row.external_id != null ? String(row.external_id) : null,
    series: row.series != null ? String(row.series) : null,
    document_type: row.document_type != null ? String(row.document_type) : null,
    core_doctrine: row.core_doctrine != null ? String(row.core_doctrine) : null,
    google_drive_url: row.google_drive_url != null ? String(row.google_drive_url) : null,
    folder: row.folder != null ? String(row.folder) : null,
    rank: Number(row.rank ?? 0),
    total_count: Number(row.total_count ?? 0),
    highlight_summary: row.highlight_summary != null ? String(row.highlight_summary) : null,
    highlight_body: row.highlight_body != null ? String(row.highlight_body) : null,
  };
}
