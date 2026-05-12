import { extractPdfPlaintext } from "@/lib/pdf-extract";
import {
  applySermonDerivedRelations,
  parseAdminSermonBody,
} from "@/lib/sermon-admin";
import { getAdminSupabase } from "@/lib/require-admin";
import { scheduleSermonEmbeddingReindex } from "@/lib/embeddings/schedule-reindex";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
/** pdf-parse relies on Node file APIs internally in some builds */
export const runtime = "nodejs";

function titleFromFilename(name: string): string {
  const stem = name.replace(/\.pdf$/i, "").trim();
  return stem || "Untitled sermon";
}

function strForm(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function POST(request: Request) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const rawFile = form.get("file");
  if (!rawFile || !(rawFile instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const name = rawFile.name.toLowerCase();
  const type = rawFile.type;
  const looksPdf =
    type === "application/pdf" ||
    type === "application/x-pdf" ||
    name.endsWith(".pdf");
  if (!looksPdf) {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  const preacher = strForm(form.get("preacher"));
  if (!preacher) {
    return NextResponse.json({ error: "Preacher name is required" }, { status: 400 });
  }

  const titleOverride = strForm(form.get("title"));
  const date = strForm(form.get("date"));
  const series = strForm(form.get("series"));
  const title = titleOverride ?? titleFromFilename(rawFile.name);

  const arrayBuffer = await rawFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
  }

  const extracted = await extractPdfPlaintext(buffer);
  if (!extracted.ok) {
    return NextResponse.json({ error: extracted.error }, { status: 400 });
  }

  const checksum = createHash("sha256").update(buffer).digest("hex");
  /** Stable idempotent key so re-uploading the same PDF updates the same sermon */
  const externalId = `pdf:${checksum}`;

  const parsed = parseAdminSermonBody({
    title,
    preacher,
    date: date ?? undefined,
    series: series ?? undefined,
    document_type: "pdf",
    full_text: extracted.text,
    external_id: externalId,
  });

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { supabase } = auth;

  const { data: existing } = await supabase
    .from("sermons")
    .select("id")
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing?.id) {
    const { error: upErr } = await supabase.from("sermons").update(parsed.sermon).eq("id", existing.id);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }
    await applySermonDerivedRelations(supabase, existing.id, parsed.derived);
    scheduleSermonEmbeddingReindex(supabase, {
      id: existing.id,
      title: String(parsed.sermon.title),
      full_text: (parsed.sermon.full_text as string | null | undefined) ?? null,
      summary: (parsed.sermon.summary as string | null | undefined) ?? null,
    });

    return NextResponse.json({
      ok: true,
      id: existing.id,
      external_id: externalId,
      inserted: false,
      charactersExtracted: extracted.text.length,
    });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("sermons")
    .insert(parsed.sermon)
    .select("id")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 400 });
  }

  await applySermonDerivedRelations(supabase, inserted.id, parsed.derived);
  scheduleSermonEmbeddingReindex(supabase, {
    id: inserted.id,
    title: String(parsed.sermon.title),
    full_text: (parsed.sermon.full_text as string | null | undefined) ?? null,
    summary: (parsed.sermon.summary as string | null | undefined) ?? null,
  });

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    external_id: externalId,
    inserted: true,
    charactersExtracted: extracted.text.length,
  });
}
