/** URL for the public series listing page (query must stay in sync with `src/app/series/page.tsx`). */
export function seriesListHref(series: string): string {
  const params = new URLSearchParams();
  params.set("series", series.trim());
  return `/series?${params.toString()}`;
}
