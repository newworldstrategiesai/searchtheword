import type { SupabaseClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  excelSerialToIsoDate,
  normalizeDate,
  normalizeScriptureRef,
  splitTagList,
} from "@/lib/ingest/normalize";
import { parseScriptureRefToParts, splitScriptureRefs } from "@/lib/ingest/scripture-parse";

export type KeywordKind = "topic" | "keyword" | "doctrine" | "legacy";

export type CsvRowInput = {
  sermon_title?: string;
  preacher?: string;
  date?: string;
  scripture_reference?: string;
  keywords?: string;
  summary?: string;
  full_text?: string;
  media_url?: string;
  /** FHMI / extended */
  id?: string;
  title?: string;
  speaker?: string;
  series?: string;
  part_number?: string;
  document_type?: string;
  primary_scripture?: string;
  secondary_scriptures?: string;
  topics?: string;
  core_doctrine?: string;
  google_drive_link?: string;
  folder?: string;
  doctrinal_position?: string;
  key_claims?: string;
  audience?: string;
  metadata_confidence?: string;
  ai_training_approved?: string;
};

export type IngestResult = {
  inserted: number;
  updated: number;
  errors: string[];
};

/** Progress events for streaming ingest UI (admin import). */
export type IngestProgressEvent =
  | { kind: "phase"; message: string }
  | { kind: "parsed"; rowCount: number; fileKind: "xlsx" | "csv" }
  | {
      kind: "row";
      dataRow: number;
      totalRows: number;
      sheetRow: number;
      title: string;
      detail: string;
    };

export type IngestOptions = {
  onProgress?: (event: IngestProgressEvent) => void;
};

const HEADER_FIXES: Record<string, string> = {
  seconday_scriptures: "secondary_scriptures",
  secondary_scripture: "secondary_scriptures",
  metadate_confidence: "metadata_confidence",
};

export function normalizeHeaderKey(h: string): string {
  let k = h.trim().toLowerCase().replace(/\s+/g, "_");
  if (HEADER_FIXES[k]) k = HEADER_FIXES[k]!;
  return k;
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeHeaderKey(k);
    out[nk] = cellToString(v, nk);
  }
  return out;
}

function cellToString(v: unknown, colKey: string): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    if (colKey.includes("date") && v > 20000 && v < 80000) {
      return excelSerialToIsoDate(v) ?? String(v);
    }
    if (Number.isInteger(v) || Math.abs(v - Math.round(v)) < 1e-9) {
      return String(Math.round(v));
    }
    return String(v);
  }
  return String(v).trim();
}

export function parseCsvContent(content: string): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, unknown>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeaderKey,
  });
  if (parsed.errors.length) {
    const msg = parsed.errors.map((e) => e.message).join("; ");
    throw new Error(`CSV parse error: ${msg}`);
  }
  return (parsed.data ?? []).map((row) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      o[k] = cellToString(v, k);
    }
    return o;
  });
}

export function parseXlsxBuffer(buffer: ArrayBuffer | Buffer): Record<string, string>[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  return rows.map((row) => normalizeRowKeys(row));
}

async function getOrCreateKeywordId(
  supabase: SupabaseClient,
  name: string,
  kind: KeywordKind,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("keywords")
    .select("id")
    .eq("name", name)
    .eq("kind", kind)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("keywords")
    .insert({ name, kind })
    .select("id")
    .single();

  if (error) {
    const retry = await supabase
      .from("keywords")
      .select("id")
      .eq("name", name)
      .eq("kind", kind)
      .maybeSingle();
    return retry.data?.id ?? null;
  }
  return created?.id ?? null;
}

async function linkKeyword(
  supabase: SupabaseClient,
  sermonId: string,
  name: string,
  kind: KeywordKind,
  errors: string[],
  rowLabel: string,
) {
  const kid = await getOrCreateKeywordId(supabase, name, kind);
  if (!kid) {
    errors.push(`${rowLabel}: could not create keyword "${name}" (${kind})`);
    return;
  }
  const { error: linkErr } = await supabase.from("sermon_keywords").insert({
    sermon_id: sermonId,
    keyword_id: kid,
  });
  if (linkErr && !linkErr.message.includes("duplicate")) {
    errors.push(`${rowLabel}: link "${name}": ${linkErr.message}`);
  }
}

