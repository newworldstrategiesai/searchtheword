import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAdminSupabase } from "@/lib/require-admin";
import { runSermonDedupe } from "@/lib/sermon-dedupe";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST { "dryRun": true } — preview or remove duplicate sermons. */
export async function POST(request: Request) {
  const auth = await getAdminSupabase();
  if (!auth.ok) return auth.response;

  let dryRun = true;
  try {
    const body = (await request.json()) as { dryRun?: boolean };
    if (typeof body.dryRun === "boolean") dryRun = body.dryRun;
  } catch {
    /* default dry run */
  }

  try {
    const supabase = createAdminSupabaseClient();
    const result = await runSermonDedupe(supabase, { dryRun });
    return NextResponse.json({
      ok: true,
      dryRun,
      totalSermons: result.totalSermons,
      duplicateGroups: result.duplicateGroups,
      toDelete: result.toDelete,
      toKeep: result.toKeep,
      deleted: result.deleted,
      sampleGroups: result.groups.slice(0, 20).map((g) => ({
        keeperTitle: g.keeperTitle,
        removeCount: g.deleteIds.length,
        matchReason: g.matchReason,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dedupe failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
