import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { findLeadByPhone, recordInboundMessage } from "@/lib/messaging/service";
import { cancelNoReplyRuns } from "@/lib/automations/engine";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const from = String(form?.get("From") || "");
  const body = String(form?.get("Body") || "");
  const sid = String(form?.get("MessageSid") || "");

  if (!from || !body) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (supabase) {
    const match = await findLeadByPhone(supabase, from);
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
    }
  }

  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
