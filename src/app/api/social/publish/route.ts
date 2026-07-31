import { NextResponse } from "next/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { publishSocialPost } from "@/lib/social/publish-service";

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const postId = String(body.postId || "");
  if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

  const summary = await publishSocialPost(postId, profile.orgId);
  return NextResponse.json(
    { ok: summary.ok, message: summary.message, results: summary.results },
    { status: summary.ok ? 200 : 502 },
  );
}
