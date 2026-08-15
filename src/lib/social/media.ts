import type { SocialMediaItem, SocialPlatform } from "@/types";

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "facebook",
  "linkedin",
  "x",
];

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
};

export const PLATFORM_HINT: Record<SocialPlatform, string> = {
  instagram: "Business or Creator account",
  facebook: "Page or profile",
  linkedin: "Company page or personal",
  x: "Profile",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// Kept in sync with the "social-media" Supabase Storage bucket's
// file_size_limit (10MB) and /api/social/upload-media's MAX_BYTES. A larger
// client-side limit here would let a video pass the Compose form's check and
// then fail (or hang past Vercel's serverless request body ceiling) at
// upload time, leaving the UI stuck.
const MAX_VIDEO_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.8;
// Vercel serverless functions enforce their own hard request timeout, but a
// dropped/stalled connection on the client side otherwise has no ceiling.
const UPLOAD_TIMEOUT_MS = 45_000;

function newMediaId() {
  return `media_${crypto.randomUUID()}`;
}

function targetDimensions(origWidth: number, origHeight: number) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(origWidth, origHeight));
  return {
    width: Math.max(1, Math.round(origWidth * scale)),
    height: Math.max(1, Math.round(origHeight * scale)),
  };
}

type Dimensions = { width: number; height: number };

// --- Header-only dimension sniffing --------------------------------------
// IMPORTANT: we must know an image's pixel dimensions *before* calling
// createImageBitmap/decoding it, so we can pass resize hints on the very
// first (and only) decode call. Calling createImageBitmap(file) without
// resize options — even just to read .width/.height — forces the browser to
// decode at full native resolution, which is exactly the memory spike that
// crashes the tab for huge real-estate photos (drone/panorama shots with a
// modest file size but 50-100+ megapixels). Reading a few bytes of the file
// header is essentially free by comparison.

function sniffPngDimensions(view: DataView, bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 24) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

function sniffGifDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (bytes.length < 10) return null;
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
  if (sig !== "GIF87a" && sig !== "GIF89a") return null;
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function sniffWebpDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (bytes.length < 30) return null;
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "RIFF") return null;
  if (String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) !== "WEBP") return null;
  const fourcc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (fourcc === "VP8 ") {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  if (fourcc === "VP8L") {
    const b0 = bytes[21], b1 = bytes[22], b2 = bytes[23], b3 = bytes[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }
  if (fourcc === "VP8X") {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }
  return null;
}

function sniffJpegDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    // Padding byte or standalone marker with no length/payload.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) break; // Start of Scan — no more headers before pixel data
    if (offset + 4 > bytes.length) break;
    const segmentLength = view.getUint16(offset + 2, false);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (offset + 9 > bytes.length) return null;
      return { height: view.getUint16(offset + 5, false), width: view.getUint16(offset + 7, false) };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

async function sniffImageDimensions(file: File): Promise<Dimensions | null> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dims =
      sniffPngDimensions(view, bytes) ||
      sniffGifDimensions(bytes, view) ||
      sniffWebpDimensions(bytes, view) ||
      sniffJpegDimensions(bytes, view);
    if (!dims || !dims.width || !dims.height) return null;
    return dims;
  } catch {
    return null;
  }
}

function canvasToJpegBlob(source: CanvasImageSource, width: number, height: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
}

/**
 * Decode + downscale using createImageBitmap's resize-on-decode. Crucially,
 * resize hints are passed on the *first and only* createImageBitmap call —
 * using dimensions sniffed from the file's header without decoding — so
 * browsers can use scaled decode paths (e.g. libjpeg's scaled IDCT) instead
 * of ever materializing the full-resolution bitmap in memory. A prior
 * version of this function called createImageBitmap(file) once *without*
 * resize options just to read width/height, which forces a full-resolution
 * decode anyway and defeats the entire point — that was the actual cause of
 * the browser/OS crashing on large real-estate photos.
 */
