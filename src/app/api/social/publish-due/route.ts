import { NextResponse } from "next/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { publishDuePosts } from "@/lib/social/publish-service";

// Hobby Vercel only allows daily platform crons. Opening Social (or hitting
// this route) flushes due posts for the signed-in org so schedules still work.
export const maxDuration = 60;

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const summary = await publishDuePosts(25, profile.orgId);
  return NextResponse.json({ ok: true, ...summary });
}
