import { NextResponse } from "next/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { publishSocialPost } from "@/lib/social/publish-service";

// Publishing polls the platform (e.g. Instagram's container status_code)
// before calling media_publish, which can take tens of seconds. Without this,
// Vercel's default function duration can kill the request before it ever
// gets a chance to respond, leaving the client's "Publish now" button stuck.
export const maxDuration = 60;

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
