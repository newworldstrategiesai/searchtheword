/**
 * Plain text extraction from PDF bytes.
 * Loads pdf-parse via its submodule entry — the package root runs a debug harness when bundled.
 */
export async function extractPdfPlaintext(
  buffer: Buffer,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const mod = (await import(
      "pdf-parse/lib/pdf-parse.js"
    )) as { default?: (data: Buffer) => Promise<{ text: string }> };
    const fn = mod.default;
    if (typeof fn !== "function") {
      throw new Error("pdf-parse: missing default export");
    }
    const result = await fn(buffer);
    const text = typeof result?.text === "string" ? result.text.trim() : "";
    if (!text) return { ok: false, error: "Extracted PDF content is empty" };
    return { ok: true, text };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "PDF extraction failed";
    return { ok: false, error: msg };
  }
}
