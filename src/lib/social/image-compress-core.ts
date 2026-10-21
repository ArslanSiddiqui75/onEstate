// Image compression core, used by media.ts on the main thread. Uses
// createImageBitmap/OffscreenCanvas where available, with an HTMLCanvas
// fallback for older browsers.
//
// Design goals, in order:
// 1. Never fully decode a source image at native resolution. Real estate
//    photography (drone/panorama shots) routinely has a modest file size but
//    50-100+ megapixels; decoding that into a raw bitmap before downscaling
//    can allocate hundreds of MB to a few GB, which is what crashes a tab.
//    We avoid this by reading pixel dimensions from the file's header bytes
//    (no decode) and passing resize hints on the *only* createImageBitmap
//    call, so the browser can use a scaled decode path instead.
// 2. Never trust anything about the file's structure. All parsing is
//    bounds-checked and wrapped so a malformed file degrades to "skip
//    compression", never a thrown/uncaught exception or a hang.

const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.8;
// Sanity cap against corrupt/adversarial headers claiming absurd dimensions
// (a "decompression bomb") — resize-on-decode makes normal large photos
// safe, but there's no reason to trust arbitrary claimed values.
const MAX_CLAIMED_PIXELS = 500_000_000;

type Dimensions = { width: number; height: number };

function targetDimensions(origWidth: number, origHeight: number): Dimensions {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(origWidth, origHeight));
  return {
    width: Math.max(1, Math.round(origWidth * scale)),
    height: Math.max(1, Math.round(origHeight * scale)),
  };
}

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
  let guard = 0;
  // Hard iteration cap: a well-formed JPEG never needs more than a few
  // hundred marker segments before hitting SOF or SOS. This guarantees
  // termination even against a maliciously crafted file, independent of the
  // (already-proven-terminating) offset-advancement logic below.
  const MAX_ITERATIONS = 100_000;
  while (offset + 4 <= bytes.length && guard < MAX_ITERATIONS) {
    guard += 1;
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
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
    offset += Math.max(2, 2 + segmentLength);
  }
  return null;
}

async function sniffImageDimensions(file: File | Blob): Promise<Dimensions | null> {
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

async function bitmapToJpegBlob(bitmap: ImageBitmap): Promise<Blob | null> {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      return await canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
    }
    // Main-thread-only fallback (no OffscreenCanvas support).
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Compresses an image file, or returns null if it can't be safely compressed
 * (unsniffable format, corrupt header, decode failure, etc.) — callers should
 * fall back to uploading the original file in that case.
 */
export async function compressImageBlob(file: File | Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function") return null;

  const sniffed = await sniffImageDimensions(file);
  if (!sniffed) return null;
  if (sniffed.width * sniffed.height > MAX_CLAIMED_PIXELS) return null;

  const { width, height } = targetDimensions(sniffed.width, sniffed.height);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { resizeWidth: width, resizeHeight: height, resizeQuality: "medium" });
  } catch {
    return null;
  }
  try {
    return await bitmapToJpegBlob(bitmap);
  } finally {
    bitmap.close();
  }
}
