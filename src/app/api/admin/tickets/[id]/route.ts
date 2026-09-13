import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/admin/request-admin";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  body: z.string().trim().min(1).max(4000).optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const check = await requireAdminRole("super_admin", "support_admin");
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });
  }
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*, organizations(name)")
    .eq("id", id)
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const check = await requireAdminRole("super_admin", "support_admin");
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });
  }

  if (parsed.data.status) {
    await supabase
      .from("support_tickets")
      .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
      .eq("id", id);
  }
  if (parsed.data.body) {
    await supabase.from("support_ticket_messages").insert({
      ticket_id: id,
      author_email: check.admin.email,
      author_kind: "admin",
      body: parsed.data.body,
    });
    await supabase
      .from("support_tickets")
      .update({
        status: parsed.data.status || "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }
  return NextResponse.json({ ok: true });
}
