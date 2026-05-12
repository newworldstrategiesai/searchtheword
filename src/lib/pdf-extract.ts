/**
 * Plain text extraction from PDF bytes.
 * Loads pdf-parse via its submodule entry — the package root runs a debug harness when bundled.
 */
export async function extractPdfPlaintext(
  buffer: Buffer,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see module comment above
    const pdfParse =
      require("pdf-parse/lib/pdf-parse.js") as (data: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    const text = typeof result?.text === "string" ? result.text.trim() : "";
    if (!text) return { ok: false, error: "Extracted PDF content is empty" };
    return { ok: true, text };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "PDF extraction failed";
    return { ok: false, error: msg };
  }
}
