import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhoneNumber } from "@/lib/utils";
import { isE164 } from "@/lib/phone/e164";
import { sendTwilioSms } from "@/lib/twilio/client";

export interface InboundMessageInput {
  orgId: string;
  leadId: string;
  body: string;
  providerSid?: string | null;
  subject?: string | null;
  channel?: "sms" | "email";
  email?: string;
  /** simulated = in-app test; twilio / resend = provider webhook */
  source?: "simulated" | "twilio" | "resend";
}

export interface InboundMessageResult {
  ok: boolean;
  threadId?: string;
  messageId?: string;
  error?: string;
}

/** Build lookup variants for E.164, digits-only, and +prefixed forms. */
export function phoneLookupVariants(raw: string): string[] {
  const normalized = normalizePhoneNumber(raw);
  if (!normalized) return [];

  const digits = normalized.replace(/\D/g, "");
  const variants = new Set<string>([normalized]);
  if (digits) {
    variants.add(digits);
    variants.add(`+${digits}`);
  }
  return [...variants];
}

export async function findLeadByPhone(
  supabase: SupabaseClient,
  from: string,
): Promise<{ leadId: string; orgId: string } | null> {
  const variants = phoneLookupVariants(from);
  if (!variants.length) return null;

  const { data: phoneRow } = await supabase
    .from("lead_phone_numbers")
    .select("lead_id, org_id")
    .in("number", variants)
    .limit(1)
    .maybeSingle();

  if (phoneRow) {
    return {
      leadId: String(phoneRow.lead_id),
      orgId: String(phoneRow.org_id),
    };
  }

  // Fallback: primary phone on leads row (older rows / imports)
  const { data: leadRows } = await supabase
    .from("leads")
    .select("id, org_id, phone")
    .not("phone", "is", null);

  for (const row of leadRows || []) {
    const leadPhone = String(row.phone || "");
    const leadVariants = phoneLookupVariants(leadPhone);
    if (leadVariants.some((v) => variants.includes(v))) {
      return { leadId: String(row.id), orgId: String(row.org_id) };
    }
  }

  return null;
}

/** Find or create the conversation thread for an org+lead+channel. */
export async function ensureThread(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    leadId: string;
    channel?: "sms" | "email";
    phoneNumber?: string;
    email?: string;
  },
): Promise<{ threadId?: string; error?: string }> {
  const channel = input.channel === "email" ? "email" : "sms";
  const { data: existing } = await supabase
    .from("conversation_threads")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId)
    .eq("channel", channel)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, string> = {};
    if (input.email) patch.email = input.email;
    if (input.phoneNumber) patch.phone_number = input.phoneNumber;
    if (Object.keys(patch).length) {
      await supabase
        .from("conversation_threads")
        .update(patch)
        .eq("id", existing.id);
    }
    return { threadId: String(existing.id) };
  }

  let phoneNumber = input.phoneNumber;
  if (!phoneNumber && channel === "sms") {
    const { data: lead } = await supabase
      .from("leads")
      .select("phone")
      .eq("id", input.leadId)
      .eq("org_id", input.orgId)
      .maybeSingle();
    phoneNumber = lead?.phone ? String(lead.phone) : "";
  }

  const { data: created, error } = await supabase
    .from("conversation_threads")
    .insert({
      org_id: input.orgId,
      lead_id: input.leadId,
      phone_number: phoneNumber || "",
      email: input.email || null,
      channel,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: error?.message || "Failed to create thread" };
  }
  return { threadId: String(created.id) };
}

export interface OutboundMessageInput {
  orgId: string;
  leadId: string;
  to: string;
  body: string;
  consent?: "unknown" | "opted_in" | "opted_out";
  threadId?: string;
}

export interface OutboundMessageResult {
  ok: boolean;
  sid?: string;
  status?: string;
  mode?: "live" | "simulated";
  threadId?: string;
  messageId?: string;
  sentAt?: string;
  error?: string;
}

/**
 * Send an SMS and persist it on the lead's thread. Shared by the CRM send
 * route and the automation engine so both paths log identically.
 */
export async function sendOutboundSms(
  supabase: SupabaseClient,
  input: OutboundMessageInput,
): Promise<OutboundMessageResult> {
  if (input.consent === "opted_out") {
    return { ok: false, error: "Cannot send SMS: contact opted out" };
  }
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Message body is required" };
  if (!isE164(input.to)) {
    return {
      ok: false,
      error:
        "Phone needs a country code (save as +92… or +44…, not 0333…).",
    };
  }

  let result;
  try {
    result = await sendTwilioSms({ to: input.to, body });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }

  const sentAt = new Date().toISOString();
  let threadId = input.threadId;
  if (!threadId) {
    const thread = await ensureThread(supabase, {
      orgId: input.orgId,
      leadId: input.leadId,
      phoneNumber: input.to,
      channel: "sms",
    });
    if (thread.error) {
      // The message really did go out, so report success with the send details
      // rather than making the caller think it failed.
      return {
        ok: true,
        sid: result.sid,
        status: result.status,
        mode: result.mode,
        sentAt,
        error: thread.error,
      };
    }
    threadId = thread.threadId;
  }

  let messageId: string | undefined;
  if (threadId) {
    const { data: message } = await supabase
      .from("messages")
      .insert({
        org_id: input.orgId,
        thread_id: threadId,
        lead_id: input.leadId,
        direction: "outbound",
        body,
        status: result.status === "failed" ? "failed" : "sent",
        provider_sid: result.sid,
        sent_at: sentAt,
        channel: "sms",
      })
      .select("id")
      .single();
    messageId = message ? String(message.id) : undefined;

    await supabase
      .from("conversation_threads")
      .update({ last_message_at: sentAt })
      .eq("id", threadId);
  }

  return {
    ok: true,
    sid: result.sid,
    status: result.status,
    mode: result.mode,
    threadId,
    messageId,
    sentAt,
  };
}

export async function recordInboundMessage(
  supabase: SupabaseClient,
  input: InboundMessageInput,
): Promise<InboundMessageResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Message body is required" };
  const channel = input.channel === "email" ? "email" : "sms";

  const thread = await ensureThread(supabase, {
    orgId: input.orgId,
    leadId: input.leadId,
    email: input.email,
    channel,
  });
  if (thread.error || !thread.threadId) {
    return { ok: false, error: thread.error || "Failed to create thread" };
  }
  const threadId = thread.threadId;

  if (input.providerSid) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("org_id", input.orgId)
      .eq("provider_sid", input.providerSid)
      .maybeSingle();
    if (existing) {
      return { ok: true, threadId, messageId: String(existing.id) };
    }
  }

  const sentAt = new Date().toISOString();
  const providerSid =
    input.providerSid ||
    (input.source === "simulated" ? `sim_in_${Date.now()}` : null);

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      org_id: input.orgId,
      thread_id: threadId,
      lead_id: input.leadId,
      direction: "inbound",
      body,
      subject: input.subject || null,
      status: "received",
      provider_sid: providerSid,
      sent_at: sentAt,
      channel,
    })
    .select("id")
    .single();

  if (messageError) {
    return { ok: false, error: messageError.message };
  }

  await supabase
    .from("conversation_threads")
    .update({ last_message_at: sentAt })
    .eq("id", threadId);

  return {
    ok: true,
    threadId,
    messageId: message ? String(message.id) : undefined,
  };
}
