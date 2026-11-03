import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConsentStatus, Market } from "@/types";

export type MessagingChannel = "sms" | "email";
export type SendKind = "manual" | "bulk" | "automation" | "sequence";

export interface MessagingChannelSuspension {
  suspendedAt?: string;
  reason?: string;
  by?: "system" | "owner";
  optOuts?: number;
  sends?: number;
  rate?: number;
  windowHours?: number;
}

export interface MessagingComplianceState {
  sms?: MessagingChannelSuspension;
  email?: MessagingChannelSuspension;
  lastEvaluatedAt?: string;
  acknowledgedAt?: string;
}

/** Rolling window used when scoring opt-out rate. */
export const OPT_OUT_WINDOW_HOURS = 24 * 7;
/** Need enough outbound volume before rate-based suspension. */
export const OPT_OUT_MIN_SENDS = 20;
/** Suspend the channel when opt-outs / sends in the window reach this share. */
export const OPT_OUT_RATE_THRESHOLD = 0.08;
/** Absolute spike: many opt-outs in 24h even before the weekly sample fills. */
export const OPT_OUT_SPIKE_HOURS = 24;
export const OPT_OUT_SPIKE_COUNT = 10;

const QUIET_START_HOUR = 8;
const QUIET_END_HOUR = 21; // exclusive → 8:00–20:59 local

export function readMessagingCompliance(raw: unknown): MessagingComplianceState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const row = raw as Record<string, unknown>;
  const readChannel = (value: unknown): MessagingChannelSuspension | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const c = value as Record<string, unknown>;
    const suspendedAt = typeof c.suspendedAt === "string" ? c.suspendedAt : undefined;
    if (!suspendedAt) return undefined;
    return {
      suspendedAt,
      reason: typeof c.reason === "string" ? c.reason : undefined,
      by: c.by === "owner" || c.by === "system" ? c.by : undefined,
      optOuts: typeof c.optOuts === "number" ? c.optOuts : undefined,
      sends: typeof c.sends === "number" ? c.sends : undefined,
      rate: typeof c.rate === "number" ? c.rate : undefined,
      windowHours: typeof c.windowHours === "number" ? c.windowHours : undefined,
    };
  };
  return {
    sms: readChannel(row.sms),
    email: readChannel(row.email),
    lastEvaluatedAt:
      typeof row.lastEvaluatedAt === "string" ? row.lastEvaluatedAt : undefined,
    acknowledgedAt:
      typeof row.acknowledgedAt === "string" ? row.acknowledgedAt : undefined,
  };
}

export function channelIsSuspended(
  state: MessagingComplianceState,
  channel: MessagingChannel,
): boolean {
  return Boolean(state[channel]?.suspendedAt);
}

export function suspensionMessage(
  state: MessagingComplianceState,
  channel: MessagingChannel,
): string | null {
  const row = state[channel];
  if (!row?.suspendedAt) return null;
  return (
    row.reason ||
    `${channel === "sms" ? "Texting" : "Email"} is paused for this workspace after too many opt-outs. An owner can review and resume in Settings → Phone System.`
  );
}

/** Timezone for quiet-hours: recipient market, not the agent’s laptop. */
export function quietHoursTimeZone(market: Market, phoneE164?: string): string {
  if (market === "uk") return "Europe/London";
  const digits = (phoneE164 || "").replace(/\D/g, "");
  // Rough US zone from NANP area code — Eastern is the conservative TCPA default.
  if (digits.startsWith("1") && digits.length >= 4) {
    const area = Number(digits.slice(1, 4));
    if ([213, 310, 415, 510, 619, 626, 650, 707, 714, 805, 818, 831, 858, 909, 916, 925, 949].includes(area)) {
      return "America/Los_Angeles";
    }
    if ([206, 253, 360, 425, 503, 541, 971].includes(area)) return "America/Los_Angeles";
    if ([303, 719, 720, 970, 406, 505, 575, 602, 623, 480, 520].includes(area)) {
      return "America/Denver";
    }
    if ([312, 773, 872, 214, 469, 972, 713, 281, 832, 512, 737, 314, 816].includes(area)) {
      return "America/Chicago";
    }
  }
  return "America/New_York";
}

export function isWithinQuietHours(input: {
  market: Market;
  phoneE164?: string;
  now?: Date;
}): boolean {
  const timeZone = quietHoursTimeZone(input.market, input.phoneE164);
  const now = input.now || new Date();
  const hourText = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return false;
  return hour < QUIET_START_HOUR || hour >= QUIET_END_HOUR;
}

