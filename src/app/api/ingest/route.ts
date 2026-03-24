import { isAdmin } from "@/lib/auth";
import { ingestFromCsvString, ingestFromXlsxBuffer } from "@/lib/ingest/process";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");
  const result = isXlsx
    ? await ingestFromXlsxBuffer(supabase, await file.arrayBuffer())
    : await ingestFromCsvString(supabase, await file.text());

  return NextResponse.json(result);
}
