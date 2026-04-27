/**
 * Crawl every Google-native source document into sermons.full_text, then rebuild embeddings.
 *
 * Usage:
 *   npx tsx scripts/backfill-google-docs-and-index.ts
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { indexSermonChunks } from "../src/lib/embeddings/index-sermon";
import { embeddingsConfigured } from "../src/lib/embeddings/openai-embed";
import {
  fetchNativeGoogleFileAsPlaintext,
  getGoogleServiceAccountEmail,
  googleDriveExportConfigured,
} from "../src/lib/google-drive/export-plaintext";
import { extractGoogleDriveFileId } from "../src/lib/google-drive-embed";
import { createAdminSupabaseClient } from "../src/lib/supabase/admin";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

type Row = {
  id: string;
  title: string;
  full_text: string | null;
  summary: string | null;
  google_drive_url: string | null;
  media_url: string | null;
};

function pickUrl(row: Row): string | null {
  const googleDriveUrl = row.google_drive_url?.trim();
  if (googleDriveUrl && extractGoogleDriveFileId(googleDriveUrl)) return googleDriveUrl;

  const mediaUrl = row.media_url?.trim();
  if (mediaUrl && extractGoogleDriveFileId(mediaUrl)) return mediaUrl;

  return null;
}

async function main() {
  const supabase = createAdminSupabaseClient();

  console.log("google_configured", googleDriveExportConfigured(), "service_account", getGoogleServiceAccountEmail() ?? "none");
  console.log("openai_embeddings_configured", embeddingsConfigured());

  const { data, error } = await supabase
    .from("sermons")
    .select("id,title,full_text,summary,google_drive_url,media_url")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as Row[];
  const sourceRows = rows.filter((row) => Boolean(pickUrl(row)));

  console.log("sermons_total", rows.length);
  console.log("google_source_rows", sourceRows.length);
  console.log("already_have_full_text", rows.filter((row) => Boolean(row.full_text?.trim())).length);

  const crawlResults: Array<{ title: string; status: string; detail?: string }> = [];

  for (const row of sourceRows) {
    if (row.full_text?.trim()) {
      crawlResults.push({ title: row.title, status: "skipped", detail: "full_text already present" });
      continue;
    }

    const sourceUrl = pickUrl(row);
    const fileId = sourceUrl ? extractGoogleDriveFileId(sourceUrl) : null;
    if (!fileId) {
      crawlResults.push({ title: row.title, status: "skipped", detail: "no file id" });
      continue;
    }

    const exported = await fetchNativeGoogleFileAsPlaintext(fileId);
    if (!exported.ok) {
      crawlResults.push({ title: row.title, status: "error", detail: exported.error });
      console.log("CRAWL error", row.title, "-", exported.error);
      continue;
    }

    const { error: updateError } = await supabase.from("sermons").update({ full_text: exported.text }).eq("id", row.id);
    if (updateError) {
      crawlResults.push({ title: row.title, status: "error", detail: updateError.message });
      console.log("CRAWL update_error", row.title, "-", updateError.message);
      continue;
    }

    row.full_text = exported.text;
    crawlResults.push({
      title: row.title,
      status: "updated",
      detail: `${exported.text.length} chars${exported.name ? ` from ${exported.name}` : ""}`,
    });
    console.log("CRAWL updated", row.title, "-", exported.text.length, "chars");
  }

  const indexableRows = rows.filter((row) => Boolean(row.full_text?.trim()));
  let indexed = 0;
  let chunks = 0;
  const indexErrors: Array<{ title: string; error: string }> = [];

  for (const row of indexableRows) {
    const result = await indexSermonChunks(supabase, {
      id: row.id,
      title: row.title,
      full_text: row.full_text,
      summary: row.summary,
    });

    if (!result.ok) {
      indexErrors.push({ title: row.title, error: result.error ?? "unknown error" });
      console.log("INDEX error", row.title, "-", result.error ?? "unknown error");
      continue;
    }

    indexed += 1;
    chunks += result.chunks;
    console.log("INDEX indexed", row.title, "-", result.chunks, "chunks");
  }

  const { count: fullTextCount } = await supabase
    .from("sermons")
    .select("id", { count: "exact", head: true })
    .not("full_text", "is", null)
    .neq("full_text", "");
  const { count: chunkCount } = await supabase.from("sermon_chunks").select("id", { count: "exact", head: true });

  const crawlSummary = crawlResults.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log("\nSUMMARY");
  console.log("crawl", JSON.stringify(crawlSummary));
  console.log("indexed_sermons", indexed);
  console.log("chunks_written_this_run", chunks);
  console.log("full_text_count_after", fullTextCount ?? 0);
  console.log("sermon_chunks_count_after", chunkCount ?? 0);
  console.log("crawl_errors", crawlResults.filter((r) => r.status === "error").length);
  console.log("index_errors", indexErrors.length);

  if (crawlResults.some((r) => r.status === "error")) {
    console.log("\nCRAWL_ERRORS_DETAIL");
    for (const r of crawlResults.filter((x) => x.status === "error")) {
      console.log("-", r.title, ":", r.detail);
    }
  }

  if (indexErrors.length) {
    console.log("\nINDEX_ERRORS_DETAIL");
    for (const r of indexErrors) {
      console.log("-", r.title, ":", r.error);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
