import { notFound } from "next/navigation";
import { SermonDetail } from "@/components/sermon-detail";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import type { ScriptureRefRow, SermonWithKeywords } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SermonPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = createPublicSupabaseClient();

  const { data: sermon, error } = await supabase.from("sermons").select("*").eq("id", id).maybeSingle();

  if (error || !sermon) {
    notFound();
  }

  const { data: links } = await supabase.from("sermon_keywords").select("keyword_id").eq("sermon_id", id);
  const kwIds = (links ?? []).map((r) => r.keyword_id as string).filter(Boolean);
  let keywords: string[] = [];
  if (kwIds.length) {
    const { data: kws } = await supabase.from("keywords").select("name").in("id", kwIds);
    keywords = (kws ?? []).map((k) => k.name as string);
  }

  const { data: refRows } = await supabase
    .from("sermon_scripture_refs")
    .select("ref_kind, book, chapter, verse_start, verse_end, raw")
    .eq("sermon_id", id)
    .order("ref_kind", { ascending: true });

  const scripture_refs: ScriptureRefRow[] = (refRows ?? []).map((r) => ({
    ref_kind: String(r.ref_kind),
    book: String(r.book),
    chapter: Number(r.chapter),
    verse_start: r.verse_start != null ? Number(r.verse_start) : null,
    verse_end: r.verse_end != null ? Number(r.verse_end) : null,
    raw: String(r.raw),
  }));

  const payload: SermonWithKeywords = {
    ...sermon,
    id: sermon.id as string,
    title: sermon.title as string,
    preacher: sermon.preacher as string,
    date: sermon.date as string | null,
    scripture_ref: sermon.scripture_ref as string | null,
    summary: sermon.summary as string | null,
    full_text: sermon.full_text as string | null,
    media_url: sermon.media_url as string | null,
    created_at: sermon.created_at as string,
    updated_at: sermon.updated_at as string,
    external_id: (sermon as { external_id?: string }).external_id ?? null,
    series: (sermon as { series?: string }).series ?? null,
    document_type: (sermon as { document_type?: string }).document_type ?? null,
    core_doctrine: (sermon as { core_doctrine?: string }).core_doctrine ?? null,
    google_drive_url: (sermon as { google_drive_url?: string }).google_drive_url ?? null,
    folder: (sermon as { folder?: string }).folder ?? null,
    keywords,
    scripture_refs,
  };

  return <SermonDetail sermon={payload} />;
}