/**
 * Consent + quiet-hours + suspension gate.
 * Manual 1:1 agent replies may proceed with unknown consent (still block opt-outs).
 * Bulk / automation / sequence require explicit opted_in (TCPA + PECR marketing).
 */
export function assertCanSendMessage(input: {
  channel: MessagingChannel;
  kind: SendKind;
  consent: ConsentStatus | string | null | undefined;
  market: Market;
  phoneE164?: string;
  compliance?: MessagingComplianceState;
  now?: Date;
}): { ok: true } | { ok: false; error: string; code: string } {
  const consent = (input.consent || "unknown") as ConsentStatus;
  const state = input.compliance || {};

  if (channelIsSuspended(state, input.channel)) {
    return {
      ok: false,
      code: "channel_suspended",
      error: suspensionMessage(state, input.channel) || "Messaging is paused for this workspace.",
    };
  }

  if (consent === "opted_out") {
    return {
      ok: false,
      code: "opted_out",
      error:
        input.channel === "sms"
          ? "Cannot send SMS: contact opted out"
          : "Cannot send email: contact unsubscribed",
    };
  }

  const requiresOptIn = input.kind !== "manual";
  if (requiresOptIn && consent !== "opted_in") {
    return {
      ok: false,
      code: "consent_required",
      error:
        input.channel === "sms"
          ? "Marketing texts need explicit opt-in (TCPA / PECR). Mark the number opted in, or send a one-to-one reply from Conversations."
          : "Marketing email needs explicit opt-in (PECR / CAN-SPAM). Mark the lead opted in before bulk or automated email.",
    };
  }

  if (
    requiresOptIn &&
    input.channel === "sms" &&
    isWithinQuietHours({
      market: input.market,
      phoneE164: input.phoneE164,
      now: input.now,
    })
  ) {
    return {
      ok: false,
      code: "quiet_hours",
      error:
        input.market === "uk"
          ? "UK quiet hours: marketing texts only between 08:00 and 21:00 Europe/London."
          : "US quiet hours (TCPA): marketing texts only between 8:00am and 9:00pm recipient local time.",
    };
  }

  return { ok: true };
}

/** Append carrier-style opt-out line when the template forgot it. */
export function ensureSmsComplianceFooter(body: string, kind: SendKind): string {
  const trimmed = body.trim();
  if (!trimmed || kind === "manual") return trimmed;
  if (/\b(stop|unsubscribe|opt[ -]?out)\b/i.test(trimmed)) return trimmed;
  return `${trimmed}\n\nReply STOP to opt out. Msg & data rates may apply.`;
}

export function ensureEmailComplianceFooter(
  body: string,
  kind: SendKind,
  options?: { footer?: string; enabled?: boolean },
): string {
  const trimmed = body.trim();
  if (!trimmed || kind === "manual") return trimmed;
  if (options?.enabled === false) return trimmed;
  if (/\b(unsubscribe|opt[ -]?out|stop)\b/i.test(trimmed)) return trimmed;
  const custom = (options?.footer || "").trim();
  if (custom) return `${trimmed}\n\n—\n${custom}`;
  return `${trimmed}\n\n—\nTo unsubscribe, reply UNSUBSCRIBE.`;
}

export function helpSmsReply(orgName: string): string {
  const name = orgName.trim() || "this brokerage";
  return `${name}: For help, contact your agent. Reply STOP to opt out of SMS. Msg & data rates may apply.`;
}

export function stopSmsReply(orgName: string): string {
  const name = orgName.trim() || "this brokerage";
  return `You are unsubscribed from ${name} SMS. No more texts will be sent. Reply START to resubscribe.`;
}

export function startSmsReply(orgName: string): string {
  const name = orgName.trim() || "this brokerage";
  return `You are resubscribed to ${name} SMS. Reply STOP to opt out. Msg & data rates may apply.`;
}

export function twimlMessage(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
  return `<Response><Message>${escaped}</Message></Response>`;
}

export function shouldSuspendChannel(input: {
  sends: number;
  optOuts: number;
  spikeOptOuts: number;
}): { suspend: boolean; reason: string; rate: number } {
  const rate = input.sends > 0 ? input.optOuts / input.sends : 0;
  if (input.spikeOptOuts >= OPT_OUT_SPIKE_COUNT) {
    return {
      suspend: true,
      rate,
      reason: `${input.spikeOptOuts} opt-outs in ${OPT_OUT_SPIKE_HOURS}h — ${input.sends > 0 ? "SMS" : "messaging"} paused until an owner reviews consent practices.`,
    };
  }
  if (
    input.sends >= OPT_OUT_MIN_SENDS &&
    rate >= OPT_OUT_RATE_THRESHOLD
  ) {
    return {
      suspend: true,
      rate,
      reason: `${Math.round(rate * 100)}% opt-out rate over ${OPT_OUT_WINDOW_HOURS / 24} days (${input.optOuts}/${input.sends}) — channel paused for TCPA/PECR protection.`,
    };
  }
  return { suspend: false, rate, reason: "" };
}

