import { NextResponse } from "next/server";
import { clientIp } from "@/lib/http/client-ip";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";
import { forbiddenIfNoModule } from "@/lib/server/require-module";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { processAutomationRuns } from "@/lib/automations/engine";

export const maxDuration = 60;

const isRateLimited = createSlidingWindowLimiter({
  windowMs: 60_000,
  max: 20,
});

/**
 * Flush this org's due automation runs. Called when the CRM opens so waits
 * still advance on hosting plans without frequent cron (mirrors the Social
 * module's publish-due workaround).
 */
export async function POST(request: Request) {
  if (isRateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many automation runs. Try again shortly." },
      { status: 429 },
    );
  }

  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const denied = forbiddenIfNoModule(profile, "crm", "edit");
  if (denied) return denied;

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Due steps can’t be run yet." }, { status: 503 });
  }

  const summary = await processAutomationRuns(supabase, { orgId: profile.orgId });
  return NextResponse.json({ ok: true, ...summary });
}
