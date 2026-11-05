import { z } from "zod";
import { requireAdminRole } from "@/lib/admin/request-admin";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/admin/ticket-desk";
import { applyHostedTicketPatch, getDeskTicket, TicketDeskError } from "@/lib/admin/ticket-db";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { adminJson } from "@/lib/admin/json";

const patchSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    assigneeEmail: z.string().trim().email().nullable().optional(),
    body: z.string().trim().min(1).max(4000).optional(),
    visibility: z.enum(["public", "internal"]).optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.priority !== undefined ||
      value.assigneeEmail !== undefined ||
      Boolean(value.body),
    { message: "Nothing to update" },
  );

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const check = await requireAdminRole("super_admin", "support_admin");
  if (!check.ok) {
    return adminJson({ error: check.error }, { status: check.status });
  }
  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return adminJson({ source: "local", schema: "desk" });
  }
  try {
    const loaded = await getDeskTicket(supabase, id);
    if (!loaded) return adminJson({ error: "Not found" }, { status: 404 });
    return adminJson({ source: "hosted", schema: loaded.schema, ticket: loaded.ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load ticket";
    const status = error instanceof TicketDeskError ? error.status : 502;
    return adminJson({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const check = await requireAdminRole("super_admin", "support_admin");
  if (!check.ok) {
    return adminJson({ error: check.error }, { status: check.status });
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return adminJson({ error: "Invalid payload" }, { status: 400 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return adminJson({ source: "local" });
  }
  const { id } = await context.params;
  try {
    const saved = await applyHostedTicketPatch(supabase, id, parsed.data, check.admin.email);
    return adminJson({ ok: true, source: "hosted", ...saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update ticket";
    const status = error instanceof TicketDeskError ? error.status : 502;
    return adminJson({ error: message }, { status });
  }
}
