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

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.72;

function newMediaId() {
  return `media_${crypto.randomUUID()}`;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

async function compressImage(file: File): Promise<{ dataUrl: string; sizeBytes: number; mimeType: string }> {
  const raw = await readAsDataUrl(file);
  const img = await loadImage(raw);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  const mimeType = "image/jpeg";
  const dataUrl = canvas.toDataURL(mimeType, JPEG_QUALITY);
  const sizeBytes = Math.round((dataUrl.length * 3) / 4);
  return { dataUrl, sizeBytes, mimeType };
}

export async function fileToSocialMedia(file: File): Promise<SocialMediaItem> {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    throw new Error("Only images and videos can be uploaded to social posts.");
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be under 6MB.");
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    throw new Error("Videos must be under 8MB for local scheduling.");
  }

  if (isImage) {
    const compressed = await compressImage(file);
    return {
      id: newMediaId(),
      kind: "image",
      name: file.name,
      mimeType: compressed.mimeType,
      sizeBytes: compressed.sizeBytes,
      dataUrl: compressed.dataUrl,
      createdAt: new Date().toISOString(),
    };
  }

  const dataUrl = await readAsDataUrl(file);
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
 * Upload a file to the server's `/api/social/upload-media` route (Supabase Storage)
 * and return a SocialMediaItem whose `dataUrl` is the public storage URL.
 * This avoids storing multi-megabyte base64 blobs in the database JSONB column.
 *
 * @param file      The raw File object chosen by the user.
 * @param getToken  Async function that returns the current auth Bearer token.
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

  // For images, compress first so we send a smaller payload to the server.
  let blob: Blob;
  let mimeType: string;
  let sizeBytes: number;

  if (isImage) {
    const compressed = await compressImage(file);
    // Convert the compressed data URL back to a Blob for the multipart upload.
    const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(compressed.dataUrl);
    if (!match) throw new Error("Compression produced an unexpected result.");
    const binary = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    blob = new Blob([binary], { type: compressed.mimeType });
    mimeType = compressed.mimeType;
    sizeBytes = compressed.sizeBytes;
  } else {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error("Videos must be under 8 MB for local scheduling.");
    }
    blob = file;
    mimeType = file.type || "video/mp4";
    sizeBytes = file.size;
  }

  const token = await getToken();
  const form = new FormData();
  form.append("file", blob, file.name);

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
    throw new Error(json.error || "Media upload failed.");
  }

  return {
    id: newMediaId(),
    kind: isImage ? "image" : "video",
    name: file.name,
    mimeType,
    sizeBytes,
    dataUrl: json.publicUrl,
    createdAt: new Date().toISOString(),
  };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
