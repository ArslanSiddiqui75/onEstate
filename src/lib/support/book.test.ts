import { describe, expect, it } from "vitest";
import { seedDeskTickets } from "@/lib/admin/ticket-desk";
import {
  buildWorkspaceTicket,
  publicMessages,
  ticketsForOrg,
  withCustomerPriority,
} from "@/lib/support/book";

describe("workspace support book", () => {
  it("keeps this office's tickets, including the sample book that shares the office name", () => {
    const mine = ticketsForOrg(seedDeskTickets(Date.parse("2026-10-27T12:00:00.000Z")), {
      id: "org_dev_northbridge",
      name: "Northbridge Realty Group",
    });
    expect(mine.map((ticket) => ticket.subject)).toEqual([
      "An agent cannot see shared listings",
      "Portal login loop after a password reset",
    ]);
    expect(publicMessages(mine[0]).every((message) => message.authorKind !== "internal")).toBe(true);
  });

  it("files a ticket at the priority the office chose", () => {
    const ticket = buildWorkspaceTicket({
      orgId: "org_dev_northbridge",
      orgName: "Northbridge Realty Group",
      email: "owner@certified.local",
      name: "Ava North",
      subject: "Portal feed is blank",
      body: "Rightmove has not taken the new instruction.",
      priority: "high",
      now: new Date("2026-10-27T12:00:00.000Z"),
    });
    expect(ticket.priority).toBe("high");
    expect(ticket.status).toBe("open");
    expect(ticket.messages).toHaveLength(1);
    expect(ticket.events[0].summary).toContain("high");
    const raised = withCustomerPriority(ticket, "low", "owner@certified.local", new Date("2026-10-27T13:00:00.000Z"));
    expect(raised.priority).toBe("low");
    expect(raised.events.at(-1)?.summary).toContain("Low");
  });
});
