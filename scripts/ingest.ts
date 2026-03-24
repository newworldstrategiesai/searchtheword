/**
 * CLI: npx tsx scripts/ingest.ts --file ./data/sample.csv
 *       npx tsx scripts/ingest.ts --file ./path/to/index.xlsx
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { createAdminSupabaseClient } from "../src/lib/supabase/admin";
import { ingestFromCsvString, ingestFromXlsxBuffer } from "../src/lib/ingest/process";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--file");
  const file = idx >= 0 ? args[idx + 1] : null;
  if (!file) {
    console.error("Usage: npx tsx scripts/ingest.ts --file ./data/sermons.csv|./index.xlsx");
    process.exit(1);
  }

  const filePath = resolve(process.cwd(), file);
  const buf = readFileSync(filePath);
  const supabase = createAdminSupabaseClient();

  const lower = file.toLowerCase();
  const result =
    lower.endsWith(".xlsx") || lower.endsWith(".xls")
      ? await ingestFromXlsxBuffer(supabase, buf)
      : await ingestFromCsvString(supabase, buf.toString("utf8"));

  console.log(`Inserted: ${result.inserted}, updated: ${result.updated}`);
  if (result.errors.length) {
    console.error("Warnings/errors:");
    result.errors.forEach((e) => console.error(" -", e));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
