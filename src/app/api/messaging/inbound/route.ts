import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { recordInboundMessage } from "@/lib/messaging/service";
import { cancelNoReplyRuns } from "@/lib/automations/engine";

const bodySchema = z.object({
  leadId: z.string().min(1),
  body: z.string().min(1).max(20000),
  channel: z.enum(["sms", "email"]).optional(),
  subject: z.string().max(200).optional(),
});

/** Simulate an inbound SMS or email from a lead. */
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
      { error: "Supabase not configured — use local workspace mode" },
      { status: 503 },
    );
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", parsed.data.leadId)
    .eq("org_id", profile.orgId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const channel = parsed.data.channel === "email" ? "email" : "sms";
  const result = await recordInboundMessage(supabase, {
    orgId: profile.orgId,
    leadId: parsed.data.leadId,
    body: parsed.data.body,
    subject: parsed.data.subject || null,
    channel,
    source: "simulated",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Failed" }, { status: 500 });
  }

  await cancelNoReplyRuns(supabase, {
    orgId: profile.orgId,
    leadId: parsed.data.leadId,
  });

  return NextResponse.json({
    ok: true,
    mode: "simulated",
    threadId: result.threadId,
    messageId: result.messageId,
    receivedAt: new Date().toISOString(),
  });
}
