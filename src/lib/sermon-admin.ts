import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeScriptureRef } from "@/lib/ingest/normalize";
import type { SermonDerivedSyncInput } from "@/lib/ingest/process";
import { syncSermonDerivedRelations } from "@/lib/ingest/process";

/** JSON body from admin create/update forms */
export type AdminSermonBody = {
  title?: unknown;
  preacher?: unknown;
  date?: unknown;
  scripture_ref?: unknown;
  summary?: unknown;
  full_text?: unknown;
  media_url?: unknown;
  external_id?: unknown;
  series?: unknown;
  part_number?: unknown;
  document_type?: unknown;
  primary_scripture_raw?: unknown;
  secondary_scriptures_raw?: unknown;
  google_drive_url?: unknown;
  folder?: unknown;
  core_doctrine?: unknown;
  doctrinal_position?: unknown;
  key_claims?: unknown;
  audience?: unknown;
  metadata_confidence?: unknown;
  ai_training_approved?: unknown;
  topics?: unknown;
  keywords?: unknown;
};

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return String(v);
  const t = v.trim();
  return t === "" ? null : t;
}

function strKeepEmpty(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

function optionalPartNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

export function parseAdminSermonBody(body: AdminSermonBody): {
  sermon: Record<string, unknown>;
  derived: SermonDerivedSyncInput;
} | { error: string } {
  const title = str(body.title);
  const preacher = str(body.preacher);
  if (!title || !preacher) {
    return { error: "Title and preacher are required." };
  }

  const primaryRaw = str(body.primary_scripture_raw);
  const scriptureRef =
    normalizeScriptureRef(primaryRaw ?? undefined) ??
    normalizeScriptureRef(str(body.scripture_ref) ?? undefined) ??
    null;

  const sermon: Record<string, unknown> = {
    title,
    preacher,
    date: str(body.date),
    scripture_ref: scriptureRef,
    summary: str(body.summary),
    full_text: str(body.full_text),
    media_url: str(body.media_url),
    external_id: str(body.external_id),
    series: str(body.series),
    part_number: optionalPartNumber(body.part_number),
    document_type: str(body.document_type),
    primary_scripture_raw: primaryRaw,
    secondary_scriptures_raw: str(body.secondary_scriptures_raw),
    google_drive_url: str(body.google_drive_url),
    folder: str(body.folder),
    core_doctrine: str(body.core_doctrine),
    doctrinal_position: str(body.doctrinal_position),
    key_claims: str(body.key_claims),
    audience: str(body.audience),
    metadata_confidence: str(body.metadata_confidence),
    ai_training_approved: str(body.ai_training_approved),
  };

  const derived: SermonDerivedSyncInput = {
    topics: strKeepEmpty(body.topics),
    keywords: strKeepEmpty(body.keywords),
    core_doctrine: str(body.core_doctrine),
    primary_scripture_raw: primaryRaw,
    secondary_scriptures_raw: str(body.secondary_scriptures_raw),
  };

  return { sermon, derived };
}

export async function loadSermonTopicKeywordStrings(
  supabase: SupabaseClient,
  sermonId: string,
): Promise<{ topics: string; keywords: string }> {
  const { data: links } = await supabase.from("sermon_keywords").select("keyword_id").eq("sermon_id", sermonId);
  const ids = (links ?? []).map((l) => l.keyword_id as string).filter(Boolean);
  if (!ids.length) return { topics: "", keywords: "" };

  const { data: kws } = await supabase.from("keywords").select("name, kind").in("id", ids);
  const topics: string[] = [];
  const keywords: string[] = [];
  for (const k of kws ?? []) {
    if (k.kind === "topic") topics.push(k.name as string);
    else if (k.kind === "keyword") keywords.push(k.name as string);
  }
  return { topics: topics.join(", "), keywords: keywords.join(", ") };
}

export async function applySermonDerivedRelations(
  supabase: SupabaseClient,
  sermonId: string,
  derived: SermonDerivedSyncInput,
): Promise<{ warnings: string[] }> {
  const errors: string[] = [];
  await syncSermonDerivedRelations(supabase, sermonId, derived, errors, `Sermon ${sermonId}`);
  return { warnings: errors };
}
