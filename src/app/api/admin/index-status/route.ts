import { buildIndexPlan, type SermonIndexStatusRow } from "@/lib/embeddings/index-plan";
import { embeddingsConfigured } from "@/lib/embeddings/openai-embed";
import { getAdminSupabase } from "@/lib/require-admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin-only: preview what an embedding reindex would do — counts of new /
 * changed / up-to-date / empty sermons plus estimated OpenAI requests, tokens,
 * and cost for the new+changed set. Makes NO OpenAI calls and writes nothing.
 */
export async function GET() {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase.rpc("admin_sermon_index_status");
  if (error) {
    const hint = /function .* does not exist|could not find/i.test(error.message)
      ? " Run database migration 006_sermon_index_status.sql, then try again."
      : "";
    return NextResponse.json(
      { error: `Could not load index status: ${error.message}.${hint}` },
      { status: 500 },
    );
  }

  const plan = buildIndexPlan((data ?? []) as SermonIndexStatusRow[]);
  return NextResponse.json({
    ok: true,
    embeddingsConfigured: embeddingsConfigured(),
    plan,
  });
}
