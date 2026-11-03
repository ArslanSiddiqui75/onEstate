import { describe, expect, it } from "vitest";
import { contactIsDnd, leadIsDndForUser } from "@/lib/crm/dnd";
import type { Contact, Lead } from "@/types";

const contact = {
  id: "c1",
  name: "Ada",
  email: "ada@example.com",
  phone: "+447700900111",
  category: "lead",
  tags: [],
  leadId: "l1",
  market: "uk",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies Contact;

const lead = {
  id: "l1",
  name: "Ada",
  email: "ada@example.com",
  phone: "+447700900111",
  type: "buyer",
  stage: "new",
  score: 0,
  assignedTo: "u1",
  market: "uk",
  source: "Manual",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} satisfies Lead;

describe("personal contact DND", () => {
  it("is scoped to listed contact ids", () => {
    expect(contactIsDnd("c1", ["c1"])).toBe(true);
    expect(contactIsDnd("c2", ["c1"])).toBe(false);
  });

  it("blocks a lead when the linked contact is on the user's DND list", () => {
    expect(leadIsDndForUser(lead, [contact], ["c1"])?.id).toBe("c1");
    expect(leadIsDndForUser(lead, [contact], ["other"])).toBeNull();
  });
});
