/**
 * Support desk math. Handle time is how long the resolving operator spent on
 * the ticket. Time to resolve is the workspace's full wait from open to resolved.
 */
import { PLATFORM_ADMIN_ACCOUNTS } from "@/lib/admin/accounts";

export const TICKET_STATUSES = ["open", "pending", "resolved", "closed"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high"] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketAuthorKind = "org" | "admin" | "internal";
export type TicketListFilter =
  | "all"
  | "active"
  | "support"
  | "customer"
  | "unassigned"
  | "breached"
  | "resolved";

export type TicketMessage = {
  id: string;
  authorEmail: string;
  authorKind: TicketAuthorKind;
  body: string;
  createdAt: string;
};

export type TicketEvent = {
  id: string;
  kind: "opened" | "assigned" | "replied" | "noted" | "status" | "priority" | "resolved" | "reopened" | "closed";
  actorEmail: string;
  summary: string;
  createdAt: string;
};

export type DeskTicket = {
  id: string;
  orgId: string;
  orgName: string;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterEmail: string;
  requesterName: string;
  assigneeEmail: string | null;
  assignedAt: string | null;
  firstResponseAt: string | null;
  firstResponseBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  closedAt: string | null;
  closedBy: string | null;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
  events: TicketEvent[];
};

export type TicketPatch = {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeEmail?: string | null;
  body?: string;
  visibility?: "public" | "internal";
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** First response and resolution targets, by priority. */
export const SLA_TARGETS_MS: Record<TicketPriority, { firstResponse: number; resolve: number }> = {
  high: { firstResponse: 4 * HOUR, resolve: 24 * HOUR },
  normal: { firstResponse: 24 * HOUR, resolve: 72 * HOUR },
  low: { firstResponse: 48 * HOUR, resolve: 7 * 24 * HOUR },
};

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

export function isTicketPriority(value: string): value is TicketPriority {
  return (TICKET_PRIORITIES as readonly string[]).includes(value);
}

export function supportOperatorName(email: string | null | undefined): string {
  if (!email) return "—";
  const account = PLATFORM_ADMIN_ACCOUNTS.find(
    (item) => item.email.toLowerCase() === email.toLowerCase(),
  );
  return account?.name || email;
}

export function ticketStatusLabel(status: TicketStatus, audience: "admin" | "tenant" = "admin") {
  if (status === "open") return "Waiting on support";
  if (status === "pending") return audience === "tenant" ? "Waiting on you" : "Waiting on customer";
  if (status === "resolved") return "Resolved";
  return "Closed";
}

export function ticketPriorityLabel(priority: TicketPriority) {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Normal";
}

export function ticketStatusTone(status: TicketStatus): "accent" | "warning" | "success" | "neutral" {
  if (status === "open") return "accent";
  if (status === "pending") return "warning";
  if (status === "resolved") return "success";
  return "neutral";
}

export function ticketPriorityTone(priority: TicketPriority): "danger" | "accent" | "neutral" {
  if (priority === "high") return "danger";
  if (priority === "low") return "neutral";
  return "accent";
}

export function formatDeskDuration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  const minutes = Math.max(0, Math.round(ms / MINUTE));
  if (minutes < 1) return "Under a minute";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 48) return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}

