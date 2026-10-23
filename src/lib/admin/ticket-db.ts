import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyTicketPatch,
  isTicketPriority,
  isTicketStatus,
  projectCustomerReply,
  withTicketFacts,
  type DeskTicket,
  type TicketEvent,
  type TicketMessage,
  type TicketPatch,
} from "@/lib/admin/ticket-desk";

export const DESK_MIGRATION_WARNING =
  "Support desk columns are not on this database yet. Status and public replies were saved. Apply the support desk migration to record who resolved a ticket and how long it took.";

const RICH_COLUMNS =
  "id, org_id, subject, body, status, priority, created_at, updated_at, created_by, requester_email, requester_name, assignee_email, assigned_at, first_response_at, first_response_by, resolved_at, resolved_by, closed_at, closed_by, organizations(name)";

const BASIC_COLUMNS =
  "id, org_id, subject, body, status, priority, created_at, updated_at, created_by, organizations(name)";

type DbError = { code?: string; message?: string } | null;
type TicketRow = {
  id: string;
  org_id: string;
  subject: string;
  body?: string | null;
  status?: string | null;
  priority?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  requester_email?: string | null;
  requester_name?: string | null;
  assignee_email?: string | null;
  assigned_at?: string | null;
  first_response_at?: string | null;
  first_response_by?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  organizations?: { name?: string } | { name?: string }[] | null;
};

export class TicketDeskError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "TicketDeskError";
    this.status = status;
  }
}

export function isSchemaGap(error: DbError) {
  if (!error) return false;
  const code = error.code || "";
  const message = error.message || "";
  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    /does not exist/i.test(message) ||
    /schema cache/i.test(message) ||
    /could not find/i.test(message)
  );
}

function isCheckViolation(error: DbError) {
  if (!error) return false;
  return error.code === "23514" || /check constraint/i.test(error.message || "");
}

function orgName(row: TicketRow) {
  const org = row.organizations;
  const name = Array.isArray(org) ? org[0]?.name : org?.name;
  return name || "Workspace";
}

function toMessage(row: {
  id: string;
  author_email: string;
  author_kind: string;
  body: string;
  created_at: string;
}): TicketMessage {
  const kind = row.author_kind === "admin" || row.author_kind === "internal" ? row.author_kind : "org";
  return {
    id: row.id,
    authorEmail: row.author_email,
    authorKind: kind,
    body: row.body,
    createdAt: row.created_at,
  };
}

