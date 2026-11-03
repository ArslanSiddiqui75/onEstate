import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { findLeadByPhone, findOrgIdsByPhone, recordInboundMessage } from "@/lib/messaging/service";
import { applyLeadOptOut, isOptOutMessage } from "@/lib/messaging/opt-out";
import { cancelNoReplyRuns } from "@/lib/automations/engine";
import {
  assertTwilioSignature,
  readTwilioWebhookParams,
} from "@/lib/twilio/webhook";

async function captureUnmatched(
  supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>,
  input: {
    from: string;
    to: string;
    body: string;
    sid: string;
    orgIds: string[];
    needsOptOut?: boolean;
  },
) {
  // One triage row per candidate org so each workspace can see the message
  // (RLS is org-scoped). Ambiguous To still records for every matching org.
  const targets =
    input.orgIds.length > 0 ? input.orgIds : [null as string | null];
  for (const orgId of targets) {
    const row = {
      org_id: orgId,
      org_candidates: input.orgIds,
      from_phone: input.from,
      to_phone: input.to || null,
      body: input.body,
      // Unique sid index: only first insert keeps provider_sid when multi-org.
      provider_sid:
        orgId === targets[0] ? input.sid || null : input.sid ? `${input.sid}:${orgId}` : null,
      source: "twilio",
      needs_opt_out: Boolean(input.needsOptOut),
    };
    const { error } = await supabase.from("unmatched_inbound_messages").insert(row);
    if (error && error.code !== "23505") {
      console.error("[twilio-inbound] failed to store unmatched message", error.message);
    }
  }
}

export async function POST(request: Request) {
  const params = await readTwilioWebhookParams(request);
  const unauthorized = await assertTwilioSignature(request, params);
  if (unauthorized) return unauthorized;

  const from = String(params.From || "");
  const to = String(params.To || "");
  const body = String(params.Body || "");
  const sid = String(params.MessageSid || "");

  if (!from || !body) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    // Without a DB we cannot store the reply — return 5xx so Twilio retries.
    if (process.env.NODE_ENV === "production" || process.env.MESSAGING_MODE === "live") {
      return NextResponse.json({ error: "Inbound store unavailable" }, { status: 503 });
    }
    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const orgIds = await findOrgIdsByPhone(supabase, to);
  const match = orgIds.length === 1 ? await findLeadByPhone(supabase, from, orgIds[0]) : null;
  if (match) {
    // Opt-outs are applied first so they hold even if storing the message fails.
    if (isOptOutMessage(body)) {
      await applyLeadOptOut(supabase, { orgId: match.orgId, leadId: match.leadId });
    }
    const recorded = await recordInboundMessage(supabase, {
      orgId: match.orgId,
      leadId: match.leadId,
      body,
      providerSid: sid || null,
      source: "twilio",
    });
    if (!recorded.ok) {
      // Twilio only retries on an error response; a 200 would lose the reply.
      return NextResponse.json({ error: "Could not store the message" }, { status: 500 });
    }
    await cancelNoReplyRuns(supabase, {
      orgId: match.orgId,
      leadId: match.leadId,
    });
  } else {
    // STOP without a matched lead still lands in triage (needs_opt_out flag).
    await captureUnmatched(supabase, {
      from,
      to,
      body,
      sid,
      orgIds,
      needsOptOut: isOptOutMessage(body),
    });
  }

  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
