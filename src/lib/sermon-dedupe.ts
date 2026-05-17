import type { SupabaseClient } from "@supabase/supabase-js";
import { extractGoogleDriveFileId } from "@/lib/google-drive-embed";

export type SermonDedupeRow = {
  id: string;
  title: string;
  preacher: string;
  date: string | null;
  external_id: string | null;
  google_drive_url: string | null;
  media_url: string | null;
  full_text: string | null;
  summary: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DedupeGroupPlan = {
  keeperId: string;
  keeperTitle: string;
  deleteIds: string[];
  matchReason: string;
};

export type SermonDedupePlan = {
  totalSermons: number;
  duplicateGroups: number;
  toDelete: number;
  toKeep: number;
  groups: DedupeGroupPlan[];
};

const SERMON_SELECT =
  "id, title, preacher, date, external_id, google_drive_url, media_url, full_text, summary, created_at, updated_at";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function driveFileId(row: SermonDedupeRow): string | null {
  const g = row.google_drive_url?.trim();
  if (g) {
    const id = extractGoogleDriveFileId(g);
    if (id) return id;
  }
  const m = row.media_url?.trim();
  if (m) return extractGoogleDriveFileId(m);
  return null;
}

function metaKey(row: SermonDedupeRow): string {
  return `meta:${norm(row.title)}|${norm(row.preacher)}|${row.date ?? ""}`;
}

function groupKeysForRow(row: SermonDedupeRow): string[] {
  const keys: string[] = [metaKey(row)];
  const ext = row.external_id?.trim();
  if (ext) keys.push(`ext:${ext}`);
  const fid = driveFileId(row);
  if (fid) keys.push(`drive:${fid}`);
  return keys;
}

class UnionFind {
  private parent = new Map<string, string>();

  find(id: string): string {
    if (!this.parent.has(id)) this.parent.set(id, id);
    let root = this.parent.get(id)!;
    if (root !== id) {
      root = this.find(root);
      this.parent.set(id, root);
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

/** Prefer external_id, richest text, then oldest created_at. */
export function pickKeeperSermon(rows: SermonDedupeRow[]): SermonDedupeRow {
  return [...rows].sort((a, b) => {
    const score = (r: SermonDedupeRow) =>
      (r.external_id?.trim() ? 1_000_000 : 0) +
      (r.full_text?.length ?? 0) +
      (r.summary?.length ?? 0);
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    const ca = a.created_at ?? "";
    const cb = b.created_at ?? "";
    return ca.localeCompare(cb);
  })[0]!;
}

export function planSermonDedupe(rows: SermonDedupeRow[]): SermonDedupePlan {
  const uf = new UnionFind();
  const byId = new Map<string, SermonDedupeRow>();
  for (const row of rows) {
    byId.set(row.id, row);
    uf.find(row.id);
  }

  const keyToIds = new Map<string, string[]>();
  for (const row of rows) {
    for (const key of groupKeysForRow(row)) {
      const list = keyToIds.get(key) ?? [];
      list.push(row.id);
      keyToIds.set(key, list);
    }
  }

  for (const ids of keyToIds.values()) {
    if (ids.length < 2) continue;
    const first = ids[0]!;
    for (let i = 1; i < ids.length; i++) {
      uf.union(first, ids[i]!);
    }
  }

  const components = new Map<string, string[]>();
  for (const row of rows) {
    const root = uf.find(row.id);
    const list = components.get(root) ?? [];
    list.push(row.id);
    components.set(root, list);
  }

  const groups: DedupeGroupPlan[] = [];
  let toDelete = 0;

  for (const ids of components.values()) {
    if (ids.length < 2) continue;
    const members = ids.map((id) => byId.get(id)!).filter(Boolean);
    const keeper = pickKeeperSermon(members);
    const deleteIds = ids.filter((id) => id !== keeper.id);
    toDelete += deleteIds.length;

    const reasons: string[] = [];
    if (members.some((m) => m.external_id?.trim())) reasons.push("external_id");
    if (members.some((m) => driveFileId(m))) reasons.push("google_drive");
    reasons.push("title+speaker+date");

    groups.push({
      keeperId: keeper.id,
      keeperTitle: keeper.title,
      deleteIds,
      matchReason: [...new Set(reasons)].join(", "),
    });
  }

  groups.sort((a, b) => a.keeperTitle.localeCompare(b.keeperTitle));

  return {
    totalSermons: rows.length,
    duplicateGroups: groups.length,
    toDelete,
    toKeep: rows.length - toDelete,
    groups,
  };
}

export async function fetchAllSermonsForDedupe(supabase: SupabaseClient): Promise<SermonDedupeRow[]> {
  const pageSize = 500;
  const all: SermonDedupeRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("sermons")
      .select(SERMON_SELECT)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...(data as SermonDedupeRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

export async function runSermonDedupe(
  supabase: SupabaseClient,
  options: { dryRun: boolean; batchSize?: number },
): Promise<SermonDedupePlan & { deleted: number }> {
  const rows = await fetchAllSermonsForDedupe(supabase);
  const plan = planSermonDedupe(rows);

  if (options.dryRun || plan.toDelete === 0) {
    return { ...plan, deleted: 0 };
  }

  const batchSize = options.batchSize ?? 50;
  const deleteIds = plan.groups.flatMap((g) => g.deleteIds);
  let deleted = 0;

  for (let i = 0; i < deleteIds.length; i += batchSize) {
    const batch = deleteIds.slice(i, i + batchSize);
    const { error } = await supabase.from("sermons").delete().in("id", batch);
    if (error) throw new Error(error.message);
    deleted += batch.length;
  }

  return { ...plan, deleted };
}
