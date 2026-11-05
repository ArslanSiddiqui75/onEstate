import { NextResponse } from "next/server";
import { z } from "zod";
import { sendOutboundEmail } from "@/lib/email/service";
import {
  checkDomainDns,
  formatFromAddress,
  normalizeDomain,
  normalizeMailbox,
  sendDomainEmail,
} from "@/lib/email/domain";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";
import { fireLeadContactedIfFirst } from "@/lib/automations/engine";
import { profileHasDndForLead } from "@/lib/crm/dnd-server";
import { DND_BLOCK_MESSAGE } from "@/lib/crm/dnd";
import { clientIp } from "@/lib/http/client-ip";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";

const isRateLimited = createSlidingWindowLimiter({
  windowMs: 60_000,
  max: 30,
});

const bodySchema = z.object({
  leadId: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  threadId: z.string().optional(),
  domain: z.string().optional(),
  fromLocal: z.string().optional(),
  fromName: z.string().optional(),
  kind: z.enum(["manual", "bulk", "automation", "sequence"]).default("manual"),
});

export async function POST(request: Request) {
  if (isRateLimited(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many emails. Try again shortly." },
      { status: 429 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email payload" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const profile = await resolveProfileFromRequest(request);

  if (!profile) {
    return NextResponse.json({ error: "Sign in to send email" }, { status: 401 });
  }
  const denied = forbiddenIfNoModule(profile, "crm", "edit");
  if (denied) return denied;

  const orgId = profile.orgId;
  if (!supabase || !orgId) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Email is not configured" },
        { status: 503 },
      );
    }
    const domain = normalizeDomain(parsed.data.domain || "");
    const fromLocal = normalizeMailbox(parsed.data.fromLocal || "hello");
    const fromName = (parsed.data.fromName || "").trim().slice(0, 80);
    if (!domain || !fromLocal || !fromName) {
      return NextResponse.json(
        { error: "Connect your domain in Settings before sending email." },
        { status: 400 },
      );
    }
    const dns = await checkDomainDns(domain);
    if (!dns.verified) {
      return NextResponse.json(
        { error: "The domain DNS is not in place yet. Check it in Settings." },
        { status: 400 },
      );
    }
    try {
      const result = await sendDomainEmail({
        from: formatFromAddress({ domain, fromLocal, fromName }),
        to: parsed.data.to,
        subject: parsed.data.subject,
        text: parsed.data.body,
      });
      return NextResponse.json({
        ok: true,
        sid: result.sid,
        status: result.status,
        mode: result.mode,
        sentAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[email/send] local send failed", error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 },
      );
    }
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, email, phone, email_consent")
    .eq("id", parsed.data.leadId)
    .eq("org_id", orgId)
    .maybeSingle();
  const to = String(lead?.email || "").trim();
  if (!lead || !to) {
    return NextResponse.json(
      { error: "Lead has no email address" },
      { status: 400 },
    );
  }

  if (profile) {
    const dnd = await profileHasDndForLead(supabase, {
      orgId,
      profileId: profile.userId,
      leadId: String(lead.id),
      email: to,
      phone: lead.phone ? String(lead.phone) : null,
    });
    if (dnd) {
      return NextResponse.json({ error: DND_BLOCK_MESSAGE }, { status: 403 });
    }
  }

  const result = await sendOutboundEmail(supabase, {
    orgId,
    leadId: parsed.data.leadId,
    to,
    subject: parsed.data.subject,
    body: parsed.data.body,
    threadId: parsed.data.threadId,
    kind: parsed.data.kind,
    consent:
      (lead.email_consent as "unknown" | "opted_in" | "opted_out" | undefined) ||
      "unknown",
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Failed to send email" },
      { status: 500 },
    );
  }

  await fireLeadContactedIfFirst(supabase, {
    orgId,
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
