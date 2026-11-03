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
  },
) {
  const orgId =
    input.orgIds.length === 1 ? input.orgIds[0] : input.orgIds.length ? input.orgIds[0] : null;
  const row = {
    org_id: orgId,
    org_candidates: input.orgIds,
    from_phone: input.from,
    to_phone: input.to || null,
    body: input.body,
    provider_sid: input.sid || null,
    source: "twilio",
  };
  const { error } = await supabase.from("unmatched_inbound_messages").insert(row);
  if (error && error.code !== "23505") {
    console.error("[twilio-inbound] failed to store unmatched message", error.message);
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
  if (supabase) {
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
      await captureUnmatched(supabase, { from, to, body, sid, orgIds });
    }
  }

  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
