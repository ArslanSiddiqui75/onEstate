import { NextResponse } from "next/server";
import { z } from "zod";
import { sendOutboundSms } from "@/lib/messaging/service";
import { isE164 } from "@/lib/phone/e164";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { sendTwilioSms } from "@/lib/twilio/client";
import { fireLeadContactedIfFirst } from "@/lib/automations/engine";

const bodySchema = z.object({
  orgId: z.string().min(1),
  leadId: z.string().min(1),
  to: z.string().min(5),
  body: z.string().min(1).max(1600),
  consent: z.enum(["unknown", "opted_in", "opted_out"]).default("unknown"),
  threadId: z.string().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (parsed.data.consent === "opted_out") {
    return NextResponse.json(
      { error: "Cannot send SMS: contact opted out" },
      { status: 403 },
    );
  }

  if (!isE164(parsed.data.to)) {
    return NextResponse.json(
      {
        error:
          "Phone needs a country code (save as +92… or +44…, not 0333…).",
      },
      { status: 400 },
    );
  }

  const supabase = createServiceSupabaseClient();

  // Local-workspace mode has no Supabase to persist to; the client stores the
  // message itself, so just relay the send.
  if (!supabase) {
    try {
      const result = await sendTwilioSms({
        to: parsed.data.to,
        body: parsed.data.body,
      });
      return NextResponse.json({
        ok: true,
        sid: result.sid,
        status: result.status,
        mode: result.mode,
        sentAt: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to send SMS" },
        { status: 500 },
      );
    }
  }

  const result = await sendOutboundSms(supabase, {
    orgId: parsed.data.orgId,
    leadId: parsed.data.leadId,
    to: parsed.data.to,
    body: parsed.data.body,
    consent: parsed.data.consent,
    threadId: parsed.data.threadId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Failed to send SMS" },
      { status: 500 },
    );
  }

  await fireLeadContactedIfFirst(supabase, {
    orgId: parsed.data.orgId,
    leadId: parsed.data.leadId,
  });

  return NextResponse.json({
    ok: true,
    sid: result.sid,
    status: result.status,
    mode: result.mode,
    messageId: result.messageId,
    threadId: result.threadId,
    sentAt: result.sentAt,
  });
}
