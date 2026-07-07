import { parseUploadRows } from "@/lib/ingest/process";
import { getAdminSupabase } from "@/lib/require-admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/ingest/parse
 *
 * Accepts a multipart file upload and returns the parsed spreadsheet rows as
 * JSON — no database writes happen here.  The admin client uses this to split
 * a large sheet into small batches before sending each batch to
 * POST /api/ingest/batch, keeping every request well within serverless
 * time limits regardless of spreadsheet size.
 *
 * Response: { rows: Record<string, string>[], fileKind: "xlsx" | "csv" }
 */
export async function POST(request: Request) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  const form = await request.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");

  try {
    const buffer = await file.arrayBuffer();
    const rows = parseUploadRows({ buffer, isXlsx });
    return NextResponse.json({ rows, fileKind: isXlsx ? "xlsx" : "csv" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
