import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin/request-admin";
import { listDeskTickets, TicketDeskError } from "@/lib/admin/ticket-db";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const check = await requireAdminRole("super_admin", "support_admin");
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ source: "local", schema: "desk", tickets: [] });
  }
  try {
    const desk = await listDeskTickets(supabase);
    return NextResponse.json({ source: "hosted", schema: desk.schema, tickets: desk.tickets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load tickets";
    const status = error instanceof TicketDeskError ? error.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