export async function loadOrgComplianceContext(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{
  market: Market;
  compliance: MessagingComplianceState;
  orgName: string;
  business: unknown;
}> {
  const { data } = await supabase
    .from("organizations")
    .select("name, market, messaging_compliance, business")
    .eq("id", orgId)
    .maybeSingle();
  return {
    market: data?.market === "us" ? "us" : "uk",
    orgName: String(data?.name || ""),
    compliance: readMessagingCompliance(data?.messaging_compliance),
    business: data?.business ?? null,
  };
}

async function countOutbound(
  supabase: SupabaseClient,
  input: { orgId: string; channel: MessagingChannel; sinceIso: string },
): Promise<number> {
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("org_id", input.orgId)
    .eq("direction", "outbound")
    .eq("channel", input.channel)
    .gte("sent_at", input.sinceIso);
  return count || 0;
}

async function countOptOutEvents(
  supabase: SupabaseClient,
  input: { orgId: string; channel: MessagingChannel; sinceIso: string },
): Promise<number> {
  const { count } = await supabase
    .from("consent_events")
    .select("id", { count: "exact", head: true })
    .eq("org_id", input.orgId)
    .eq("channel", input.channel)
    .eq("new_status", "opted_out")
    .gte("created_at", input.sinceIso);
  return count || 0;
}

/** Recompute SMS/email suspension from recent opt-outs vs sends. */
export async function evaluateAndMaybeSuspendMessaging(
  supabase: SupabaseClient,
  orgId: string,
): Promise<MessagingComplianceState> {
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("messaging_compliance")
    .eq("id", orgId)
    .maybeSingle();
  const current = readMessagingCompliance(orgRow?.messaging_compliance);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - OPT_OUT_WINDOW_HOURS * 3_600_000).toISOString();
  const dayAgo = new Date(now.getTime() - OPT_OUT_SPIKE_HOURS * 3_600_000).toISOString();

  const next: MessagingComplianceState = {
    ...current,
    lastEvaluatedAt: now.toISOString(),
  };

  for (const channel of ["sms", "email"] as MessagingChannel[]) {
    // Owner suspensions stay until cleared; system ones are re-evaluated.
    if (current[channel]?.by === "owner") {
      next[channel] = current[channel];
      continue;
    }
    const sends = await countOutbound(supabase, { orgId, channel, sinceIso: weekAgo });
    const optOuts = await countOptOutEvents(supabase, { orgId, channel, sinceIso: weekAgo });
    const spikeOptOuts = await countOptOutEvents(supabase, {
      orgId,
      channel,
      sinceIso: dayAgo,
    });
    const decision = shouldSuspendChannel({ sends, optOuts, spikeOptOuts });
    if (decision.suspend) {
      next[channel] = {
        suspendedAt: current[channel]?.suspendedAt || now.toISOString(),
        reason: decision.reason.replace("SMS", channel === "sms" ? "SMS" : "email"),
        by: "system",
        optOuts,
        sends,
        rate: decision.rate,
        windowHours: OPT_OUT_WINDOW_HOURS,
      };
    } else if (current[channel]?.by === "system") {
      // Rate recovered — clear automatic pause.
      delete next[channel];
    }
  }

  await supabase
    .from("organizations")
    .update({ messaging_compliance: next })
    .eq("id", orgId);

  return next;
}

export async function setChannelSuspension(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    channel: MessagingChannel;
    suspended: boolean;
    reason?: string;
    by?: "system" | "owner";
  },
): Promise<MessagingComplianceState> {
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("messaging_compliance")
    .eq("id", input.orgId)
    .maybeSingle();
  const current = readMessagingCompliance(orgRow?.messaging_compliance);
  const next: MessagingComplianceState = { ...current, lastEvaluatedAt: new Date().toISOString() };
  if (input.suspended) {
    next[input.channel] = {
      suspendedAt: new Date().toISOString(),
      reason: input.reason || `${input.channel} paused by workspace owner.`,
      by: input.by || "owner",
    };
  } else {
    delete next[input.channel];
    next.acknowledgedAt = new Date().toISOString();
  }
  await supabase
    .from("organizations")
    .update({ messaging_compliance: next })
    .eq("id", input.orgId);
  return next;
}
