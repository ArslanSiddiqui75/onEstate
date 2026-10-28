import { verifiedThreadId } from "@/lib/messaging/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkDomainDns,
  formatFromAddress,
  readEmailDomain,
  sendDomainEmail,
} from "@/lib/email/domain";
import { inboundReplyTo } from "@/lib/email/inbound";
import { ensureThread } from "@/lib/messaging/service";

export interface OutboundEmailInput {
  orgId: string;
  leadId: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

export interface OutboundEmailResult {
  ok: boolean;
  sid?: string;
  status?: string;
  mode?: "live" | "simulated";
  threadId?: string;
  messageId?: string;
  sentAt?: string;
  error?: string;
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Send an email and persist it on the lead's thread (same thread as SMS).
 * Shared by the CRM send route and the automation engine.
 */
export async function sendOutboundEmail(
  supabase: SupabaseClient,
  input: OutboundEmailInput,
): Promise<OutboundEmailResult> {
  const to = input.to.trim().toLowerCase();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!looksLikeEmail(to)) return { ok: false, error: "Lead email is invalid" };
  if (!subject) return { ok: false, error: "Subject is required" };
  if (!body) return { ok: false, error: "Email body is required" };

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("email_domain")
    .eq("id", input.orgId)
    .maybeSingle();
  const sending = readEmailDomain(orgRow?.email_domain);
  if (!sending) {
    return { ok: false, error: "Connect your domain in Settings before sending email." };
  }
  const dns = await checkDomainDns(sending.domain);
  if (!dns.verified) {
    return {
      ok: false,
      error: "The domain DNS is not in place yet. Check it in Settings.",
    };
  }

  let result;
  try {
    result = await sendDomainEmail({
      from: formatFromAddress(sending),
      to,
      subject,
      text: body,
      replyTo: inboundReplyTo(input.leadId),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }

  const sentAt = new Date().toISOString();
  let threadId = await verifiedThreadId(supabase, input);
  if (!threadId) {
    const thread = await ensureThread(supabase, {
      orgId: input.orgId,
      leadId: input.leadId,
      email: to,
      channel: "email",
    });
    if (thread.error) {
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
        subject,
        status: result.status === "failed" ? "failed" : "sent",
        provider_sid: result.sid,
        sent_at: sentAt,
        channel: "email",
      })
      .select("id")
      .single();
    messageId = message ? String(message.id) : undefined;

    await supabase
      .from("conversation_threads")
      .update({ last_message_at: sentAt, email: to })
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
