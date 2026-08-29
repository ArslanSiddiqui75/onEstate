import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { triggerAndProcess } from "@/lib/automations/engine";
import { normalizeHost } from "@/lib/website/slug";
import { normalizePhoneNumber } from "@/lib/utils";
import type { LeadType } from "@/types";

const bodySchema = z.object({
  /** Public site slug or custom domain the form was rendered on */
  site: z.string().min(1),
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  message: z.string().max(2000).optional(),
  type: z.enum(["buyer", "seller", "landlord", "tenant"]).optional(),
  /** Hidden field real users never fill in */
  honeypot: z.string().max(0).optional(),
});

// Public endpoint, so keep a coarse per-IP ceiling. Resets on cold start, which
// is acceptable for form spam; a durable limiter belongs in front of the app.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const recentSubmissions = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (recentSubmissions.get(key) || []).filter(
    (at) => now - at < RATE_LIMIT_WINDOW_MS,
  );
  hits.push(now);
  recentSubmissions.set(key, hits);
  return hits.length > RATE_LIMIT_MAX;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || "unknown";
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }
  // Bots fill every field; answer 200 so they don't learn they were filtered.
  if (parsed.data.honeypot) {
    return NextResponse.json({ ok: true });
  }
  if (!parsed.data.email && !parsed.data.phone) {
    return NextResponse.json(
      { error: "Add an email or phone number so we can reply" },
      { status: 400 },
    );
  }

  const ip = clientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions — try again shortly" },
      { status: 429 },
    );
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Capture unavailable" }, { status: 503 });
  }

  const candidate = parsed.data.site.trim();
  const host = normalizeHost(candidate);
  const { data: siteRows } = await supabase
    .from("websites")
    .select("org_id, slug, published")
    .or(`slug.eq.${candidate},custom_domain.eq.${host}`)
    .limit(1);

  const siteRow = siteRows?.[0];
  if (!siteRow || !siteRow.published) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  const orgId = String(siteRow.org_id);

  const { data: org } = await supabase
    .from("organizations")
    .select("id, market")
    .eq("id", orgId)
    .maybeSingle();

  const phone = parsed.data.phone ? normalizePhoneNumber(parsed.data.phone) : "";

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      org_id: orgId,
      name: parsed.data.name.trim(),
      email: parsed.data.email || null,
      phone: phone || null,
      lead_type: (parsed.data.type || "buyer") satisfies LeadType,
      stage: "new",
      score: 0,
      market: org?.market || "uk",
      source: "Website",
      capture_source: "website",
      notes: parsed.data.message?.trim() || null,
      next_action: "Respond to website enquiry",
      priority: "high",
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return NextResponse.json(
      { error: "Could not save your enquiry" },
      { status: 500 },
    );
  }

  const leadId = String(lead.id);

  // Automations match on lead_phone_numbers, so a captured phone has to land
  // there too — not just on the lead row.
  if (phone) {
    await supabase.from("lead_phone_numbers").insert({
      lead_id: leadId,
      org_id: orgId,
      label: "Primary",
      number: phone,
      source: "website",
      consent: "unknown",
      verification: "unverified",
      preferred: true,
    });
  }

  await supabase.from("lead_activities").insert({
    org_id: orgId,
    lead_id: leadId,
    activity_type: "website_enquiry",
    body: parsed.data.message?.trim() || `${parsed.data.name} enquired via the website`,
    metadata: { slug: siteRow.slug, email: parsed.data.email, phone },
  });

  await supabase.from("lead_capture_events").insert({
    org_id: orgId,
    lead_id: leadId,
    channel: "website",
    slug: siteRow.slug,
    message: parsed.data.message?.trim() || null,
    payload: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: phone || null,
      type: parsed.data.type || "buyer",
    },
  });

  // Fire `lead_created` workflows so website enquiries get the same instant
  // follow-up as leads added by an agent.
  await triggerAndProcess(supabase, {
    orgId,
    leadId,
    trigger: "lead_created",
    stage: "new",
  }).catch(() => null);

  return NextResponse.json({ ok: true, leadId });
}
