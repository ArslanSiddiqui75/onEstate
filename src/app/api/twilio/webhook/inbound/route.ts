import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { findLeadByPhone, findOrgIdsByPhone, recordInboundMessage } from "@/lib/messaging/service";
import {
  applyLeadOptIn,
  applyLeadOptOut,
  isHelpMessage,
  isOptInMessage,
  isOptOutMessage,
} from "@/lib/messaging/opt-out";
import {
  helpSmsReply,
  loadOrgComplianceContext,
  startSmsReply,
  stopSmsReply,
  twimlMessage,
} from "@/lib/messaging/compliance";
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

function xml(body: string) {
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
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
    return xml("<Response></Response>");
  }

  const orgIds = await findOrgIdsByPhone(supabase, to);
  const match = orgIds.length === 1 ? await findLeadByPhone(supabase, from, orgIds[0]) : null;
  const orgMeta =
    orgIds.length === 1
      ? await loadOrgComplianceContext(supabase, orgIds[0])
      : { orgName: "", market: "uk" as const, compliance: {} };

  if (match) {
    let autoReply: string | null = null;

    // Opt-outs / opt-ins / HELP first so they hold even if storing the message fails.
    if (isOptOutMessage(body)) {
      await applyLeadOptOut(supabase, {
        orgId: match.orgId,
        leadId: match.leadId,
        source: "twilio_stop",
      });
      autoReply = stopSmsReply(orgMeta.orgName);
    } else if (isOptInMessage(body)) {
      await applyLeadOptIn(supabase, {
        orgId: match.orgId,
        leadId: match.leadId,
        source: "twilio_start",
      });
      autoReply = startSmsReply(orgMeta.orgName);
    } else if (isHelpMessage(body)) {
      autoReply = helpSmsReply(orgMeta.orgName);
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

    if (autoReply) return xml(twimlMessage(autoReply));
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
    if (orgIds.length === 1 && isHelpMessage(body)) {
      return xml(twimlMessage(helpSmsReply(orgMeta.orgName)));
    }
    if (orgIds.length === 1 && isOptOutMessage(body)) {
      return xml(twimlMessage(stopSmsReply(orgMeta.orgName)));
    }
  }

  return xml("<Response></Response>");
}
