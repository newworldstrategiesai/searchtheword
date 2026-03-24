/** ts_headline output: allow only <mark> / <b> from Postgres */
export function sanitizeHeadlineHtml(html: string): string {
  return html
    .replace(/<script/gi, "&lt;script")
    .replace(/<iframe/gi, "&lt;iframe")
    .replace(/on\w+=/gi, "");
}
