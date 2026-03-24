/**
 * Build embeddable viewer URLs for Google Drive / Docs / Sheets / Slides.
 * Files must be accessible to the viewer (e.g. “Anyone with the link” or signed-in user).
 */

export type DriveEmbedInfo = {
  embedUrl: string;
  kind: "drive-file" | "google-doc" | "google-sheet" | "google-slide";
};

/**
 * Returns an iframe-safe preview URL, or null if we only have a folder or unrecognized link.
 */
export function getGoogleDriveEmbedInfo(url: string): DriveEmbedInfo | null {
  const raw = url.trim();
  if (!raw) return null;

  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");

    // --- docs.google.com (Docs, Sheets, Slides) ---
    if (host === "docs.google.com") {
      const m = u.pathname.match(/\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
      if (m) {
        const [, gtype, id] = m;
        if (gtype === "presentation") {
          return {
            kind: "google-slide",
            embedUrl: `https://docs.google.com/presentation/d/${id}/embed`,
          };
        }
        if (gtype === "spreadsheets") {
          return {
            kind: "google-sheet",
            embedUrl: `https://docs.google.com/spreadsheets/d/${id}/preview`,
          };
        }
        return {
          kind: "google-doc",
          embedUrl: `https://docs.google.com/document/d/${id}/preview`,
        };
      }
    }

    // --- drive.google.com ---
    if (host === "drive.google.com") {
      const fileMatch = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) {
        const id = fileMatch[1];
        return {
          kind: "drive-file",
          embedUrl: `https://drive.google.com/file/d/${id}/preview`,
        };
      }

      if (u.pathname.includes("/folders/")) {
        return null;
      }

      const openId = u.searchParams.get("id");
      if (openId && (u.pathname === "/open" || u.pathname.startsWith("/open"))) {
        return {
          kind: "drive-file",
          embedUrl: `https://drive.google.com/file/d/${openId}/preview`,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Shared Drive folders cannot be embedded as a single document. */
export function isDriveFolderUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.hostname.replace(/^www\./, "") === "drive.google.com" && u.pathname.includes("/folders/");
  } catch {
    return false;
  }
}