async function replaceScriptureRefs(
  supabase: SupabaseClient,
  sermonId: string,
  primaryRaw: string | null,
  secondaryRaw: string | null,
) {
  await supabase.from("sermon_scripture_refs").delete().eq("sermon_id", sermonId);

  const rows: Array<{
    sermon_id: string;
    ref_kind: string;
    book: string;
    chapter: number;
    verse_start: number | null;
    verse_end: number | null;
    raw: string;
    search_text: string;
  }> = [];

  if (primaryRaw?.trim()) {
    const p = parseScriptureRefToParts(primaryRaw.trim());
    if (p && p.chapter > 0) {
      rows.push({
        sermon_id: sermonId,
        ref_kind: "primary",
        book: p.book,
        chapter: p.chapter,
        verse_start: p.verse_start,
        verse_end: p.verse_end,
        raw: p.raw,
        search_text: p.search_text,
      });
    }
  }

  for (const sec of splitScriptureRefs(secondaryRaw)) {
    const p = parseScriptureRefToParts(sec);
    if (p && p.chapter > 0) {
      rows.push({
        sermon_id: sermonId,
        ref_kind: "secondary",
        book: p.book,
        chapter: p.chapter,
        verse_start: p.verse_start,
        verse_end: p.verse_end,
        raw: p.raw,
        search_text: p.search_text,
      });
    }
  }

  if (rows.length) {
    await supabase.from("sermon_scripture_refs").insert(rows);
  }
}

export type SermonDerivedSyncInput = {
  topics: string;
  keywords: string;
  core_doctrine: string | null;
  primary_scripture_raw: string | null;
  secondary_scriptures_raw: string | null;
};

/**
 * Rebuilds `sermon_keywords` and `sermon_scripture_refs` from raw topic/keyword/scripture fields.
 * Used by bulk ingest and admin sermon edit.
 */
export async function syncSermonDerivedRelations(
  supabase: SupabaseClient,
  sermonId: string,
  opts: SermonDerivedSyncInput,
  errors: string[],
  rowLabel: string,
): Promise<void> {
  await supabase.from("sermon_keywords").delete().eq("sermon_id", sermonId);

  for (const t of splitTagList(opts.topics)) {
    await linkKeyword(supabase, sermonId, t, "topic", errors, rowLabel);
  }
  for (const k of splitTagList(opts.keywords)) {
    await linkKeyword(supabase, sermonId, k, "keyword", errors, rowLabel);
  }
  if (opts.core_doctrine?.trim()) {
    const d = opts.core_doctrine.trim().toLowerCase();
    await linkKeyword(supabase, sermonId, d, "doctrine", errors, rowLabel);
  }

  await replaceScriptureRefs(
    supabase,
    sermonId,
    opts.primary_scripture_raw?.trim() || null,
    opts.secondary_scriptures_raw?.trim() || null,
  );
}

function rowDate(row: Record<string, string>): string | null {
  const raw = row.date_delivered || row.date || "";
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isNaN(n) && n > 20000 && n < 80000) {
    return excelSerialToIsoDate(n);
  }
  return normalizeDate(raw);
}

function rowTitle(row: Record<string, string>): string {
  return (row.title || row.sermon_title || "").trim();
}

function rowPreacher(row: Record<string, string>): string {
  return (row.speaker || row.preacher || "").trim();
}

