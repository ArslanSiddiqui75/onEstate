import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

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
    const normalized = from.replace(/\s+/g, "");
    const { data: phone } = await supabase
      .from("lead_phone_numbers")
      .select("lead_id, org_id, id")
      .eq("number", normalized)
      .maybeSingle();

    if (phone) {
      let threadId: string | undefined;
      const { data: existing } = await supabase
        .from("conversation_threads")
        .select("id")
        .eq("org_id", phone.org_id)
        .eq("lead_id", phone.lead_id)
        .maybeSingle();
      if (existing) threadId = existing.id;
      else {
        const { data: created } = await supabase
          .from("conversation_threads")
          .insert({
            org_id: phone.org_id,
            lead_id: phone.lead_id,
            phone_number: normalized,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        threadId = created?.id;
      }

      if (threadId) {
        await supabase.from("messages").insert({
          org_id: phone.org_id,
          thread_id: threadId,
          lead_id: phone.lead_id,
          direction: "inbound",
          body,
          status: "received",
          provider_sid: sid || null,
          sent_at: new Date().toISOString(),
        });
      }
    }
  }

  // Twilio expects TwiML or empty 200
  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
