import {
  projectCustomerReply,
  projectTicketAction,
  type DeskTicket,
  type TicketMessage,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/admin/ticket-desk";

export const SUPPORT_PRIORITIES: {
  id: TicketPriority;
  label: string;
  detail: string;
}[] = [
  { id: "low", label: "Low", detail: "It can wait. First reply within 2 days." },
  { id: "normal", label: "Normal", detail: "Something is in the way. First reply within a day." },
  { id: "high", label: "High", detail: "The office is stuck. First reply within 4 hours." },
];

export type SupportMessage = {
  id: string;
  authorEmail: string;
  authorKind: TicketMessage["authorKind"];
  body: string;
  createdAt: string;
};

export function ticketsForOrg(
  tickets: DeskTicket[],
  org: { id: string; name: string },
) {
  const rank: Record<TicketStatus, number> = { open: 0, pending: 1, resolved: 2, closed: 3 };
  return tickets
    .filter((ticket) => ticket.orgId === org.id || (org.name && ticket.orgName === org.name))
    .sort(
      (a, b) =>
        rank[a.status] - rank[b.status] || b.updatedAt.localeCompare(a.updatedAt),
    );
}

export function publicMessages(ticket: DeskTicket): SupportMessage[] {
  return ticket.messages
    .filter((message) => message.authorKind !== "internal")
    .map((message) => ({
      id: message.id,
      authorEmail: message.authorEmail,
      authorKind: message.authorKind,
      body: message.body,
      createdAt: message.createdAt,
    }));
}

export function buildWorkspaceTicket(input: {
  orgId: string;
  orgName: string;
  email: string;
  name: string;
  subject: string;
  body: string;
  priority: TicketPriority;
  now?: Date;
}): DeskTicket {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const id = `tkt_${now.getTime().toString(36)}`;
  const subject = input.subject.trim();
  const body = input.body.trim();
  return {
    id,
    orgId: input.orgId,
    orgName: input.orgName,
    subject,
    body,
    status: "open",
    priority: input.priority,
    requesterEmail: input.email,
    requesterName: input.name,
    assigneeEmail: null,
    assignedAt: null,
    firstResponseAt: null,
    firstResponseBy: null,
    resolvedAt: null,
    resolvedBy: null,
    closedAt: null,
    closedBy: null,
    createdAt: iso,
    updatedAt: iso,
    messages: [
      {
        id: `msg_${id}`,
        authorEmail: input.email,
        authorKind: "org",
        body,
        createdAt: iso,
      },
    ],
    events: [
      {
        id: `evt_${id}`,
        kind: "opened",
        actorEmail: input.email,
        summary: `Opened by ${input.name}. Priority ${input.priority}.`,
        createdAt: iso,
      },
    ],
  };
}

export function withCustomerReply(ticket: DeskTicket, body: string, email: string, now = new Date()) {
  return projectCustomerReply(ticket, body, email, now);
}

export function withCustomerPriority(
  ticket: DeskTicket,
  priority: TicketPriority,
  email: string,
  now = new Date(),
) {
  if (ticket.status === "closed") return ticket;
  return projectTicketAction(ticket, { type: "priority", priority }, { email }, now);
}