export async function ingestRows(
  supabase: SupabaseClient,
  rows: Record<string, string>[],
  options?: IngestOptions,
): Promise<IngestResult> {
  const onProgress = options?.onProgress;
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;
  const totalRows = rows.length;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const title = rowTitle(row);
    const preacher = rowPreacher(row);
    const rowLabel = `Row ${i + 2}`;
    const dataRow = i + 1;
    const sheetRow = i + 2;
    const displayTitle = title || "(missing title)";

    onProgress?.({
      kind: "row",
      dataRow,
      totalRows,
      sheetRow,
      title: displayTitle,
      detail: "Reading row…",
    });

    if (!title || !preacher) {
      onProgress?.({
        kind: "row",
        dataRow,
        totalRows,
        sheetRow,
        title: displayTitle,
        detail: "Skipped — missing title or speaker/preacher",
      });
      errors.push(`${rowLabel}: missing title or speaker/preacher`);
      continue;
    }

    const externalId = row.id?.trim() || null;
    onProgress?.({
      kind: "row",
      dataRow,
      totalRows,
      sheetRow,
      title,
      detail: externalId ? "Matching external ID…" : "Inserting new sermon…",
    });

    const date = rowDate(row);
    const primaryRaw = row.primary_scripture?.trim() || null;
    const secondaryRaw = row.secondary_scriptures?.trim() || null;
    const scriptureRef = normalizeScriptureRef(primaryRaw || row.scripture_reference) || null;

    const partNum = row.part_number?.trim() ? Number.parseInt(row.part_number, 10) : null;
    const payload = {
      title,
      preacher,
      date,
      scripture_ref: scriptureRef,
      summary: row.summary?.trim() || null,
      full_text: row.full_text?.trim() || null,
      media_url: row.media_url?.trim() || row.google_drive_link?.trim() || null,
      external_id: externalId,
      series: row.series?.trim() || null,
      part_number: Number.isFinite(partNum!) ? partNum : null,
      document_type: row.document_type?.trim() || null,
      primary_scripture_raw: primaryRaw,
      secondary_scriptures_raw: secondaryRaw,
      google_drive_url: row.google_drive_link?.trim() || null,
      folder: row.folder?.trim() || null,
      core_doctrine: row.core_doctrine?.trim() || null,
      doctrinal_position: row.doctrinal_position?.trim() || null,
      key_claims: row.key_claims?.trim() || null,
      audience: row.audience?.trim() || null,
      metadata_confidence: row.metadata_confidence?.trim() || null,
      ai_training_approved: row.ai_training_approved?.trim() || null,
    };

    let sermonId: string | null = null;

    if (externalId) {
      const { data: existing } = await supabase
        .from("sermons")
        .select("id")
        .eq("external_id", externalId)
        .maybeSingle();
      if (existing?.id) {
        onProgress?.({
          kind: "row",
          dataRow,
          totalRows,
          sheetRow,
          title,
          detail: "Updating sermon row…",
        });
        const { error: upErr } = await supabase.from("sermons").update(payload).eq("id", existing.id);
        if (upErr) {
          errors.push(`${rowLabel}: ${upErr.message}`);
          continue;
        }
        sermonId = existing.id;
        await supabase.from("sermon_keywords").delete().eq("sermon_id", sermonId);
        updated++;
      }
    }

    if (!sermonId) {
      onProgress?.({
        kind: "row",
        dataRow,
        totalRows,
        sheetRow,
        title,
        detail: "Writing sermon to database…",
      });
      const { data: sermon, error: serErr } = await supabase
        .from("sermons")
        .insert(payload)
        .select("id")
        .single();
      if (serErr || !sermon) {
        errors.push(`${rowLabel}: ${serErr?.message ?? "insert failed"}`);
        continue;
      }
      sermonId = sermon.id;
      inserted++;
    }

    if (!sermonId) {
      errors.push(`${rowLabel}: could not resolve sermon id`);
      continue;
    }

    const sid = sermonId;

    onProgress?.({
      kind: "row",
      dataRow,
      totalRows,
      sheetRow,
      title,
      detail: "Linking topics, keywords, doctrine, and scripture…",
    });

    await syncSermonDerivedRelations(
      supabase,
      sid,
      {
        topics: row.topics ?? "",
        keywords: row.keywords ?? "",
        core_doctrine: row.core_doctrine?.trim() || null,
        primary_scripture_raw: primaryRaw,
        secondary_scriptures_raw: secondaryRaw,
      },
      errors,
      rowLabel,
    );
  }

  return { inserted, updated, errors };
}

export async function ingestFromCsvString(
  supabase: SupabaseClient,
  csv: string,
  options?: IngestOptions,
): Promise<IngestResult> {
  options?.onProgress?.({ kind: "phase", message: "Parsing CSV…" });
  const rows = parseCsvContent(csv);
  options?.onProgress?.({ kind: "parsed", rowCount: rows.length, fileKind: "csv" });
  return ingestRows(supabase, rows, options);
}

export async function ingestFromXlsxBuffer(
  supabase: SupabaseClient,
  buffer: ArrayBuffer | Buffer,
  options?: IngestOptions,
): Promise<IngestResult> {
  options?.onProgress?.({ kind: "phase", message: "Parsing Excel workbook…" });
  const rows = parseXlsxBuffer(buffer);
  options?.onProgress?.({ kind: "parsed", rowCount: rows.length, fileKind: "xlsx" });
  return ingestRows(supabase, rows, options);
}
