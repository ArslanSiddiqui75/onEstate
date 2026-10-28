import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  assertTwilioSignature,
  readTwilioWebhookParams,
} from "@/lib/twilio/webhook";

export async function POST(request: Request) {
  const params = await readTwilioWebhookParams(request);
  const unauthorized = await assertTwilioSignature(request, params);
  if (unauthorized) return unauthorized;

  const sid = String(params.MessageSid || "");
  const status = String(params.MessageStatus || "");

  if (!sid) {
    return NextResponse.json({ error: "Missing MessageSid" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (supabase && status) {
    // Callbacks can arrive out of order, so a status may only move forward.
    const forward: Record<string, { to: string; from: string[] }> = {
      sent: { to: "sent", from: ["queued"] },
      delivered: { to: "delivered", from: ["queued", "sent"] },
      failed: { to: "failed", from: ["queued", "sent"] },
      undelivered: { to: "failed", from: ["queued", "sent"] },
    };
    const rule = forward[status];
    if (rule) {
      await supabase
        .from("messages")
        .update({ status: rule.to })
        .eq("provider_sid", sid)
        .in("status", rule.from);
    }
  }

  return NextResponse.json({ ok: true });
}
