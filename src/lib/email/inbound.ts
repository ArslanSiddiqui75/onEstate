import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_LEAD_RE = /^lead_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface InboundEmailMeta {
  emailId: string;
  from: string;
  to: string[];
  receivedFor: string[];
  subject: string;
  messageId?: string;
}

export interface ReceivedEmailContent {
  text: string | null;
  html: string | null;
  subject?: string;
  from?: string;
  to?: string[];
}

export function inboundAddress(): string {
  return (process.env.EMAIL_INBOUND_ADDRESS || "").trim();
}

/** Reply-To so a lead's reply hits our inbound address tagged with the lead id. */
export function inboundReplyTo(leadId: string): string | undefined {
  const addr = inboundAddress();
  const at = addr.lastIndexOf("@");
  if (at <= 0) return undefined;
  const local = addr.slice(0, at).trim();
  const domain = addr.slice(at + 1).trim();
  if (!local || !domain) return undefined;
  return `${local}+${leadId}@${domain}`;
}

export function bareEmail(value: string): string {
  const trimmed = value.trim();
  const angled = trimmed.match(/<([^>]+)>/);
  return (angled?.[1] || trimmed).trim().toLowerCase();
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function inboundBodyFromContent(content: ReceivedEmailContent | null, fallbackSubject: string) {
  const text = content?.text?.trim();
  if (text) return text.slice(0, 20000);
  const html = content?.html?.trim();
  if (html) {
    const converted = htmlToPlainText(html);
    if (converted) return converted.slice(0, 20000);
  }
  const subject = (content?.subject || fallbackSubject).trim();
  return subject || "(empty email)";
}

function isLeadTag(value: string) {
  return UUID_RE.test(value) || LOCAL_LEAD_RE.test(value);
}

export function extractLeadTag(addresses: string[]): string | null {
  for (const raw of addresses) {
    const email = bareEmail(raw);
    if (!email.includes("@")) continue;
    const local = email.slice(0, email.indexOf("@"));
    const plus = local.includes("+") ? local.slice(local.indexOf("+") + 1) : "";
    for (const candidate of [plus, local]) {
      if (candidate && isLeadTag(candidate)) return candidate;
    }
  }
  return null;
}

export function parseInboundEmailEvent(payload: unknown): InboundEmailMeta | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as { type?: string; data?: Record<string, unknown> };
  if (root.type && root.type !== "email.received") return null;
  const data = (root.data && typeof root.data === "object" ? root.data : payload) as Record<
    string,
    unknown
  >;
  const emailId = String(data.email_id || data.id || "").trim();
  const from = String(data.from || "").trim();
  if (!emailId || !from) return null;
  const to = Array.isArray(data.to) ? data.to.map((item) => String(item)) : [];
  const receivedFor = Array.isArray(data.received_for)
    ? data.received_for.map((item) => String(item))
    : [];
  return {
    emailId,
    from,
    to,
    receivedFor,
    subject: String(data.subject || "").trim(),
    messageId: data.message_id ? String(data.message_id) : undefined,
  };
}

export async function fetchReceivedEmail(
  emailId: string,
): Promise<ReceivedEmailContent | null> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) return null;
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as ReceivedEmailContent | null;
  if (!json || typeof json !== "object") return null;
  return {
    text: typeof json.text === "string" ? json.text : null,
    html: typeof json.html === "string" ? json.html : null,
    subject: typeof json.subject === "string" ? json.subject : undefined,
    from: typeof json.from === "string" ? json.from : undefined,
    to: Array.isArray(json.to) ? json.to.map((item) => String(item)) : undefined,
  };
}

export async function findLeadForInboundEmail(
  supabase: SupabaseClient,
  meta: InboundEmailMeta,
): Promise<{ leadId: string; orgId: string } | null> {
  const tag = extractLeadTag([...meta.receivedFor, ...meta.to]);
  if (tag) {
    const { data } = await supabase
      .from("leads")
      .select("id, org_id")
      .eq("id", tag)
      .maybeSingle();
    if (data) {
      return { leadId: String(data.id), orgId: String(data.org_id) };
    }
  }

  const from = bareEmail(meta.from);
  if (!from) return null;

  const { data: leads } = await supabase
    .from("leads")
    .select("id, org_id, email")
    .ilike("email", from)
    .limit(20);
  if (!leads?.length) return null;
  if (leads.length === 1) {
    return { leadId: String(leads[0].id), orgId: String(leads[0].org_id) };
  }

  const ids = leads.map((row) => String(row.id));
  const { data: thread } = await supabase
    .from("conversation_threads")
    .select("lead_id, org_id, last_message_at")
    .in("lead_id", ids)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (thread) {
    return { leadId: String(thread.lead_id), orgId: String(thread.org_id) };
  }

  return { leadId: String(leads[0].id), orgId: String(leads[0].org_id) };
}
