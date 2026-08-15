import type { SocialMediaItem, SocialPlatform } from "@/types";
import { compressImageBlob } from "./image-compress-core";

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
// Vercel serverless functions enforce their own hard request timeout, but a
// dropped/stalled connection on the client side otherwise has no ceiling.
const UPLOAD_TIMEOUT_MS = 45_000;

function newMediaId() {
  return `media_${crypto.randomUUID()}`;
}

/**
 * Fast, non-blocking in-browser image compression (see
 * image-compress-core.ts for the actual decode/resize logic). Reads pixel
 * dimensions from the file's header bytes — no decode required — so
 * createImageBitmap is only ever called once, already carrying resize hints.
 * This means the browser can use a scaled decode path instead of ever
 * materializing a huge source image (e.g. a modest-file-size drone/panorama
 * photo with 50-100+ megapixels) at full native resolution, which is what
 * was crashing the tab. Formats that can't be safely sized up front (HEIC,
 * BMP, TIFF, ...) are uploaded unmodified rather than risking an unbounded
 * decode. Avoids CPU-locking loops, atob(), or massive base64 allocations.
 */
export async function compressImageToBlob(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;

  const compressed = await compressImageBlob(file);
  return compressed || file;
}

/** True when compressImageToBlob actually re-encoded the image as JPEG. */
function wasCompressed(blob: Blob): boolean {
  return blob.type === "image/jpeg";
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
      mimeType: wasCompressed(blob) ? "image/jpeg" : file.type || "application/octet-stream",
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
    if (wasCompressed(uploadBlob)) mimeType = "image/jpeg";
  }

  const token = await getToken();
  const form = new FormData();
  const safeName = isImage && wasCompressed(uploadBlob) ? file.name.replace(/\.[^.]+$/, ".jpg") : file.name;
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
