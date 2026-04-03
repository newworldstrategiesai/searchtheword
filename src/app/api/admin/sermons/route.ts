import {
  applySermonDerivedRelations,
  parseAdminSermonBody,
  type AdminSermonBody,
} from "@/lib/sermon-admin";
import { getAdminSupabase } from "@/lib/require-admin";
import { scheduleSermonEmbeddingReindex } from "@/lib/embeddings/schedule-reindex";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50));
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const { supabase } = auth;
  const { data: rows, error, count } = await supabase
    .from("sermons")
    .select("id, title, preacher, date, series, external_id, updated_at", { count: "exact" })
    .order("date", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: rows ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}

export async function POST(request: Request) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  let body: AdminSermonBody;
  try {
    body = (await request.json()) as AdminSermonBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseAdminSermonBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { supabase } = auth;
  const { data, error } = await supabase.from("sermons").insert(parsed.sermon).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { warnings } = await applySermonDerivedRelations(supabase, data.id, parsed.derived);

  scheduleSermonEmbeddingReindex(supabase, {
    id: data.id,
    title: String(parsed.sermon.title),
    full_text: (parsed.sermon.full_text as string | null | undefined) ?? null,
    summary: (parsed.sermon.summary as string | null | undefined) ?? null,
  });

  return NextResponse.json({ id: data.id, warnings });
}
