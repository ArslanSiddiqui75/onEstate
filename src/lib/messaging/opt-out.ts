import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateAndMaybeSuspendMessaging } from "@/lib/messaging/compliance";

const OPT_OUT_KEYWORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
  "optout",
]);
const OPT_IN_KEYWORDS = new Set(["start", "unstop", "yes"]);
const HELP_KEYWORDS = new Set(["help", "info"]);

function keywordFromBody(body: string): string {
  return body
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function isSingleKeyword(body: string, keywords: Set<string>): boolean {
  const word = keywordFromBody(body);
  return word.length > 0 && body.trim().split(/\s+/).length === 1 && keywords.has(word);
}

/** Carrier-standard keywords. Only an exact one-word reply counts, so "please don't stop" does not. */
export function isOptOutMessage(body: string): boolean {
  return isSingleKeyword(body, OPT_OUT_KEYWORDS);
}

export function isOptInMessage(body: string): boolean {
  return isSingleKeyword(body, OPT_IN_KEYWORDS);
}

export function isHelpMessage(body: string): boolean {
  return isSingleKeyword(body, HELP_KEYWORDS);
}

/** Email body/subject contains an unsubscribe intent (PECR / CAN-SPAM). */
export function isEmailUnsubscribeMessage(subject: string, body: string): boolean {
  const haystack = `${subject}\n${body}`.toLowerCase();
  if (/\bunsubscribe\b/.test(haystack)) return true;
  if (isOptOutMessage(body) || isOptOutMessage(subject)) return true;
  return false;
}

async function recordConsentEvent(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    leadId?: string | null;
    channel: "sms" | "email";
    previousStatus?: string | null;
    newStatus: string;
    source: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("consent_events").insert({
    org_id: input.orgId,
    lead_id: input.leadId || null,
    channel: input.channel,
    previous_status: input.previousStatus || null,
    new_status: input.newStatus,
    source: input.source,
    metadata: input.metadata || {},
  });
}

/** True when any phone on the lead has opted out (not preferred-only). */
export async function leadHasOptedOut(
  supabase: SupabaseClient,
  input: { orgId: string; leadId: string },
): Promise<boolean> {
  const { data } = await supabase
    .from("lead_phone_numbers")
    .select("id")
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId)
    .eq("consent", "opted_out")
    .limit(1);
  return Boolean(data && data.length > 0);
}

export async function leadEmailHasOptedOut(
  supabase: SupabaseClient,
  input: { orgId: string; leadId: string },
): Promise<boolean> {
  const { data } = await supabase
    .from("leads")
    .select("email_consent")
    .eq("org_id", input.orgId)
    .eq("id", input.leadId)
    .maybeSingle();
  return String(data?.email_consent || "") === "opted_out";
}

async function cancelQueuedMessaging(
  supabase: SupabaseClient,
  input: { orgId: string; leadId: string; detail: string },
) {
  const now = new Date().toISOString();
  await supabase
    .from("automation_runs")
    .update({
      status: "cancelled",
      last_error: input.detail,
      completed_at: now,
      updated_at: now,
    })
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId)
    .in("status", ["pending", "waiting", "running"]);
  await supabase
    .from("sequence_enrollments")
    .update({ status: "cancelled" })
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId)
    .eq("status", "active");
}

/** Record the opt-out on every number for the lead and cancel anything still queued to them. */
export async function applyLeadOptOut(
  supabase: SupabaseClient,
  input: { orgId: string; leadId: string; source?: string },
) {
  const source = input.source || "twilio_stop";
  const { data: phones } = await supabase
    .from("lead_phone_numbers")
    .select("id, consent")
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId);

  await supabase
    .from("lead_phone_numbers")
    .update({ consent: "opted_out" })
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId);

  const previous =
    (phones || []).find((row) => row.consent && row.consent !== "opted_out")?.consent ||
    (phones || [])[0]?.consent ||
    "unknown";

  await recordConsentEvent(supabase, {
    orgId: input.orgId,
    leadId: input.leadId,
    channel: "sms",
    previousStatus: previous ? String(previous) : "unknown",
    newStatus: "opted_out",
    source,
  });

  await cancelQueuedMessaging(supabase, {
    orgId: input.orgId,
    leadId: input.leadId,
    detail: "Lead opted out",
  });

  await evaluateAndMaybeSuspendMessaging(supabase, input.orgId);
}

export async function applyLeadOptIn(
  supabase: SupabaseClient,
  input: { orgId: string; leadId: string; source?: string },
) {
  const source = input.source || "twilio_start";
  const { data: phones } = await supabase
    .from("lead_phone_numbers")
    .select("consent")
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId);

  await supabase
    .from("lead_phone_numbers")
    .update({ consent: "opted_in" })
    .eq("org_id", input.orgId)
    .eq("lead_id", input.leadId);

  await recordConsentEvent(supabase, {
    orgId: input.orgId,
    leadId: input.leadId,
    channel: "sms",
    previousStatus: phones?.[0]?.consent ? String(phones[0].consent) : "unknown",
    newStatus: "opted_in",
    source,
  });
}

export async function applyLeadEmailOptOut(
  supabase: SupabaseClient,
  input: { orgId: string; leadId: string; source?: string },
) {
  const source = input.source || "email_unsubscribe";
  const { data: lead } = await supabase
    .from("leads")
    .select("email_consent")
    .eq("org_id", input.orgId)
    .eq("id", input.leadId)
    .maybeSingle();

  await supabase
    .from("leads")
    .update({ email_consent: "opted_out" })
    .eq("org_id", input.orgId)
    .eq("id", input.leadId);

  await recordConsentEvent(supabase, {
    orgId: input.orgId,
    leadId: input.leadId,
    channel: "email",
    previousStatus: lead?.email_consent ? String(lead.email_consent) : "unknown",
    newStatus: "opted_out",
    source,
  });

  await cancelQueuedMessaging(supabase, {
    orgId: input.orgId,
    leadId: input.leadId,
    detail: "Lead unsubscribed from email",
  });

  await evaluateAndMaybeSuspendMessaging(supabase, input.orgId);
}
