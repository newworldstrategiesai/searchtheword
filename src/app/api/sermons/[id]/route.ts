import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const supabase = createPublicSupabaseClient();

    const { data: sermon, error: sErr } = await supabase
      .from("sermons")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (sErr || !sermon) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: links } = await supabase
      .from("sermon_keywords")
      .select("keyword_id")
      .eq("sermon_id", id);

    const ids = (links ?? []).map((r) => r.keyword_id as string).filter(Boolean);
    let keywords: string[] = [];
    if (ids.length > 0) {
      const { data: kws } = await supabase.from("keywords").select("name").in("id", ids);
      keywords = (kws ?? []).map((k) => k.name as string);
    }

    return NextResponse.json({
      sermon: {
        ...sermon,
        keywords,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load sermon";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
