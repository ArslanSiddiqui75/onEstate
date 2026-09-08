import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { processAutomationRuns } from "@/lib/automations/engine";
import { unauthorizedCronResponse } from "@/lib/server/cron-auth";

export const maxDuration = 60;

/**
 * Point an external scheduler (cron-job.org) or Vercel Cron here every few
 * minutes. Without a hit to this route, `wait` steps never resume.
 * Auth mirrors /api/social/cron/publish so one secret covers both schedulers.
 */
async function handle(request: Request) {
  const denied = unauthorizedCronResponse(request, [
    process.env.AUTOMATION_CRON_SECRET,
    process.env.SOCIAL_CRON_SECRET,
  ]);
  if (denied) return denied;

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const summary = await processAutomationRuns(supabase, { limit: 50 });
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
