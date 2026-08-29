import { NextResponse } from "next/server";
import { cancelNoReplyRuns } from "@/lib/automations/engine";
import {
  fetchReceivedEmail,
  findLeadForInboundEmail,
  inboundBodyFromContent,
  parseInboundEmailEvent,
} from "@/lib/email/inbound";
import {
  resendWebhookSecret,
  verifyResendWebhook,
} from "@/lib/email/webhook";
import { recordInboundMessage } from "@/lib/messaging/service";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * Resend inbound: Dashboard → Webhooks → email.received →
 * {APP_URL}/api/email/webhook/inbound
 */
export async function POST(request: Request) {
  const secret = resendWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "RESEND_WEBHOOK_SECRET is not set" },
      { status: 503 },
    );
  }

  const payload = await request.text();
  const valid = verifyResendWebhook({
    payload,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    secret,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  let event: { type?: string };
  try {
    event = JSON.parse(payload) as { type?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (event.type && event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const meta = parseInboundEmailEvent(event);
  if (!meta) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const match = await findLeadForInboundEmail(supabase, meta);
  if (!match) {
    return NextResponse.json({ ok: true, matched: false });
  }

  let content = null;
  try {
    content = await fetchReceivedEmail(meta.emailId);
  } catch {
    return NextResponse.json({ error: "Failed to fetch received email" }, { status: 500 });
  }
  if (!content && (process.env.RESEND_API_KEY || "").trim()) {
    return NextResponse.json({ error: "Failed to fetch received email" }, { status: 500 });
  }

  const body = inboundBodyFromContent(content, meta.subject);
  const result = await recordInboundMessage(supabase, {
    orgId: match.orgId,
    leadId: match.leadId,
    body,
    subject: meta.subject || null,
    channel: "email",
    email: meta.from,
    providerSid: meta.emailId,
    source: "resend",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Failed to record" }, { status: 500 });
  }

  await cancelNoReplyRuns(supabase, {
    orgId: match.orgId,
    leadId: match.leadId,
  });

  return NextResponse.json({
    ok: true,
    matched: true,
    leadId: match.leadId,
    messageId: result.messageId,
  });
}
