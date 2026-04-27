import { createRequire } from "node:module";
import { google } from "googleapis";
import mammoth from "mammoth";

type PdfParseResult = { text: string };
type PdfParse = (dataBuffer: Buffer) => Promise<PdfParseResult>;

const require = createRequire(import.meta.url);

function parseServiceAccount():
  | { client_email: string; private_key: string }
  | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!j.client_email || !j.private_key) return null;
    return { client_email: j.client_email, private_key: j.private_key };
  } catch {
    return null;
  }
}

export function googleDriveExportConfigured(): boolean {
  return parseServiceAccount() !== null;
}

export function getGoogleServiceAccountEmail(): string | null {
  return parseServiceAccount()?.client_email ?? null;
}

function createDrive() {
  const creds = parseServiceAccount();
  if (!creds) return null;
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return Buffer.from(String(data ?? ""));
}

async function downloadDriveFileAsBuffer(fileId: string): Promise<Buffer> {
  const drive = createDrive();
  if (!drive) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  }

  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );

  return toBuffer(res.data);
}

/**
 * Export a native Google Doc, Sheet, or Slides file to plain text (CSV for sheets).
 * Requires the file to be shared with the service account (client_email) or accessible via Shared Drive membership.
 */
export async function fetchNativeGoogleFileAsPlaintext(
  fileId: string,
): Promise<
  { ok: true; text: string; name?: string } | { ok: false; error: string }
> {
  const drive = createDrive();
  if (!drive) {
    return { ok: false, error: "GOOGLE_SERVICE_ACCOUNT_JSON is not configured" };
  }

  let meta: { name?: string | null; mimeType?: string | null };
  try {
    const { data } = await drive.files.get({
      fileId,
      fields: "id,name,mimeType",
      supportsAllDrives: true,
    });
    if (!data?.mimeType) {
      return { ok: false, error: "Could not read file metadata from Drive" };
    }
    meta = data;
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? Number((e as { code?: number }).code) : undefined;
    const msg = e instanceof Error ? e.message : "Drive API error";
    if (code === 403 || code === 404) {
      const email = getGoogleServiceAccountEmail();
      return {
        ok: false,
        error: `${msg} Share the document (or a parent folder) with the service account${email ? ` (${email})` : ""}, or ensure it lives in a Shared Drive the account can access.`,
      };
    }
    return { ok: false, error: msg };
  }

  const mimeType = meta.mimeType;
  const exportMime: Record<string, string> = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
  };
  const targetMime = mimeType ? exportMime[mimeType] : undefined;
  if (!targetMime) {
    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      try {
        const buffer = await downloadDriveFileAsBuffer(fileId);
        const result = await mammoth.extractRawText({ buffer });
        const text = result.value.trim();
        if (!text) {
          return { ok: false, error: "Extracted Word document content is empty" };
        }
        return { ok: true, text, name: meta.name ?? undefined };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Word document extraction failed";
        return { ok: false, error: msg };
      }
    }

    if (mimeType === "application/pdf") {
      try {
        const buffer = await downloadDriveFileAsBuffer(fileId);
        // Use the library entrypoint directly; the package root runs a debug harness when bundled.
        const pdfParse = require("pdf-parse/lib/pdf-parse.js") as PdfParse;
        const result = await pdfParse(buffer);
        const text = result.text.trim();
        if (!text) {
          return { ok: false, error: "Extracted PDF content is empty" };
        }
        return { ok: true, text, name: meta.name ?? undefined };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "PDF extraction failed";
        return { ok: false, error: msg };
      }
    }

    return {
      ok: false,
      error: `File type "${mimeType ?? "unknown"}" cannot be auto-exported. Use a native Google Doc/Sheet/Slide, PDF, DOCX, or paste a transcript into full_text.`,
    };
  }

  try {
    const res = await drive.files.export(
      { fileId, mimeType: targetMime },
      { responseType: "text" },
    );
    const text = typeof res.data === "string" ? res.data : String(res.data ?? "");
    const t = text.trim();
    if (!t) {
      return { ok: false, error: "Exported content is empty" };
    }
    return { ok: true, text: t, name: meta.name ?? undefined };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Export failed";
    return { ok: false, error: msg };
  }
}
