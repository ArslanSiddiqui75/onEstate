import { NextResponse } from "next/server";
import { publishDuePosts } from "@/lib/social/publish-service";

// Point an external scheduler (Vercel Cron, GitHub Actions, cron-job.org, …)
// at this route every few minutes so "Schedule" posts actually go out at
// their scheduled time — there is no built-in server process otherwise.
async function handle(request: Request) {
  const secret = process.env.SOCIAL_CRON_SECRET;
  const provided =
    request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret");
  if (secret && provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await publishDuePosts();
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
