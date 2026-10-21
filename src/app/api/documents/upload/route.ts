import { NextResponse } from "next/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoAnyModule } from "@/lib/server/require-module";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const denied = forbiddenIfNoAnyModule(profile, [
    ["crm", "edit"],
    ["listings", "edit"],
    ["transactions", "edit"],
  ]);
  if (denied) return denied;

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    fileName?: string;
    mimeType?: string;
  } | null;
  const ext =
    body?.fileName?.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "bin";
  const path = `${profile.orgId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Could not create upload URL" },
      { status: 502 },
    );
  }
  return NextResponse.json({
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    mimeType: body?.mimeType,
  });
}