function toEvent(row: {
  id: string;
  kind: string;
  actor_email: string;
  summary: string;
  created_at: string;
}): TicketEvent {
  const known = ["opened", "assigned", "replied", "noted", "status", "priority", "resolved", "reopened", "closed"] as const;
  const kind = known.find((item) => item === row.kind) || "status";
  return {
    id: row.id,
    kind,
    actorEmail: row.actor_email,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

function toTicket(
  row: TicketRow,
  messages: TicketMessage[],
  events: TicketEvent[],
  names: Map<string, string>,
): DeskTicket {
  const status = row.status && isTicketStatus(row.status) ? row.status : "open";
  const priority = row.priority && isTicketPriority(row.priority) ? row.priority : "normal";
  return withTicketFacts({
    id: row.id,
    orgId: row.org_id,
    orgName: orgName(row),
    subject: row.subject,
    body: row.body || "",
    status,
    priority,
    requesterEmail: row.requester_email || "",
    requesterName: row.requester_name || (row.created_by ? names.get(row.created_by) || "" : ""),
    assigneeEmail: row.assignee_email || null,
    assignedAt: row.assigned_at || null,
    firstResponseAt: row.first_response_at || null,
    firstResponseBy: row.first_response_by || null,
    resolvedAt: row.resolved_at || null,
    resolvedBy: row.resolved_by || null,
    closedAt: row.closed_at || null,
    closedBy: row.closed_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages,
    events,
  });
}

async function requesterNames(supabase: SupabaseClient, rows: TicketRow[]) {
  const ids = [...new Set(rows.map((row) => row.created_by).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (!ids.length) return names;
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  for (const row of data || []) {
    if (row.full_name) names.set(String(row.id), String(row.full_name));
  }
  return names;
}

async function loadMessages(supabase: SupabaseClient, ids: string[]) {
  const grouped = new Map<string, TicketMessage[]>();
  if (!ids.length) return grouped;
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("id, ticket_id, author_email, author_kind, body, created_at")
    .in("ticket_id", ids)
    .order("created_at");
  if (error) return grouped;
  for (const row of data || []) {
    const list = grouped.get(row.ticket_id) || [];
    list.push(toMessage(row));
    grouped.set(row.ticket_id, list);
  }
  return grouped;
}

async function loadEvents(supabase: SupabaseClient, ids: string[]) {
  const grouped = new Map<string, TicketEvent[]>();
  if (!ids.length) return grouped;
  const { data, error } = await supabase
    .from("support_ticket_events")
    .select("id, ticket_id, kind, actor_email, summary, created_at")
    .in("ticket_id", ids)
    .order("created_at");
  if (error) return grouped;
  for (const row of data || []) {
    const list = grouped.get(row.ticket_id) || [];
    list.push(toEvent(row));
    grouped.set(row.ticket_id, list);
  }
  return grouped;
}

async function selectRows(supabase: SupabaseClient, id?: string) {
  let query = supabase.from("support_tickets").select(RICH_COLUMNS);
  query = id ? query.eq("id", id) : query.order("updated_at", { ascending: false }).limit(200);
  const rich = await query;
  if (!rich.error) return { schema: "desk" as const, rows: (rich.data || []) as TicketRow[] };
  if (!isSchemaGap(rich.error)) throw new TicketDeskError(rich.error.message, 502);
  let basic = supabase.from("support_tickets").select(BASIC_COLUMNS);
  basic = id ? basic.eq("id", id) : basic.order("updated_at", { ascending: false }).limit(200);
  const fallback = await basic;
  if (fallback.error) throw new TicketDeskError(fallback.error.message, 502);
  return { schema: "basic" as const, rows: (fallback.data || []) as TicketRow[] };
}

export async function listDeskTickets(supabase: SupabaseClient) {
  const selected = await selectRows(supabase);
  const ids = selected.rows.map((row) => row.id);
  const [messages, events, names] = await Promise.all([
    loadMessages(supabase, ids),
    selected.schema === "desk" ? loadEvents(supabase, ids) : Promise.resolve(new Map<string, TicketEvent[]>()),
    requesterNames(supabase, selected.rows),
  ]);
  return {
    schema: selected.schema,
    tickets: selected.rows.map((row) =>
      toTicket(row, messages.get(row.id) || [], events.get(row.id) || [], names),
    ),
  };
}

export async function getDeskTicket(supabase: SupabaseClient, id: string) {
  const selected = await selectRows(supabase, id);
  const row = selected.rows[0];
  if (!row) return null;
  const [messages, events, names] = await Promise.all([
    loadMessages(supabase, [id]),
    loadEvents(supabase, [id]),
    requesterNames(supabase, [row]),
  ]);
  return {
    schema: selected.schema,
    ticket: toTicket(row, messages.get(id) || [], events.get(id) || [], names),
  };
}

async function insertFresh<T extends { id: string }>(
  previous: T[],
  next: T[],
  insert: (row: T) => Promise<DbError>,
) {
  const seen = new Set(previous.map((row) => row.id));
  for (const row of next) {
    if (seen.has(row.id)) continue;
    const error = await insert(row);
    if (error) return error;
  }
  return null;
}

export async function persistDeskTicket(
  supabase: SupabaseClient,
  previous: DeskTicket,
  next: DeskTicket,
): Promise<{ schema: "desk" | "basic"; warning?: string }> {
  const messageError = await insertFresh(previous.messages, next.messages, async (message) => {
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: next.id,
      author_email: message.authorEmail,
      author_kind: message.authorKind,
      body: message.body,
      created_at: message.createdAt,
    });
    if (error && message.authorKind === "internal" && isCheckViolation(error)) {
      throw new TicketDeskError(
        "Apply the support desk migration before saving an internal note.",
        409,
      );
    }
    return error;
  });
  if (messageError) throw new TicketDeskError(messageError.message || "Could not save the reply", 502);

  const richPatch = {
    status: next.status,
    priority: next.priority,
    updated_at: next.updatedAt,
    requester_email: next.requesterEmail || null,
    requester_name: next.requesterName || null,
    assignee_email: next.assigneeEmail,
    assigned_at: next.assignedAt,
    first_response_at: next.firstResponseAt,
    first_response_by: next.firstResponseBy,
    resolved_at: next.resolvedAt,
    resolved_by: next.resolvedBy,
    closed_at: next.closedAt,
    closed_by: next.closedBy,
  };
  const updated = await supabase.from("support_tickets").update(richPatch).eq("id", next.id);
  if (updated.error && isSchemaGap(updated.error)) {
    const basic = await supabase
      .from("support_tickets")
      .update({ status: next.status, priority: next.priority, updated_at: next.updatedAt })
      .eq("id", next.id);
    if (basic.error) throw new TicketDeskError(basic.error.message, 502);
    return { schema: "basic", warning: DESK_MIGRATION_WARNING };
  }
  if (updated.error) throw new TicketDeskError(updated.error.message, 502);

  const eventError = await insertFresh(previous.events, next.events, async (item) => {
    const { error } = await supabase.from("support_ticket_events").insert({
      ticket_id: next.id,
      kind: item.kind,
      actor_email: item.actorEmail,
      summary: item.summary,
      created_at: item.createdAt,
    });
    return error;
  });
  if (eventError && !isSchemaGap(eventError)) {
    throw new TicketDeskError(eventError.message || "Could not save the timeline", 502);
  }
  return { schema: "desk" };
}

export async function applyHostedTicketPatch(
  supabase: SupabaseClient,
  id: string,
  patch: TicketPatch,
  actorEmail: string,
) {
  const loaded = await getDeskTicket(supabase, id);
  if (!loaded) throw new TicketDeskError("Not found", 404);
  const next = applyTicketPatch(loaded.ticket, patch, { email: actorEmail }, new Date());
  const saved = await persistDeskTicket(supabase, loaded.ticket, next);
  return { ...saved, ticket: next };
}

export async function applyHostedCustomerReply(
  supabase: SupabaseClient,
  id: string,
  email: string,
  body: string,
) {
  const loaded = await getDeskTicket(supabase, id);
  if (!loaded) throw new TicketDeskError("Not found", 404);
  const next = projectCustomerReply(loaded.ticket, body, email, new Date());
  return persistDeskTicket(supabase, loaded.ticket, next);
}

export async function insertHostedTicket(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    userId: string;
    email: string;
    subject: string;
    body: string;
    priority: "low" | "normal" | "high";
  },
) {
  const now = new Date().toISOString();
  const rich = await supabase
    .from("support_tickets")
    .insert({
      org_id: input.orgId,
      created_by: input.userId,
      subject: input.subject,
      body: input.body,
      priority: input.priority,
      requester_email: input.email,
      requester_name: input.email,
    })
    .select("id")
    .single();
  let created = rich.data;
  let error = rich.error;
  if (error && isSchemaGap(error)) {
    const basic = await supabase
      .from("support_tickets")
      .insert({
        org_id: input.orgId,
        created_by: input.userId,
        subject: input.subject,
        body: input.body,
        priority: input.priority,
      })
      .select("id")
      .single();
    created = basic.data;
    error = basic.error;
  }
  if (error || !created) {
    throw new TicketDeskError(error?.message || "Could not create ticket", 502);
  }
  await supabase.from("support_ticket_messages").insert({
    ticket_id: created.id,
    author_email: input.email,
    author_kind: "org",
    body: input.body,
  });
  await supabase.from("support_ticket_events").insert({
    ticket_id: created.id,
    kind: "opened",
    actor_email: input.email,
    summary: "Opened by the workspace.",
    created_at: now,
  });
  return created.id as string;
}
