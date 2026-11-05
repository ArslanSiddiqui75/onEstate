import { requireAdminRole } from "@/lib/admin/request-admin";
import { listDeskTickets, TicketDeskError } from "@/lib/admin/ticket-db";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { adminJson } from "@/lib/admin/json";

export async function GET() {
  const check = await requireAdminRole("super_admin", "support_admin");
  if (!check.ok) {
    return adminJson({ error: check.error }, { status: check.status });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return adminJson({ source: "local", schema: "desk", tickets: [] });
  }
  try {
    const desk = await listDeskTickets(supabase);
    return adminJson({ source: "hosted", schema: desk.schema, tickets: desk.tickets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load tickets";
    const status = error instanceof TicketDeskError ? error.status : 502;
    return adminJson({ error: message }, { status });
  }
}
