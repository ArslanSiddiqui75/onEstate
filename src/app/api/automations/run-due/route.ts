import { NextResponse } from "next/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { processAutomationRuns } from "@/lib/automations/engine";

export const maxDuration = 60;

/**
 * Flush this org's due automation runs. Called when the CRM opens so waits
 * still advance on hosting plans without frequent cron (mirrors the Social
 * module's publish-due workaround).
 */
export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const summary = await processAutomationRuns(supabase, { orgId: profile.orgId });
  return NextResponse.json({ ok: true, ...summary });
}
