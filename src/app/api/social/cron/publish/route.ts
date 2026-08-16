import { NextResponse } from "next/server";
import { publishDuePosts } from "@/lib/social/publish-service";

// Publishing polls each platform's processing status before publishing (see
// waitForContainerReady in providers.ts), which can take tens of seconds per
// post. Give the function room instead of letting the platform kill it mid-
// batch. Raise this further on plans that allow longer function durations.
export const maxDuration = 60;

// Point Vercel Cron (vercel.json) or an external scheduler at this route every
// few minutes so "Schedule" posts actually go out. There is no in-process
// timer — without a hit to this route, due posts stay `scheduled` forever.
async function handle(request: Request) {
  const socialSecret = process.env.SOCIAL_CRON_SECRET;
  const vercelCronSecret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const providedHeader = request.headers.get("x-cron-secret");
  const providedQuery = url.searchParams.get("secret");
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  // Vercel always sets this on Cron invocations. It does NOT automatically
  // send SOCIAL_CRON_SECRET — only Authorization: Bearer <CRON_SECRET> when
  // that env var exists. Without accepting this header (or setting
  // CRON_SECRET), every scheduled run 401s and posts stay stuck.
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  const expected = [socialSecret, vercelCronSecret].filter(Boolean) as string[];
  if (expected.length > 0) {
    const ok =
      isVercelCron ||
      (providedHeader && expected.includes(providedHeader)) ||
      (providedQuery && expected.includes(providedQuery)) ||
      (bearer && expected.includes(bearer));
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const summary = await publishDuePosts();
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