export function withTicketFacts(ticket: DeskTicket): DeskTicket {
  const messages = [...ticket.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const opener = messages.find((message) => message.authorKind === "org");
  let firstResponseAt = ticket.firstResponseAt;
  let firstResponseBy = ticket.firstResponseBy;
  if (!firstResponseAt) {
    const reply = messages.find((message) => message.authorKind === "admin");
    if (reply) {
      firstResponseAt = reply.createdAt;
      firstResponseBy = firstResponseBy || reply.authorEmail;
    }
  }
  return {
    ...ticket,
    messages,
    requesterEmail: ticket.requesterEmail || opener?.authorEmail || "",
    requesterName: ticket.requesterName || ticket.requesterEmail || opener?.authorEmail || "Workspace user",
    firstResponseAt,
    firstResponseBy,
  };
}

export function firstResponseMs(ticket: DeskTicket): number | null {
  const facts = ticket.firstResponseAt ? ticket : withTicketFacts(ticket);
  if (!facts.firstResponseAt) return null;
  return Date.parse(facts.firstResponseAt) - Date.parse(ticket.createdAt);
}

export function timeToResolveMs(ticket: DeskTicket): number | null {
  const end = ticket.resolvedAt || ticket.closedAt;
  if (!end) return null;
  return Date.parse(end) - Date.parse(ticket.createdAt);
}

function handleStartIso(ticket: DeskTicket): string | null {
  const resolver = ticket.resolvedBy || ticket.closedBy;
  if (
    ticket.assigneeEmail &&
    ticket.assignedAt &&
    (!resolver || ticket.assigneeEmail.toLowerCase() === resolver.toLowerCase())
  ) {
    return ticket.assignedAt;
  }
  const replies = ticket.messages
    .filter(
      (message) =>
        message.authorKind === "admin" &&
        (!resolver || message.authorEmail.toLowerCase() === resolver.toLowerCase()),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (replies[0]) return replies[0].createdAt;
  if (
    ticket.firstResponseAt &&
    (!resolver ||
      (ticket.firstResponseBy &&
        ticket.firstResponseBy.toLowerCase() === resolver.toLowerCase()))
  ) {
    return ticket.firstResponseAt;
  }
  return null;
}

/** Elapsed time from when the resolver took the ticket until they resolved it. */
export function handleClock(
  ticket: DeskTicket,
  now: number,
): { ms: number; complete: boolean } | null {
  const start = handleStartIso(ticket);
  if (!start) return null;
  const done = Boolean(ticket.resolvedAt || ticket.closedAt);
  const endIso = ticket.resolvedAt || ticket.closedAt;
  const end = endIso ? Date.parse(endIso) : done ? null : now;
  if (end == null) return null;
  return { ms: Math.max(0, end - Date.parse(start)), complete: done };
}

export function resolverEmail(ticket: DeskTicket): string | null {
  return ticket.resolvedBy || ticket.closedBy;
}

export type SlaMark = "met" | "due" | "breached" | "none";

export function slaMarks(ticket: DeskTicket, now: number): { firstResponse: SlaMark; resolve: SlaMark } {
  const target = SLA_TARGETS_MS[ticket.priority];
  const response = firstResponseMs(ticket);
  const opened = Date.parse(ticket.createdAt);
  const firstResponse: SlaMark =
    response == null
      ? ticket.status === "resolved" || ticket.status === "closed"
        ? "none"
        : now - opened > target.firstResponse
          ? "breached"
          : "due"
      : response <= target.firstResponse
        ? "met"
        : "breached";
  const finished = ticket.resolvedAt || ticket.closedAt;
  const elapsed = (finished ? Date.parse(finished) : now) - opened;
  const resolve: SlaMark = finished
    ? elapsed <= target.resolve
      ? "met"
      : "breached"
    : elapsed > target.resolve
      ? "breached"
      : "due";
  return { firstResponse, resolve };
}

export function slaMarkLabel(mark: SlaMark) {
  if (mark === "met") return "Met";
  if (mark === "breached") return "Breached";
  if (mark === "due") return "Within SLA";
  return "—";
}

export function waitingOn(ticket: DeskTicket): "support" | "customer" | "done" {
  if (ticket.status === "pending") return "customer";
  if (ticket.status === "resolved" || ticket.status === "closed") return "done";
  return "support";
}

export function deskSummary(tickets: DeskTicket[], now: number) {
  const active = tickets.filter((ticket) => ticket.status === "open" || ticket.status === "pending");
  const responses = tickets
    .map((ticket) => firstResponseMs(ticket))
    .filter((value): value is number => value != null);
  const resolutions = tickets
    .map((ticket) => timeToResolveMs(ticket))
    .filter((value): value is number => value != null);
  const average = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return {
    active: active.length,
    waitingOnSupport: tickets.filter((ticket) => ticket.status === "open").length,
    waitingOnCustomer: tickets.filter((ticket) => ticket.status === "pending").length,
    unassigned: active.filter((ticket) => !ticket.assigneeEmail).length,
    breached: active.filter((ticket) => {
      const marks = slaMarks(ticket, now);
      return marks.firstResponse === "breached" || marks.resolve === "breached";
    }).length,
    resolved: tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed").length,
    avgFirstResponseMs: average(responses),
    avgTimeToResolveMs: average(resolutions),
  };
}

export function ticketInFilter(ticket: DeskTicket, filter: TicketListFilter, now: number) {
  const done = ticket.status === "resolved" || ticket.status === "closed";
  if (filter === "all") return true;
  if (filter === "active") return !done;
  if (filter === "support") return ticket.status === "open";
  if (filter === "customer") return ticket.status === "pending";
  if (filter === "unassigned") return !done && !ticket.assigneeEmail;
  if (filter === "breached") {
    if (done) return false;
    const marks = slaMarks(ticket, now);
    return marks.firstResponse === "breached" || marks.resolve === "breached";
  }
  return done;
}

export function ticketMatchesQuery(ticket: DeskTicket, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    ticket.subject,
    ticket.orgName,
    ticket.requesterName,
    ticket.requesterEmail,
    ticket.assigneeEmail ? supportOperatorName(ticket.assigneeEmail) : "",
    resolverEmail(ticket) ? supportOperatorName(resolverEmail(ticket)) : "",
    ticketStatusLabel(ticket.status),
    ticketPriorityLabel(ticket.priority),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function messageAuthorLabel(ticket: DeskTicket, message: TicketMessage) {
  if (message.authorKind === "internal") {
    return `${supportOperatorName(message.authorEmail)} · Internal note`;
  }
  if (message.authorKind === "admin") {
    return `${supportOperatorName(message.authorEmail)} · Support`;
  }
  if (
    ticket.requesterName &&
    message.authorEmail &&
    ticket.requesterEmail &&
    message.authorEmail.toLowerCase() === ticket.requesterEmail.toLowerCase()
  ) {
    return ticket.requesterName;
  }
  return message.authorEmail || "Workspace";
}

let stamp = 0;
function nextId(prefix: string, now: Date) {
  stamp += 1;
  return `${prefix}_${now.getTime().toString(36)}_${stamp.toString(36)}`;
}

function event(
  kind: TicketEvent["kind"],
  actorEmail: string,
  summary: string,
  now: Date,
): TicketEvent {
  return { id: nextId("evt", now), kind, actorEmail, summary, createdAt: now.toISOString() };
}

export function projectTicketAction(
  ticket: DeskTicket,
  action:
    | { type: "assign"; assigneeEmail: string | null }
    | { type: "status"; status: TicketStatus }
    | { type: "priority"; priority: TicketPriority }
    | { type: "reply"; body: string; visibility: "public" | "internal" },
  actor: { email: string },
  now: Date,
): DeskTicket {
  const nowIso = now.toISOString();
  if (action.type === "assign") {
    const nextEmail = action.assigneeEmail?.trim() || null;
    if ((ticket.assigneeEmail || null) === nextEmail) return ticket;
    return {
      ...ticket,
      assigneeEmail: nextEmail,
      assignedAt: nextEmail ? nowIso : null,
      updatedAt: nowIso,
      events: [
        ...ticket.events,
        event(
          "assigned",
          actor.email,
          nextEmail
            ? `Assigned to ${supportOperatorName(nextEmail)}.`
            : "Returned to the unassigned queue.",
          now,
        ),
      ],
    };
  }

  if (action.type === "priority") {
    if (ticket.priority === action.priority) return ticket;
    return {
      ...ticket,
      priority: action.priority,
      updatedAt: nowIso,
      events: [
        ...ticket.events,
        event("priority", actor.email, `Priority set to ${ticketPriorityLabel(action.priority)}.`, now),
      ],
    };
  }

  if (action.type === "reply") {
    const visibility = action.visibility === "internal" ? "internal" : "public";
    const kind: TicketAuthorKind = visibility === "internal" ? "internal" : "admin";
    const message: TicketMessage = {
      id: nextId("msg", now),
      authorEmail: actor.email,
      authorKind: kind,
      body: action.body.trim(),
      createdAt: nowIso,
    };
    const firstReply = kind === "admin" && !ticket.firstResponseAt;
    return {
      ...ticket,
      status: kind === "admin" && ticket.status === "open" ? "pending" : ticket.status,
      firstResponseAt: firstReply ? nowIso : ticket.firstResponseAt,
      firstResponseBy: firstReply ? actor.email : ticket.firstResponseBy,
      updatedAt: nowIso,
      messages: [...ticket.messages, message],
      events: [
        ...ticket.events,
        event(
          kind === "internal" ? "noted" : "replied",
          actor.email,
          kind === "internal"
            ? "Added an internal note."
            : ticket.status === "open"
              ? "Replied to the workspace. Waiting on the customer."
              : "Replied to the workspace.",
          now,
        ),
      ],
    };
  }

  if (ticket.status === action.status) return ticket;
  const events = [...ticket.events];
  const wasDone = ticket.status === "resolved" || ticket.status === "closed";
  const willBeDone = action.status === "resolved" || action.status === "closed";
  let next: DeskTicket = { ...ticket, status: action.status, updatedAt: nowIso, events };

  if (wasDone && !willBeDone) {
    const who = supportOperatorName(ticket.resolvedBy || ticket.closedBy);
    const took = formatDeskDuration(handleClock(ticket, now.getTime())?.ms ?? timeToResolveMs(ticket));
    events.push(
      event("reopened", actor.email, `Reopened. ${who} had resolved it in ${took}.`, now),
    );
    next = { ...next, resolvedAt: null, resolvedBy: null, closedAt: null, closedBy: null };
  }

  if (action.status === "resolved") {
    next = {
      ...next,
      resolvedAt: next.resolvedAt || nowIso,
      resolvedBy: next.resolvedBy || actor.email,
      closedAt: null,
      closedBy: null,
    };
    const took = formatDeskDuration(handleClock(next, now.getTime())?.ms ?? null);
    events.push(
      event(
        "resolved",
        actor.email,
        took === "—"
          ? `Resolved by ${supportOperatorName(actor.email)}.`
          : `Resolved by ${supportOperatorName(actor.email)} in ${took}.`,
        now,
      ),
    );
  }

  if (action.status === "closed") {
    next = {
      ...next,
      resolvedAt: next.resolvedAt || nowIso,
      resolvedBy: next.resolvedBy || actor.email,
      closedAt: nowIso,
      closedBy: actor.email,
    };
    events.push(event("closed", actor.email, `Closed by ${supportOperatorName(actor.email)}.`, now));
  }

  if ((action.status === "open" || action.status === "pending") && !wasDone) {
    events.push(
      event(
        "status",
        actor.email,
        action.status === "open" ? "Waiting on support." : "Waiting on the customer.",
        now,
      ),
    );
  }

  return { ...next, events };
}

export function applyTicketPatch(
  ticket: DeskTicket,
  patch: TicketPatch,
  actor: { email: string },
  now: Date,
): DeskTicket {
  let next = ticket;
  if (patch.assigneeEmail !== undefined) {
    next = projectTicketAction(next, { type: "assign", assigneeEmail: patch.assigneeEmail }, actor, now);
  }
  if (patch.priority) {
    next = projectTicketAction(next, { type: "priority", priority: patch.priority }, actor, now);
  }
  if (patch.body?.trim()) {
    next = projectTicketAction(
      next,
      { type: "reply", body: patch.body, visibility: patch.visibility === "internal" ? "internal" : "public" },
      actor,
      now,
    );
  }
  if (patch.status) {
    next = projectTicketAction(next, { type: "status", status: patch.status }, actor, now);
  }
  return next;
}

export function projectCustomerReply(
  ticket: DeskTicket,
  body: string,
  email: string,
  now: Date,
): DeskTicket {
  const nowIso = now.toISOString();
  const wasDone = ticket.status === "resolved" || ticket.status === "closed";
  const events = [...ticket.events];
  if (wasDone) {
    events.push(
      event(
        "reopened",
        email,
        `Customer replied. ${supportOperatorName(ticket.resolvedBy || ticket.closedBy)} had resolved it in ${formatDeskDuration(timeToResolveMs(ticket))}. Reopened and waiting on support.`,
        now,
      ),
    );
  } else {
    events.push(event("replied", email, "Customer replied. Waiting on support.", now));
  }
  return {
    ...ticket,
    status: "open",
    resolvedAt: wasDone ? null : ticket.resolvedAt,
    resolvedBy: wasDone ? null : ticket.resolvedBy,
    closedAt: wasDone ? null : ticket.closedAt,
    closedBy: wasDone ? null : ticket.closedBy,
    updatedAt: nowIso,
    messages: [
      ...ticket.messages,
      {
        id: nextId("msg", now),
        authorEmail: email,
        authorKind: "org",
        body: body.trim(),
        createdAt: nowIso,
      },
    ],
    events,
  };
}

function iso(now: number, offset: number) {
  return new Date(now + offset).toISOString();
}

function seedMessage(
  id: string,
  authorEmail: string,
  authorKind: TicketAuthorKind,
  body: string,
  createdAt: string,
): TicketMessage {
  return { id, authorEmail, authorKind, body, createdAt };
}

function seedEvent(
  id: string,
  kind: TicketEvent["kind"],
  actorEmail: string,
  summary: string,
  createdAt: string,
): TicketEvent {
  return { id, kind, actorEmail, summary, createdAt };
}

/** Sample queue used only when this browser has no hosted database. */
export function seedDeskTickets(now = Date.now()): DeskTicket[] {
  const support = "support-admin@certified.local";
  const platform = "admin@certified.local";
  const loginCreated = -6 * HOUR;
  const loginAssigned = loginCreated + 20 * MINUTE;
  const loginReply = loginCreated + 30 * MINUTE;
  const loginResolved = loginCreated + 2 * HOUR + 40 * MINUTE;
  const exportCreated = -3 * 24 * HOUR;
  const exportAssigned = exportCreated + 5 * MINUTE;
  const exportReply = exportCreated + 20 * MINUTE;
  const exportResolved = exportCreated + 40 * MINUTE;
  const exportClosed = exportCreated + 50 * MINUTE;
  const vatCreated = -30 * HOUR;
  const vatAssigned = vatCreated + 15 * MINUTE;
  const vatReply = vatCreated + 40 * MINUTE;

  return [
    {
      id: "tkt_login",
      orgId: "org_northbridge",
      orgName: "Northbridge Realty Group",
      subject: "Portal login loop after a password reset",
      body: "Vendors reset their password and land back on the sign-in screen. Two of them called this morning.",
      status: "resolved",
      priority: "high",
      requesterEmail: "ava@northbridge.example",
      requesterName: "Ava North",
      assigneeEmail: support,
      assignedAt: iso(now, loginAssigned),
      firstResponseAt: iso(now, loginReply),
      firstResponseBy: support,
      resolvedAt: iso(now, loginResolved),
      resolvedBy: support,
      closedAt: null,
      closedBy: null,
      createdAt: iso(now, loginCreated),
      updatedAt: iso(now, loginResolved),
      messages: [
        seedMessage("msg_login_open", "ava@northbridge.example", "org", "Vendors reset their password and land back on the sign-in screen. Two of them called this morning.", iso(now, loginCreated)),
        seedMessage("msg_login_reply", support, "admin", "The reset link was pointing at the US host. I moved those two vendor accounts onto the UK portal and sent fresh links.", iso(now, loginReply)),
        seedMessage("msg_login_note", support, "internal", "Both accounts had market=us from the old import. Worth checking the rest of Northbridge's vendor list.", iso(now, loginReply + 10 * MINUTE)),
      ],
      events: [
        seedEvent("evt_login_open", "opened", "ava@northbridge.example", "Opened by Ava North.", iso(now, loginCreated)),
        seedEvent("evt_login_assign", "assigned", support, "Assigned to Support Operations.", iso(now, loginAssigned)),
        seedEvent("evt_login_reply", "replied", support, "Replied to the workspace. Waiting on the customer.", iso(now, loginReply)),
        seedEvent("evt_login_resolved", "resolved", support, "Resolved by Support Operations in 2h 20m.", iso(now, loginResolved)),
      ],
    },
    {
      id: "tkt_office",
      orgId: "org_harbour",
      orgName: "Harbour & Co",
      subject: "Second office needs its own pipeline",
      body: "We are opening a branch in Bristol and the Team plan still shows one pipeline. Can the second office have its own stages?",
      status: "open",
      priority: "high",
      requesterEmail: "sam@harbour.example",
      requesterName: "Sam Harbour",
      assigneeEmail: null,
      assignedAt: null,
      firstResponseAt: null,
      firstResponseBy: null,
      resolvedAt: null,
      resolvedBy: null,
      closedAt: null,
      closedBy: null,
      createdAt: iso(now, -7 * HOUR),
      updatedAt: iso(now, -7 * HOUR),
      messages: [
        seedMessage("msg_office_open", "sam@harbour.example", "org", "We are opening a branch in Bristol and the Team plan still shows one pipeline. Can the second office have its own stages?", iso(now, -7 * HOUR)),
      ],
      events: [
        seedEvent("evt_office_open", "opened", "sam@harbour.example", "Opened by Sam Harbour.", iso(now, -7 * HOUR)),
      ],
    },
    {
      id: "tkt_vat",
      orgId: "org_jane",
      orgName: "Jane Smith Realty",
      subject: "VAT number on the April invoice is wrong",
      body: "The April invoice still shows the old VAT number. Accounts cannot file it.",
      status: "pending",
      priority: "normal",
      requesterEmail: "jane@janesmith.example",
      requesterName: "Jane Smith",
      assigneeEmail: platform,
      assignedAt: iso(now, vatAssigned),
      firstResponseAt: iso(now, vatReply),
      firstResponseBy: platform,
      resolvedAt: null,
      resolvedBy: null,
      closedAt: null,
      closedBy: null,
      createdAt: iso(now, vatCreated),
      updatedAt: iso(now, vatReply),
      messages: [
        seedMessage("msg_vat_open", "jane@janesmith.example", "org", "The April invoice still shows the old VAT number. Accounts cannot file it.", iso(now, vatCreated)),
        seedMessage("msg_vat_reply", platform, "admin", "I can reissue April with the new VAT number. Reply with the number on your certificate and I will send a replacement invoice.", iso(now, vatReply)),
      ],
      events: [
        seedEvent("evt_vat_open", "opened", "jane@janesmith.example", "Opened by Jane Smith.", iso(now, vatCreated)),
        seedEvent("evt_vat_assign", "assigned", platform, "Assigned to Platform Super Admin.", iso(now, vatAssigned)),
        seedEvent("evt_vat_reply", "replied", platform, "Replied to the workspace. Waiting on the customer.", iso(now, vatReply)),
      ],
    },
    {
      id: "tkt_export",
      orgId: "org_arslan",
      orgName: "Arslan Group",
      subject: "How do we export the pipeline to CSV?",
      body: "The broker wants last quarter's pipeline in a spreadsheet before the Monday meeting.",
      status: "closed",
      priority: "low",
      requesterEmail: "ops@arslan.example",
      requesterName: "Ops Desk",
      assigneeEmail: support,
      assignedAt: iso(now, exportAssigned),
      firstResponseAt: iso(now, exportReply),
      firstResponseBy: support,
      resolvedAt: iso(now, exportResolved),
      resolvedBy: support,
      closedAt: iso(now, exportClosed),
      closedBy: support,
      createdAt: iso(now, exportCreated),
      updatedAt: iso(now, exportClosed),
      messages: [
        seedMessage("msg_export_open", "ops@arslan.example", "org", "The broker wants last quarter's pipeline in a spreadsheet before the Monday meeting.", iso(now, exportCreated)),
        seedMessage("msg_export_reply", support, "admin", "Open the pipeline, choose Export, and the CSV includes stage, owner, and fee. I attached the column guide in the note below for the office.", iso(now, exportReply)),
      ],
      events: [
        seedEvent("evt_export_open", "opened", "ops@arslan.example", "Opened by Ops Desk.", iso(now, exportCreated)),
        seedEvent("evt_export_assign", "assigned", support, "Assigned to Support Operations.", iso(now, exportAssigned)),
        seedEvent("evt_export_resolved", "resolved", support, "Resolved by Support Operations in 35m.", iso(now, exportResolved)),
        seedEvent("evt_export_closed", "closed", support, "Closed by Support Operations.", iso(now, exportClosed)),
      ],
    },
    {
      id: "tkt_listings",
      orgId: "org_northbridge",
      orgName: "Northbridge Realty Group",
      subject: "An agent cannot see shared listings",
      body: "Noah can open the pipeline but the shared listings board is empty. Other agents in the same office can see it.",
      status: "open",
      priority: "normal",
      requesterEmail: "ava@northbridge.example",
      requesterName: "Ava North",
      assigneeEmail: support,
      assignedAt: iso(now, -90 * MINUTE),
      firstResponseAt: null,
      firstResponseBy: null,
      resolvedAt: null,
      resolvedBy: null,
      closedAt: null,
      closedBy: null,
      createdAt: iso(now, -2 * HOUR),
      updatedAt: iso(now, -90 * MINUTE),
      messages: [
        seedMessage("msg_listings_open", "ava@northbridge.example", "org", "Noah can open the pipeline but the shared listings board is empty. Other agents in the same office can see it.", iso(now, -2 * HOUR)),
      ],
      events: [
        seedEvent("evt_listings_open", "opened", "ava@northbridge.example", "Opened by Ava North.", iso(now, -2 * HOUR)),
        seedEvent("evt_listings_assign", "assigned", support, "Assigned to Support Operations.", iso(now, -90 * MINUTE)),
      ],
    },
  ];
}
