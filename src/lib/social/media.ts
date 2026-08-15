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
// Hard safety net against runaway memory use / tab crashes: real estate
// photography (drone shots, panoramas) often compresses to a modest file
// size while still being 50-100+ megapixels. Decoding that at full
// resolution before downscaling can allocate hundreds of MB to a few GB for
// a single photo, which is what was crashing the browser/OS on selection.
const MAX_SOURCE_MEGAPIXELS = 40_000_000;
// Guards against a decode that never fires onload/onerror (e.g. an
// unsupported/corrupt file) so the upload flow can't hang forever with the
// file input stuck disabled.
const IMAGE_DECODE_TIMEOUT_MS = 20_000;
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
 * Decode + downscale using createImageBitmap's resize options where
 * available. Browsers implement this with scaled/streaming decoders (e.g.
 * libjpeg-turbo's scaled IDCT), so a huge source image is never fully
 * materialized in memory at native resolution — unlike an <img> + canvas
 * pipeline, which must decode at full size before it can draw anything.
 */
async function compressViaImageBitmap(file: File): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function") return null;
  let full: ImageBitmap;
  try {
    full = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    // createImageBitmap's resize options don't require materializing the
    // full-resolution bitmap first, so even absurdly large sources are safe
    // to downscale here (unlike the <img>+canvas fallback below).
    const { width, height } = targetDimensions(full.width, full.height);
    let resized: ImageBitmap;
    try {
      resized = await createImageBitmap(file, { resizeWidth: width, resizeHeight: height, resizeQuality: "medium" });
    } catch {
      resized = full;
    }
    try {
      const blob = await canvasToJpegBlob(resized, resized.width, resized.height);
      return blob;
    } finally {
      resized.close();
    }
  } finally {
    full.close();
  }
}

/** Fallback path for browsers without createImageBitmap resize support. */
function compressViaImageElement(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;

    const finish = (result: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), IMAGE_DECODE_TIMEOUT_MS);

    img.onload = () => {
      void (async () => {
        try {
          const origWidth = img.naturalWidth || img.width;
          const origHeight = img.naturalHeight || img.height;
          if (!origWidth || !origHeight) return finish(null);
          if (origWidth * origHeight > MAX_SOURCE_MEGAPIXELS) {
            // Too large to safely decode/draw at native resolution in this
            // fallback path (no resize-on-decode available) — bail out to the
            // original file rather than risk crashing the tab.
            return finish(null);
          }
          const { width, height } = targetDimensions(origWidth, origHeight);
          const blob = await canvasToJpegBlob(img, width, height);
          finish(blob);
        } catch {
          finish(null);
        }
      })();
    };
    img.onerror = () => finish(null);
    img.src = objectUrl;
  });
}

/**
 * Fast, non-blocking in-browser image compression. Prefers
 * createImageBitmap's native resize-on-decode (memory-safe for huge source
 * images); falls back to an <img>+canvas pipeline with a hard megapixel cap
 * and decode timeout so a pathological file can't hang or crash the tab.
 * Avoids CPU-locking loops, atob(), or massive base64 allocations.
 */
export async function compressImageToBlob(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;

  const viaBitmap = await compressViaImageBitmap(file);
  if (viaBitmap) return viaBitmap;

  const viaElement = await compressViaImageElement(file);
  if (viaElement) return viaElement;

  return file;
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
