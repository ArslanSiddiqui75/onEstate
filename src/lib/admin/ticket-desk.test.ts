import { describe, expect, it } from "vitest";
import {
  applyTicketPatch,
  deskSummary,
  firstResponseMs,
  formatDeskDuration,
  handleClock,
  projectCustomerReply,
  projectTicketAction,
  seedDeskTickets,
  slaMarks,
  supportOperatorName,
  timeToResolveMs,
  withTicketFacts,
  type DeskTicket,
} from "@/lib/admin/ticket-desk";

const NOW = Date.parse("2026-10-24T12:00:00.000Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function blank(patch: Partial<DeskTicket>): DeskTicket {
  return {
    id: "tkt_test",
    orgId: "org",
    orgName: "Harbour & Co",
    subject: "Test",
    body: "Need a hand",
    status: "open",
    priority: "normal",
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
    createdAt: new Date(NOW - 3 * HOUR).toISOString(),
    updatedAt: new Date(NOW - 3 * HOUR).toISOString(),
    messages: [],
    events: [],
    ...patch,
  };
}

describe("support desk timing", () => {
  it("names the operator who resolved a ticket and how long they took", () => {
    const tickets = seedDeskTickets(NOW);
    const login = tickets.find((ticket) => ticket.id === "tkt_login");
    expect(login).toBeTruthy();
    expect(supportOperatorName(login?.resolvedBy)).toBe("Support Operations");
    expect(formatDeskDuration(firstResponseMs(login!))).toBe("30m");
    expect(formatDeskDuration(timeToResolveMs(login!))).toBe("2h 40m");
    expect(formatDeskDuration(handleClock(login!, NOW)?.ms)).toBe("2h 20m");
    expect(handleClock(login!, NOW)?.complete).toBe(true);
    expect(slaMarks(login!, NOW).firstResponse).toBe("met");

    const exported = tickets.find((ticket) => ticket.id === "tkt_export");
    expect(formatDeskDuration(handleClock(exported!, NOW)?.ms)).toBe("35m");
    expect(supportOperatorName(exported?.closedBy)).toBe("Support Operations");
  });

  it("summarises the queue and flags a breached first response", () => {
    const tickets = seedDeskTickets(NOW);
    const office = tickets.find((ticket) => ticket.id === "tkt_office")!;
    expect(office.assigneeEmail).toBeNull();
    expect(slaMarks(office, NOW).firstResponse).toBe("breached");

    const summary = deskSummary(tickets, NOW);
    expect(summary.active).toBe(3);
    expect(summary.waitingOnSupport).toBe(2);
    expect(summary.waitingOnCustomer).toBe(1);
    expect(summary.unassigned).toBe(1);
    expect(summary.breached).toBe(1);
    expect(summary.resolved).toBe(2);
    expect(formatDeskDuration(summary.avgFirstResponseMs)).toBe("30m");
    expect(formatDeskDuration(summary.avgTimeToResolveMs)).toBe("1h 40m");
  });

  it("derives the first response from a public reply when the column is empty", () => {
    const replyAt = new Date(NOW - 2 * HOUR).toISOString();
    const ticket = withTicketFacts(
      blank({
        createdAt: new Date(NOW - 5 * HOUR).toISOString(),
        messages: [
          {
            id: "m1",
            authorEmail: "support-admin@certified.local",
            authorKind: "admin",
            body: "Looking now",
            createdAt: replyAt,
          },
        ],
      }),
    );
    expect(ticket.firstResponseAt).toBe(replyAt);
    expect(ticket.firstResponseBy).toBe("support-admin@certified.local");
    expect(formatDeskDuration(firstResponseMs(ticket))).toBe("3h");
  });

  it("starts handle time at the resolver's reply when someone else was assigned", () => {
    const replyAt = new Date(NOW - 90 * MINUTE).toISOString();
    const resolvedAt = new Date(NOW - 30 * MINUTE).toISOString();
    const ticket = blank({
      assigneeEmail: "admin@certified.local",
      assignedAt: new Date(NOW - 4 * HOUR).toISOString(),
      firstResponseAt: replyAt,
      firstResponseBy: "support-admin@certified.local",
      resolvedAt,
      resolvedBy: "support-admin@certified.local",
      status: "resolved",
      messages: [
        {
          id: "m1",
          authorEmail: "support-admin@certified.local",
          authorKind: "admin",
          body: "I took this over",
          createdAt: replyAt,
        },
      ],
    });
    expect(formatDeskDuration(handleClock(ticket, NOW)?.ms)).toBe("1h");
  });
});

describe("support desk actions", () => {
  const actor = { email: "support-admin@certified.local" };
  const now = new Date(NOW);

  it("records a public reply as the first response and waits on the customer", () => {
    const next = projectTicketAction(blank({}), { type: "reply", body: "On it", visibility: "public" }, actor, now);
    expect(next.status).toBe("pending");
    expect(next.firstResponseBy).toBe(actor.email);
    expect(next.messages.at(-1)?.authorKind).toBe("admin");
  });

  it("keeps an internal note off the clock and off the status", () => {
    const next = projectTicketAction(
      blank({}),
      { type: "reply", body: "Check the import", visibility: "internal" },
      actor,
      now,
    );
    expect(next.status).toBe("open");
    expect(next.firstResponseAt).toBeNull();
    expect(next.messages.at(-1)?.authorKind).toBe("internal");
  });

  it("resolves in one step after a reply and names the operator", () => {
    const assigned = blank({
      assigneeEmail: actor.email,
      assignedAt: new Date(NOW - 2 * HOUR).toISOString(),
    });
    const next = applyTicketPatch(
      assigned,
      { body: "Fixed the link", visibility: "public", status: "resolved" },
      actor,
      now,
    );
    expect(next.status).toBe("resolved");
    expect(next.resolvedBy).toBe(actor.email);
    expect(supportOperatorName(next.resolvedBy)).toBe("Support Operations");
    expect(formatDeskDuration(handleClock(next, NOW)?.ms)).toBe("2h");
    expect(next.events.some((item) => item.summary.includes("Support Operations"))).toBe(true);
  });

  it("keeps the first resolution in the timeline after a reopen", () => {
    const resolved = projectTicketAction(
      blank({
        assigneeEmail: actor.email,
        assignedAt: new Date(NOW - 2 * HOUR).toISOString(),
      }),
      { type: "status", status: "resolved" },
      actor,
      now,
    );
    const reopened = projectTicketAction(
      resolved,
      { type: "status", status: "open" },
      { email: "admin@certified.local" },
      new Date(NOW + 10 * MINUTE),
    );
    expect(reopened.resolvedBy).toBeNull();
    expect(reopened.resolvedAt).toBeNull();
    expect(reopened.events.some((item) => item.summary.includes("Support Operations"))).toBe(true);
  });

  it("reopens a resolved ticket when the customer replies", () => {
    const resolved = projectTicketAction(
      blank({ assigneeEmail: actor.email, assignedAt: new Date(NOW - HOUR).toISOString() }),
      { type: "status", status: "resolved" },
      actor,
      now,
    );
    const reopened = projectCustomerReply(resolved, "It is still looping", "ava@northbridge.example", new Date(NOW + MINUTE));
    expect(reopened.status).toBe("open");
    expect(reopened.resolvedBy).toBeNull();
    expect(reopened.messages.at(-1)?.authorKind).toBe("org");
  });
});
