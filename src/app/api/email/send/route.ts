import { NextResponse } from "next/server";
import { z } from "zod";
import { sendOutboundEmail } from "@/lib/email/service";
import { sendResendEmail } from "@/lib/email/client";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";

const bodySchema = z.object({
  leadId: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  threadId: z.string().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email payload" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const profile = await resolveProfileFromRequest(request);

  if (supabase && !profile) {
    return NextResponse.json({ error: "Sign in to send email" }, { status: 401 });
  }

  const orgId = profile?.orgId;
  if (!supabase || !orgId) {
    try {
      const result = await sendResendEmail({
        to: parsed.data.to,
        subject: parsed.data.subject,
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
        { error: error instanceof Error ? error.message : "Failed to send email" },
        { status: 500 },
      );
    }
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, email")
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

  const result = await sendOutboundEmail(supabase, {
    orgId,
    leadId: parsed.data.leadId,
    to,
    subject: parsed.data.subject,
    body: parsed.data.body,
    threadId: parsed.data.threadId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Failed to send email" },
      { status: 500 },
    );
  }

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
