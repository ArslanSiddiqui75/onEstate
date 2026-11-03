import { NextResponse } from "next/server";
import { z } from "zod";
import {
  evaluateAndMaybeSuspendMessaging,
  loadOrgComplianceContext,
  setChannelSuspension,
} from "@/lib/messaging/compliance";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  const supabase = createServiceSupabaseClient();
  if (!supabase || !profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const ctx = await loadOrgComplianceContext(supabase, profile.orgId);
  return NextResponse.json({
    market: ctx.market,
    compliance: ctx.compliance,
  });
}

const patchSchema = z.object({
  channel: z.enum(["sms", "email"]),
  suspended: z.boolean(),
  reason: z.string().max(500).optional(),
});

export async function PATCH(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  const supabase = createServiceSupabaseClient();
  if (!supabase || !profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (profile.role !== "owner") {
    return NextResponse.json(
      { error: "Only the owner can resume or pause messaging channels." },
      { status: 403 },
    );
  }
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid compliance update" }, { status: 400 });
  }

  if (!parsed.data.suspended) {
    // Re-check rates before clearing — still over threshold stays paused.
    const evaluated = await evaluateAndMaybeSuspendMessaging(supabase, profile.orgId);
    const stillHot = evaluated[parsed.data.channel]?.by === "system";
    if (stillHot) {
      return NextResponse.json(
        {
          error:
            evaluated[parsed.data.channel]?.reason ||
            "Opt-out rate is still high. Fix consent practices before resuming.",
          compliance: evaluated,
        },
        { status: 409 },
      );
    }
  }

  const compliance = await setChannelSuspension(supabase, {
    orgId: profile.orgId,
    channel: parsed.data.channel,
    suspended: parsed.data.suspended,
    reason: parsed.data.reason,
    by: "owner",
  });

  return NextResponse.json({ ok: true, compliance });
}
