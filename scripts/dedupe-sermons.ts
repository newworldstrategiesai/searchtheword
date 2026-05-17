/**
 * Remove duplicate sermon rows (keeps best match per teaching).
 *
 *   npx tsx scripts/dedupe-sermons.ts --dry-run
 *   npx tsx scripts/dedupe-sermons.ts --apply
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { createAdminSupabaseClient } from "../src/lib/supabase/admin";
import { runSermonDedupe } from "../src/lib/sermon-dedupe";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = args.includes("--dry-run") || !apply;

  if (!dryRun && !apply) {
    console.error("Usage:\n  npx tsx scripts/dedupe-sermons.ts --dry-run\n  npx tsx scripts/dedupe-sermons.ts --apply");
    process.exit(1);
  }

  const supabase = createAdminSupabaseClient();
  const result = await runSermonDedupe(supabase, { dryRun });

  console.log(`Total sermons:     ${result.totalSermons}`);
  console.log(`Duplicate groups:  ${result.duplicateGroups}`);
  console.log(`Would delete:      ${result.toDelete}`);
  console.log(`Would keep:        ${result.toKeep}`);

  if (result.groups.length) {
    console.log("\nSample groups (up to 15):");
    for (const g of result.groups.slice(0, 15)) {
      console.log(`  • "${g.keeperTitle}" — keep 1, remove ${g.deleteIds.length} (${g.matchReason})`);
    }
    if (result.groups.length > 15) {
      console.log(`  … and ${result.groups.length - 15} more groups`);
    }
  }

  if (dryRun) {
    if (result.toDelete > 0) {
      console.log("\nRe-run with --apply to delete duplicates (cascades keywords, scripture refs, chunks).");
    } else {
      console.log("\nNo duplicates found.");
    }
    return;
  }

  console.log(`\nDeleted: ${result.deleted} duplicate sermon rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
