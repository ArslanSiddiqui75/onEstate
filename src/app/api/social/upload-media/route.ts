import { NextResponse } from "next/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type ServiceSupabase = NonNullable<ReturnType<typeof createServiceSupabaseClient>>;

/** Max file size we authorize for a signed upload (matches the storage bucket). */
const MAX_BYTES = 10 * 1024 * 1024;

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
};

function mimeFromFileName(fileName?: string | null): string | undefined {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  return EXT_MIME[ext];
}

function storagePath(orgId: string, mimeType: string, fileName?: string | null) {
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  const fromMime = mimeType.split("/")[1]?.split("+")[0]?.toLowerCase();
  const ext =
    (fromName && /^[a-z0-9]{1,8}$/.test(fromName) ? fromName : null) ||
    fromMime ||
    "bin";
  return `${orgId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
}

/**
 * Issues a short-lived signed upload URL so the browser can PUT the file
 * straight to Supabase Storage. The file body never passes through Vercel
 * (whose ~4.5MB request limit was causing 413s on mid-size videos).
 *
 * Preferred body (JSON): { mimeType: string, fileName?: string, sizeBytes?: number }
 * Returns: { path, token, signedUrl, publicUrl }
 *
 * Also accepts legacy multipart/form-data with a `file` field (cached clients)
 * and uploads through the server for small images.
 */
export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Storage is not configured on the server." },
      { status: 503 },
    );
  }

  const contentType = request.headers.get("content-type") || "";

  // Legacy clients (pre signed-URL) still POST the file as multipart. Support
  // that path so a stale browser tab does not hard-fail with a cryptic mimeType error.
  if (contentType.includes("multipart/form-data")) {
    return handleLegacyMultipart(request, supabase, profile.orgId);
  }

  const raw = await request.text().catch(() => "");
  let body: {
    mimeType?: string;
    fileName?: string;
    sizeBytes?: number;
  } | null = null;
  if (raw.trim()) {
    try {
      body = JSON.parse(raw) as {
        mimeType?: string;
        fileName?: string;
        sizeBytes?: number;
      };
    } catch {
      body = null;
    }
  }

  const mimeType =
    (typeof body?.mimeType === "string" && body.mimeType.trim()) ||
    mimeFromFileName(body?.fileName) ||
    "";

  if (!mimeType) {
    return NextResponse.json(
      {
        error:
          "Expected JSON body with mimeType (or a fileName with a known image/video extension). Hard-refresh the page (Ctrl+Shift+R) if this keeps happening.",
      },
      { status: 400 },
    );
  }

  if (
    typeof body?.sizeBytes === "number" &&
    (body.sizeBytes < 0 || body.sizeBytes > MAX_BYTES)
  ) {
    return NextResponse.json(
      {
        error:
          body.sizeBytes > MAX_BYTES
            ? "File exceeds the 10 MB upload limit."
            : "Invalid file size.",
      },
      { status: 413 },
    );
  }

  if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Only images and videos can be uploaded." },
      { status: 400 },
    );
  }

  const path = storagePath(profile.orgId, mimeType, body?.fileName);

  const { data, error } = await supabase.storage
    .from("social-media")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[upload-media] createSignedUploadUrl error:", error);
    return NextResponse.json(
      {
        error: error?.message?.includes("Bucket not found")
          ? "The 'social-media' Storage bucket does not exist. Create it in the Supabase dashboard (Storage → New bucket, name: social-media, public: enabled)."
          : error?.message || "Could not create upload URL",
      },
      { status: 502 },
    );
  }

  const { data: urlData } = supabase.storage.from("social-media").getPublicUrl(path);

  return NextResponse.json({
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl: urlData.publicUrl,
  });
}

async function handleLegacyMultipart(
  request: Request,
  supabase: ServiceSupabase,
  orgId: string,
) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a file field." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 10 MB upload limit." },
      { status: 413 },
    );
  }

  const fileName =
    typeof File !== "undefined" && file instanceof File ? file.name : undefined;
  const mimeType =
    file.type || mimeFromFileName(fileName) || "application/octet-stream";

  if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Only images and videos can be uploaded." },
      { status: 400 },
    );
  }

  const path = storagePath(orgId, mimeType, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("social-media")
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[upload-media] legacy storage upload error:", uploadError);
    return NextResponse.json(
      {
        error: uploadError.message.includes("Bucket not found")
          ? "The 'social-media' Storage bucket does not exist. Create it in the Supabase dashboard (Storage → New bucket, name: social-media, public: enabled)."
          : uploadError.message,
      },
      { status: 502 },
    );
  }

  const { data: urlData } = supabase.storage.from("social-media").getPublicUrl(path);
  return NextResponse.json({ publicUrl: urlData.publicUrl });
}
