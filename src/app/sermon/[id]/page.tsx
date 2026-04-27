import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STATIC_OG, staticOgImage } from "@/lib/seo";
import { SermonDetail } from "@/components/sermon-detail";
import { isUuid } from "@/lib/is-uuid";
import { scheduleSermonEmbeddingReindex } from "@/lib/embeddings/schedule-reindex";
import {
  fetchNativeGoogleFileAsPlaintext,
  googleDriveExportConfigured,
} from "@/lib/google-drive/export-plaintext";
import { extractGoogleDriveFileId } from "@/lib/google-drive-embed";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import type { ScriptureRefRow, SermonWithKeywords } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

type SermonSourceRow = {
  id: string;
  title: string;
  full_text: string | null;
  summary: string | null;
  google_drive_url?: string | null;
  media_url?: string | null;
};

function pickExportSourceUrl(row: SermonSourceRow): string | null {
  const driveUrl = row.google_drive_url?.trim();
  if (driveUrl && extractGoogleDriveFileId(driveUrl)) return driveUrl;

  const mediaUrl = row.media_url?.trim();
  if (mediaUrl && extractGoogleDriveFileId(mediaUrl)) return mediaUrl;

  return null;
}

async function getInlineSourceDocumentText(row: SermonSourceRow): Promise<string | null> {
  if (!googleDriveExportConfigured()) return null;

  const sourceUrl = pickExportSourceUrl(row);
  if (!sourceUrl) return null;

  const fileId = extractGoogleDriveFileId(sourceUrl);
  if (!fileId) return null;

  const exported = await fetchNativeGoogleFileAsPlaintext(fileId);
  if (!exported.ok) {
    console.warn(`[sermon-detail] Could not export source document for ${row.id}: ${exported.error}`);
    return null;
  }

  try {
    const admin = createAdminSupabaseClient();
    const { error } = await admin
      .from("sermons")
      .update({ full_text: exported.text })
      .eq("id", row.id);

    if (error) {
      console.warn(`[sermon-detail] Could not save exported source text for ${row.id}: ${error.message}`);
    } else {
      scheduleSermonEmbeddingReindex(admin, {
        id: row.id,
        title: row.title,
        full_text: exported.text,
        summary: row.summary,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.warn(`[sermon-detail] Could not cache exported source text for ${row.id}: ${message}`);
  }

  return exported.text;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) {
    return { title: "Sermon not found", robots: { index: false, follow: false } };
  }
  const supabase = createPublicSupabaseClient();
  const { data } = await supabase
    .from("sermons")
    .select("title, preacher, date, summary, scripture_ref")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return { title: "Sermon" };
  }

  const title = String(data.title ?? "Sermon");
  const preacher = String(data.preacher ?? "");
  const summary = (data.summary as string | null)?.replace(/\s+/g, " ").trim();
  const scripture = (data.scripture_ref as string | null)?.trim();
  const description =
    summary?.slice(0, 165) ||
    [title, preacher, scripture].filter(Boolean).join(" — ").slice(0, 180) ||
    `${title} — sermon from SearchTheWord.`;

  const url = `/sermon/${id}`;
  const publishedTime =
    data.date != null ? new Date(String(data.date)).toISOString() : undefined;

  return {
    title: title.length > 65 ? `${title.slice(0, 62)}…` : title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      images: [staticOgImage(STATIC_OG.sermon)],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      title,
      description,
      images: [STATIC_OG.sermon],
    },
  };
}

export default async function SermonPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const rawQ = sp.q;
  const highlightQuery = (
    typeof rawQ === "string" ? rawQ : Array.isArray(rawQ) ? (rawQ[0] ?? "") : ""
  ).trim();
  if (!isUuid(id)) {
    notFound();
  }
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

  const fullText = sermon.full_text as string | null;
  let searchableText = fullText?.trim() ? fullText : null;
  let searchableTextSource: SermonWithKeywords["searchable_text_source"] = searchableText ? "full_text" : null;

  if (!searchableText) {
    const { data: chunks } = await supabase
      .from("sermon_chunks")
      .select("content")
      .eq("sermon_id", id)
      .order("chunk_index", { ascending: true });

    const chunkText = (chunks ?? [])
      .map((chunk) => String((chunk as { content?: string }).content ?? "").trim())
      .filter(Boolean)
      .join("\n\n");

    if (chunkText) {
      searchableText = chunkText;
      searchableTextSource = "chunks";
    }
  }

  if (!searchableText) {
    const sourceText = await getInlineSourceDocumentText({
      id: sermon.id as string,
      title: sermon.title as string,
      full_text: fullText,
      summary: sermon.summary as string | null,
      google_drive_url: (sermon as { google_drive_url?: string }).google_drive_url ?? null,
      media_url: sermon.media_url as string | null,
    });

    if (sourceText?.trim()) {
      searchableText = sourceText;
      searchableTextSource = "source_document";
    }
  }

  if (!searchableText) {
    const recordText = [
      sermon.summary ? `Summary\n${String(sermon.summary)}` : "",
      sermon.core_doctrine ? `Core doctrine\n${String(sermon.core_doctrine)}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (recordText.trim()) {
      searchableText = recordText;
      searchableTextSource = "record";
    }
  }

  const payload: SermonWithKeywords = {
    ...sermon,
    id: sermon.id as string,
    title: sermon.title as string,
    preacher: sermon.preacher as string,
    date: sermon.date as string | null,
    scripture_ref: sermon.scripture_ref as string | null,
    summary: sermon.summary as string | null,
    full_text: fullText,
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
    searchable_text: searchableText,
    searchable_text_source: searchableTextSource,
  };

  return <SermonDetail sermon={payload} highlightQuery={highlightQuery} />;
}
