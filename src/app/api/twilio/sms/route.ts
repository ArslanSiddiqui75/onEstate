import { NextResponse } from "next/server";
import { z } from "zod";
import { sendTwilioSms } from "@/lib/twilio/client";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

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

  let result;
  try {
    result = await sendTwilioSms({
      to: parsed.data.to,
      body: parsed.data.body,
    });
  } catch (error) {
    console.error("Twilio SMS Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send SMS" },
      { status: 500 }
    );
  }

  const supabase = createServiceSupabaseClient();
  let messageId: string | undefined;
  let threadId = parsed.data.threadId;

  if (supabase) {
    if (!threadId) {
      const { data: existing } = await supabase
        .from("conversation_threads")
        .select("id")
        .eq("org_id", parsed.data.orgId)
        .eq("lead_id", parsed.data.leadId)
        .maybeSingle();
      if (existing) threadId = existing.id;
      else {
        const { data: created } = await supabase
          .from("conversation_threads")
          .insert({
            org_id: parsed.data.orgId,
            lead_id: parsed.data.leadId,
            phone_number: parsed.data.to,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        threadId = created?.id;
      }
    }

    if (threadId) {
      const { data: message } = await supabase
        .from("messages")
        .insert({
          org_id: parsed.data.orgId,
          thread_id: threadId,
          lead_id: parsed.data.leadId,
          direction: "outbound",
          body: parsed.data.body,
          status: result.status === "failed" ? "failed" : "sent",
          provider_sid: result.sid,
          sent_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      messageId = message?.id;
      await supabase
        .from("conversation_threads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", threadId);
    }
  }

  return NextResponse.json({
    ok: true,
    sid: result.sid,
    status: result.status,
    mode: result.mode,
    messageId,
    threadId,
    sentAt: new Date().toISOString(),
  });
}
