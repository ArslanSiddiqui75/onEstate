import type { SocialMediaItem, SocialPlatform } from "@/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
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
// file_size_limit (10MB). Uploads go straight to Storage via a signed URL
// (not through the Vercel function body), so the old ~4.5MB edge limit no
// longer applies — but the bucket itself still caps at 10MB.
const MAX_VIDEO_BYTES = 10 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 90_000;

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
 * Uploads media to Supabase Storage using a signed URL.
 * The file bytes go browser → Storage (never through the Next.js/Vercel
 * function body), which avoids Vercel's ~4.5MB request limit that caused
 * 413s on mid-size videos.
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

  let uploadBlob: Blob = file;
  let mimeType = file.type || "application/octet-stream";

  if (isImage) {
    uploadBlob = await compressImageToBlob(file);
    if (wasCompressed(uploadBlob)) mimeType = "image/jpeg";
  }

  if (uploadBlob.size > MAX_IMAGE_BYTES) {
    throw new Error("File exceeds the 10 MB upload limit after processing.");
  }

  const token = await getToken();
  if (!token) {
    throw new Error("Sign in required to upload media.");
  }

  const safeName =
    isImage && wasCompressed(uploadBlob)
      ? file.name.replace(/\.[^.]+$/, ".jpg")
      : file.name;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const signRes = await fetch("/api/social/upload-media", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mimeType,
        fileName: safeName,
        sizeBytes: uploadBlob.size,
      }),
      signal: controller.signal,
    });

    const signed = (await signRes.json().catch(() => ({}))) as {
      path?: string;
      token?: string;
      signedUrl?: string;
      publicUrl?: string;
      error?: string;
    };

    if (!signRes.ok || !signed.path || !signed.token || !signed.publicUrl) {
      throw new Error(
        signed.error ||
          `Upload failed (${signRes.status}: ${signRes.statusText || "Server error"})`,
      );
    }

    // Browser → Storage directly (official signed-upload API). File bytes never
    // touch the Vercel function body.
    const supabase = createBrowserSupabaseClient();
    const { error: putError } = await supabase.storage
      .from("social-media")
      .uploadToSignedUrl(signed.path, signed.token, uploadBlob, {
        contentType: mimeType,
      });

    if (putError) {
      throw new Error(putError.message || "Storage upload failed. Try a smaller file.");
    }

    return {
      id: newMediaId(),
      kind: isImage ? "image" : "video",
      name: file.name,
      mimeType,
      sizeBytes: uploadBlob.size,
      dataUrl: signed.publicUrl,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Upload timed out. Check your connection and try again.");
    }
    if (err instanceof Error) throw err;
    throw new Error("Upload failed. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
