export type Sermon = {
  id: string;
  title: string;
  preacher: string;
  date: string | null;
  scripture_ref: string | null;
  summary: string | null;
  full_text: string | null;
  media_url: string | null;
  created_at: string;
  updated_at: string;
  external_id?: string | null;
  series?: string | null;
  document_type?: string | null;
  core_doctrine?: string | null;
  google_drive_url?: string | null;
  folder?: string | null;
};

export type SermonSearchRow = Sermon & {
  rank: number;
  total_count: number;
  highlight_summary: string | null;
  highlight_body: string | null;
};

export type Keyword = {
  id: string;
  name: string;
  kind?: string;
};

export type ScriptureRefRow = {
  ref_kind: string;
  book: string;
  chapter: number;
  verse_start: number | null;
  verse_end: number | null;
  raw: string;
};

export type SermonWithKeywords = Sermon & {
  keywords: string[];
  scripture_refs?: ScriptureRefRow[];
  searchable_text?: string | null;
  searchable_text_source?: "full_text" | "chunks" | "record" | null;
};

export type SearchMode = "all" | "scripture" | "topic" | "fulltext";

export type SearchResponse = {
  results: SermonSearchRow[];
  total: number;
  page: number;
  limit: number;
};

export type CsvRow = {
  sermon_title: string;
  preacher: string;
  date: string;
  scripture_reference: string;
  keywords: string;
  summary: string;
  full_text: string;
  media_url: string;
};
