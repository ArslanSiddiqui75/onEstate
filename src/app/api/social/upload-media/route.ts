import { NextResponse } from "next/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

/** Max file size we authorize for a signed upload (matches the storage bucket). */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Issues a short-lived signed upload URL so the browser can PUT the file
 * straight to Supabase Storage. The file body never passes through Vercel
 * (whose ~4.5MB request limit was causing 413s on mid-size videos).
 *
 * Body (JSON): { mimeType: string, fileName?: string, sizeBytes?: number }
 * Returns: { path, token, signedUrl, publicUrl }
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

  const body = (await request.json().catch(() => null)) as {
    mimeType?: string;
    fileName?: string;
    sizeBytes?: number;
  } | null;

  if (!body?.mimeType) {
    return NextResponse.json(
      { error: "Expected JSON body with mimeType." },
      { status: 400 },
    );
  }

  if (
    typeof body.sizeBytes === "number" &&
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

  const mimeType = body.mimeType || "application/octet-stream";
  if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Only images and videos can be uploaded." },
      { status: 400 },
    );
  }

  const fromName = body.fileName?.split(".").pop()?.toLowerCase();
  const fromMime = mimeType.split("/")[1]?.split("+")[0]?.toLowerCase();
  const ext = (fromName && /^[a-z0-9]{1,8}$/.test(fromName) ? fromName : null) || fromMime || "bin";
  const path = `${profile.orgId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

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
