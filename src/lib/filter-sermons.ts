import type { SermonSearchRow } from "@/lib/types";

/** Client-side date filtering when RPC does not receive date bounds (keeps URL simple). */
export function filterSermonResults(
  results: SermonSearchRow[],
  opts: { from?: string; to?: string },
): SermonSearchRow[] {
  let r = results;
  if (opts.from) {
    r = r.filter((x) => !x.date || x.date >= opts.from!);
  }
  if (opts.to) {
    r = r.filter((x) => !x.date || x.date <= opts.to!);
  }
  return r;
}
