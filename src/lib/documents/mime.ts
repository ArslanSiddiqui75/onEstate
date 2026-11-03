/** Allowed document MIME types (server-side allowlist). */
export const ALLOWED_DOCUMENT_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "application/rtf",
  "text/rtf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
]);

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  rtf: "application/rtf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
};

export function mimeFromExtension(ext: string): string | undefined {
  return EXT_TO_MIME[ext.toLowerCase()];
}

/** Prefer client claim only when it matches the extension mapping; else use extension. */
export function resolveDocumentMime(input: {
  ext: string;
  claimed?: string | null;
}): string | null {
  const fromExt = mimeFromExtension(input.ext);
  if (!fromExt) return null;
  const claimed = (input.claimed || "").trim().toLowerCase();
  if (claimed && ALLOWED_DOCUMENT_MIME.has(claimed)) {
    // Reject spoofed MIME that disagrees with the extension family.
    const claimFamily = claimed.split("/")[0];
    const extFamily = fromExt.split("/")[0];
    if (claimFamily === extFamily || claimed === fromExt) return claimed;
  }
  return fromExt;
}
