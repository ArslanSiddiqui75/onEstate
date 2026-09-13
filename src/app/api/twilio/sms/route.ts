import { NextResponse } from "next/server";
import { z } from "zod";
import { mapTwilioError, phoneLookupVariants, sendOutboundSms } from "@/lib/messaging/service";
import { isE164 } from "@/lib/phone/e164";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { sendTwilioSms } from "@/lib/twilio/client";
import { fireLeadContactedIfFirst } from "@/lib/automations/engine";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";
import { shouldUseTwilioOutbound } from "@/lib/messaging/capabilities";

const bodySchema = z.object({
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
  const profile = await resolveProfileFromRequest(request);

  if (supabase && !profile) {
    return NextResponse.json({ error: "Sign in to send SMS" }, { status: 401 });
  }
  if (profile) {
    const denied = forbiddenIfNoModule(profile, "crm", "edit");
    if (denied) return denied;
  }

  if (process.env.NODE_ENV === "production" && !profile) {
    return NextResponse.json({ error: "Sign in to send SMS" }, { status: 401 });
  }

  const orgId = profile?.orgId;

  // Local-workspace mode has no Supabase to persist to; the client stores the
  // message itself, so just relay the send — never send live Twilio unauthenticated.
  if (!supabase || !orgId) {
    if (shouldUseTwilioOutbound() && !profile) {
      return NextResponse.json({ error: "Sign in to send SMS" }, { status: 401 });
    }
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
        { error: mapTwilioError(error) },
        { status: 500 },
      );
    }
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, phone")
    .eq("id", parsed.data.leadId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data: phoneRows } = await supabase
    .from("lead_phone_numbers")
    .select("number, consent")
    .eq("lead_id", lead.id)
    .eq("org_id", orgId);

  const allowed = new Set(phoneLookupVariants(String(lead.phone || "")));
  const consentByVariant = new Map<string, string>();
  for (const row of phoneRows || []) {
    const variants = phoneLookupVariants(String(row.number || ""));
    for (const variant of variants) {
      allowed.add(variant);
      if (row.consent) consentByVariant.set(variant, String(row.consent));
    }
  }

  const toVariants = phoneLookupVariants(parsed.data.to);
  if (!toVariants.some((variant) => allowed.has(variant))) {
    return NextResponse.json(
      { error: "Phone number does not belong to this lead" },
      { status: 403 },
    );
  }

  const storedConsent = toVariants
    .map((variant) => consentByVariant.get(variant))
    .find(Boolean);
  if (storedConsent === "opted_out") {
    return NextResponse.json(
      { error: "Cannot send SMS: contact opted out" },
      { status: 403 },
    );
  }

  const result = await sendOutboundSms(supabase, {
    orgId,
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
