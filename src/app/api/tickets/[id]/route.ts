import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyHostedCustomerPriority,
  applyHostedCustomerReply,
  TicketDeskError,
} from "@/lib/admin/ticket-db";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const replySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

const prioritySchema = z.object({
  priority: z.enum(["low", "normal", "high"]),
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
  const visible = (messages || []).filter((message) => message.author_kind !== "internal");
  return NextResponse.json({ ticket, messages: visible });
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
  try {
    await applyHostedCustomerReply(supabase, id, profile.email, parsed.data.body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send reply";
    const status = error instanceof TicketDeskError ? error.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const parsed = prioritySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a priority" }, { status: 400 });
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
  try {
    await applyHostedCustomerPriority(supabase, id, profile.email, parsed.data.priority);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update priority";
    const status = error instanceof TicketDeskError ? error.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
