import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const replySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });
  }
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .eq("org_id", profile.orgId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { data: messages } = await supabase
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at");
  return NextResponse.json({ ticket, messages: messages || [] });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const parsed = replySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Reply is required" }, { status: 400 });
  }
  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });
  }
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id")
    .eq("id", id)
    .eq("org_id", profile.orgId)
    .maybeSingle();
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await supabase.from("support_ticket_messages").insert({
    ticket_id: id,
    author_email: profile.email,
    author_kind: "org",
    body: parsed.data.body,
  });
  await supabase
    .from("support_tickets")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}
