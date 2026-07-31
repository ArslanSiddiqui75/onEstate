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

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
