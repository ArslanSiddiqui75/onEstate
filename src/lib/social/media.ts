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
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.8;

function newMediaId() {
  return `media_${crypto.randomUUID()}`;
}

/**
 * Fast, non-blocking in-browser image compression using native canvas.toBlob.
 * Avoids CPU-locking loops, atob(), or massive base64 allocations.
 */
export function compressImageToBlob(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    // Non-image files pass through directly
    if (!file.type.startsWith("image/")) {
      return resolve(file);
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const origWidth = img.naturalWidth || img.width;
        const origHeight = img.naturalHeight || img.height;

        if (!origWidth || !origHeight) {
          return resolve(file);
        }

        const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(origWidth, origHeight));
        const width = Math.max(1, Math.round(origWidth * scale));
        const height = Math.max(1, Math.round(origHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          JPEG_QUALITY,
        );
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
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
    throw new Error("Videos must be under 15MB.");
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
    throw new Error("Videos must be under 15MB.");
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

  const res = await fetch("/api/social/upload-media", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

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
