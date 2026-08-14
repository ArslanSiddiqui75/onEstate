import { NextResponse } from "next/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

/** Max file size the upload route will accept (10 MB — same limit as the bucket). */
const MAX_BYTES = 10 * 1024 * 1024;

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the 10 MB upload limit.` },
      { status: 413 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  const ext = mimeType.split("/")[1]?.split("+")[0] || "bin";
  const filename = `${profile.orgId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("social-media")
    .upload(filename, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("[upload-media] storage upload error:", uploadError);
    return NextResponse.json(
      {
        error: uploadError.message.includes("Bucket not found")
          ? "The 'social-media' Storage bucket does not exist. Create it in the Supabase dashboard (Storage → New bucket, name: social-media, public: enabled)."
          : uploadError.message,
      },
      { status: 502 },
    );
  }

  const { data: urlData } = supabase.storage.from("social-media").getPublicUrl(filename);

  return NextResponse.json({ publicUrl: urlData.publicUrl });
}
