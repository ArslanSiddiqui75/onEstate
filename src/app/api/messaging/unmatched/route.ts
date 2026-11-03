import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";
import { recordInboundMessage } from "@/lib/messaging/service";
import { applyLeadOptOut, isOptOutMessage } from "@/lib/messaging/opt-out";

export async function GET(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const denied = forbiddenIfNoModule(profile, "crm", "view");
  if (denied) return denied;

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ items: [] });
  }

  const { data, error } = await supabase
    .from("unmatched_inbound_messages")
    .select(
      "id, from_phone, to_phone, body, provider_sid, source, needs_opt_out, created_at, resolved_at, linked_lead_id",
    )
    .eq("org_id", profile.orgId)
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: (data || []).map((row) => ({
      id: String(row.id),
      fromPhone: String(row.from_phone),
      toPhone: row.to_phone ? String(row.to_phone) : null,
      body: String(row.body),
      providerSid: row.provider_sid ? String(row.provider_sid) : null,
      source: String(row.source || "twilio"),
      needsOptOut: Boolean(row.needs_opt_out),
      createdAt: String(row.created_at),
      linkedLeadId: row.linked_lead_id ? String(row.linked_lead_id) : null,
    })),
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("dismiss"),
    id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("link"),
    id: z.string().uuid(),
    leadId: z.string().uuid(),
  }),
]);

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const denied = forbiddenIfNoModule(profile, "crm", "edit");
  if (denied) return denied;

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Messaging unavailable" }, { status: 503 });
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: row, error: loadError } = await supabase
    .from("unmatched_inbound_messages")
    .select("*")
    .eq("id", parsed.data.id)
    .eq("org_id", profile.orgId)
    .is("resolved_at", null)
    .maybeSingle();

  if (loadError || !row) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  if (parsed.data.action === "dismiss") {
    const { error } = await supabase
      .from("unmatched_inbound_messages")
      .update({ resolved_at: now, resolved_by: profile.userId })
      .eq("id", row.id)
      .eq("org_id", profile.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const leadId = parsed.data.leadId;
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("org_id", profile.orgId)
    .maybeSingle();
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (isOptOutMessage(String(row.body)) || row.needs_opt_out) {
    await applyLeadOptOut(supabase, { orgId: profile.orgId, leadId });
  }

  const recorded = await recordInboundMessage(supabase, {
    orgId: profile.orgId,
    leadId,
    body: String(row.body),
    providerSid: row.provider_sid ? String(row.provider_sid) : null,
    source: row.source === "resend" ? "resend" : "twilio",
  });
  if (!recorded.ok) {
    return NextResponse.json({ error: "Could not attach the message" }, { status: 500 });
  }

  const { error } = await supabase
    .from("unmatched_inbound_messages")
    .update({
      resolved_at: now,
      resolved_by: profile.userId,
      linked_lead_id: leadId,
    })
    .eq("id", row.id)
    .eq("org_id", profile.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, leadId });
}
