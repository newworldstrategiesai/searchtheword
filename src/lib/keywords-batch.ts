import { createPublicSupabaseClient } from "@/lib/supabase/server";

/** Batch-load keyword names per sermon id for search results */
export async function getKeywordsForSermonIds(sermonIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!sermonIds.length) return map;

  const supabase = createPublicSupabaseClient();
  const { data: links, error } = await supabase
    .from("sermon_keywords")
    .select("sermon_id, keyword_id")
    .in("sermon_id", sermonIds);

  if (error || !links?.length) return map;

  const kwIds = [...new Set(links.map((l) => l.keyword_id as string))];
  const { data: names } = await supabase.from("keywords").select("id, name").in("id", kwIds);
  const idToName = new Map((names ?? []).map((k) => [k.id as string, k.name as string]));

  for (const row of links) {
    const sid = row.sermon_id as string;
    const name = idToName.get(row.keyword_id as string);
    if (!name) continue;
    const arr = map.get(sid) ?? [];
    arr.push(name);
    map.set(sid, arr);
  }

  return map;
}
