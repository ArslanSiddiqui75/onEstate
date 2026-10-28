import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { findLeadByPhone, findOrgIdsByPhone, recordInboundMessage } from "@/lib/messaging/service";
import { applyLeadOptOut, isOptOutMessage } from "@/lib/messaging/opt-out";
import { cancelNoReplyRuns } from "@/lib/automations/engine";
import {
  assertTwilioSignature,
  readTwilioWebhookParams,
} from "@/lib/twilio/webhook";

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
      await recordInboundMessage(supabase, {
        orgId: match.orgId,
        leadId: match.leadId,
        body,
        providerSid: sid || null,
        source: "twilio",
      });
      await cancelNoReplyRuns(supabase, {
        orgId: match.orgId,
        leadId: match.leadId,
      });
      if (isOptOutMessage(body)) {
        await applyLeadOptOut(supabase, { orgId: match.orgId, leadId: match.leadId });
      }
    }
  }

  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