async function compressViaImageBitmap(file: File): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function") return null;

  const sniffed = await sniffImageDimensions(file);
  if (!sniffed) {
    // Unknown/unsniffable format (e.g. HEIC, BMP, TIFF) — we have no safe way
    // to know the pixel dimensions without a full decode, so don't attempt
    // compression at all rather than risk decoding an unbounded image.
    return null;
  }
  // Sanity cap against corrupt/adversarial headers claiming absurd
  // dimensions (a "decompression bomb") — resize-on-decode makes normal
  // large photos safe, but there's no reason to trust arbitrary values.
  if (sniffed.width * sniffed.height > 500_000_000) return null;

  const { width, height } = targetDimensions(sniffed.width, sniffed.height);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { resizeWidth: width, resizeHeight: height, resizeQuality: "medium" });
  } catch {
    return null;
  }
  try {
    return await canvasToJpegBlob(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/**
 * Fast, non-blocking in-browser image compression via createImageBitmap's
 * resize-on-decode (memory-safe even for huge source images). If the format
 * can't be safely sized up front, or the browser lacks support, the original
 * file is uploaded unmodified rather than risking an unbounded full-resolution
 * decode. Avoids CPU-locking loops, atob(), or massive base64 allocations.
 */
export async function compressImageToBlob(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;

  const compressed = await compressViaImageBitmap(file);
  return compressed || file;
}

/**
 * Local / demo fallback that converts a file to a SocialMediaItem.
 */
export async function fileToSocialMedia(file: File): Promise<SocialMediaItem> {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    throw new Error("Only images and videos can be uploaded to social posts.");
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be under 10MB.");
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    throw new Error("Videos must be under 10MB.");
  }

  if (isImage) {
    const blob = await compressImageToBlob(file);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read image preview"));
      reader.readAsDataURL(blob);
    });

    return {
      id: newMediaId(),
      kind: "image",
      name: file.name,
      mimeType: "image/jpeg",
      sizeBytes: blob.size,
      dataUrl,
      createdAt: new Date().toISOString(),
    };
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read video preview"));
    reader.readAsDataURL(file);
  });

  return {
    id: newMediaId(),
    kind: "video",
    name: file.name,
    mimeType: file.type || "video/mp4",
    sizeBytes: file.size,
    dataUrl,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Uploads media directly to Supabase Storage via `/api/social/upload-media`.
 * Never stores heavy base64 strings in the database.
 */
export async function uploadSocialMediaFile(
  file: File,
  getToken: () => Promise<string | null>,
): Promise<SocialMediaItem> {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    throw new Error("Only images and videos can be uploaded to social posts.");
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be under 10MB.");
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    throw new Error("Videos must be under 10MB.");
  }

  // Fast client-side image compression
  let uploadBlob: Blob = file;
  let mimeType = file.type || "application/octet-stream";

  if (isImage) {
    uploadBlob = await compressImageToBlob(file);
    mimeType = "image/jpeg";
  }

  const token = await getToken();
  const form = new FormData();
  const safeName = isImage ? file.name.replace(/\.[^.]+$/, ".jpg") : file.name;
  form.append("file", uploadBlob, safeName);

  // A stalled request (dropped connection, oversized body silently held open
  // by an intermediary, etc.) must not hang the Compose form forever with the
  // file input disabled and the button stuck on "Uploading…".
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("/api/social/upload-media", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Upload timed out. Check your connection and try again.");
    }
    throw new Error(err instanceof Error ? err.message : "Upload failed. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  const json = (await res.json().catch(() => ({}) as Record<string, unknown>)) as {
    publicUrl?: string;
    error?: string;
  };

  if (!res.ok || !json.publicUrl) {
    throw new Error(json.error || `Upload failed (${res.status}: ${res.statusText || "Server error"})`);
  }

  return {
    id: newMediaId(),
    kind: isImage ? "image" : "video",
    name: file.name,
    mimeType,
    sizeBytes: uploadBlob.size,
    dataUrl: json.publicUrl,
    createdAt: new Date().toISOString(),
  };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
