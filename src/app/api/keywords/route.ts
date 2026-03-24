import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createPublicSupabaseClient();
    const { data, error } = await supabase.from("keywords").select("id, name, kind").order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ keywords: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load keywords";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
