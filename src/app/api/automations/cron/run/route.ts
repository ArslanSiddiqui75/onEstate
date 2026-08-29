import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { processAutomationRuns } from "@/lib/automations/engine";

export const maxDuration = 60;

/**
 * Point an external scheduler (cron-job.org) or Vercel Cron here every few
 * minutes. Without a hit to this route, `wait` steps never resume.
 * Auth mirrors /api/social/cron/publish so one secret covers both schedulers.
 */
async function handle(request: Request) {
  const automationSecret = process.env.AUTOMATION_CRON_SECRET;
  const socialSecret = process.env.SOCIAL_CRON_SECRET;
  const vercelCronSecret = process.env.CRON_SECRET;

  const url = new URL(request.url);
  const providedHeader = request.headers.get("x-cron-secret");
  const providedQuery = url.searchParams.get("secret");
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  const expected = [automationSecret, socialSecret, vercelCronSecret].filter(
    Boolean,
  ) as string[];

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

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const summary = await processAutomationRuns(supabase, { limit: 50 });
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
