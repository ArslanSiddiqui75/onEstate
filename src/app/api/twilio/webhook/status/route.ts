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
    const mapped =
      status === "delivered"
        ? "delivered"
        : status === "failed" || status === "undelivered"
          ? "failed"
          : status === "sent"
            ? "sent"
            : "queued";
    await supabase
      .from("messages")
      .update({ status: mapped })
      .eq("provider_sid", sid);
  }

  return NextResponse.json({ ok: true });
}
