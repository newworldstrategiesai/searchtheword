import {
  applySermonDerivedRelations,
  loadSermonTopicKeywordStrings,
  parseAdminSermonBody,
  type AdminSermonBody,
} from "@/lib/sermon-admin";
import { getAdminSupabase } from "@/lib/require-admin";
import { scheduleSermonEmbeddingReindex } from "@/lib/embeddings/schedule-reindex";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const { supabase } = auth;

  const { data: sermon, error } = await supabase.from("sermons").select("*").eq("id", id).maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!sermon) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { topics, keywords } = await loadSermonTopicKeywordStrings(supabase, id);

  return NextResponse.json({
    sermon: {
      ...sermon,
      topics,
      keywords,
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

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
  const { data: existing, error: findErr } = await supabase.from("sermons").select("id").eq("id", id).maybeSingle();
  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase.from("sermons").update(parsed.sermon).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { warnings } = await applySermonDerivedRelations(supabase, id, parsed.derived);

  scheduleSermonEmbeddingReindex(supabase, {
    id,
    title: String(parsed.sermon.title),
    full_text: (parsed.sermon.full_text as string | null | undefined) ?? null,
    summary: (parsed.sermon.summary as string | null | undefined) ?? null,
  });

  return NextResponse.json({ ok: true, warnings });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const { supabase } = auth;

  const { data: existing, error: findErr } = await supabase.from("sermons").select("id").eq("id", id).maybeSingle();
  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase.from("sermons").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
