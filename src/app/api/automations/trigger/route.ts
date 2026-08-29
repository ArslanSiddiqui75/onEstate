import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { triggerAndProcess } from "@/lib/automations/engine";
import type { AutomationTrigger, LeadStage } from "@/types";

const bodySchema = z.object({
  leadId: z.string().min(1),
  trigger: z.enum([
    "lead_created",
    "stage_changed",
    "lead_contacted",
    "no_reply",
    "manual",
  ]),
  stage: z
    .enum(["new", "contacted", "qualified", "viewing", "offer", "won", "lost"])
    .optional(),
  automationId: z.string().optional(),
});

// SMS sends inside a run hit Twilio, so give the batch room to finish.
export const maxDuration = 60;

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 },
    );
  }

  // Confirm the lead belongs to the caller's org before running anything.
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", parsed.data.leadId)
    .eq("org_id", profile.orgId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const summary = await triggerAndProcess(supabase, {
    orgId: profile.orgId,
    leadId: parsed.data.leadId,
    trigger: parsed.data.trigger as AutomationTrigger,
    stage: parsed.data.stage as LeadStage | undefined,
    automationId: parsed.data.automationId,
  });

  return NextResponse.json({ ok: true, ...summary });
}
