import { describe, expect, it } from "vitest";
import {
  contactImportTemplateCsv,
  contactsToCsv,
  mergeTags,
  parseContactImportCsv,
  removeTags,
} from "@/lib/crm/contact-bulk";
import type { Contact } from "@/types";

const existing: Contact[] = [
  {
    id: "c1",
    name: "Existing",
    email: "existing@example.com",
    phone: "+447700900000",
    category: "client",
    tags: ["vip"],
    market: "uk",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("contact bulk import", () => {
  it("parses a headed CSV and skips duplicates / bad rows", () => {
    const csv = `name,email,phone,company,category,tags,notes
Ada Lovelace,ada@example.com,+447700900111,Analytical Engines,lead,"buyer, hot",Met at viewing
Existing,existing@example.com,+447700900000,,,
No Contact,,,,
Bad Phone,bad@example.com,03331234567,,,`;
    const result = parseContactImportCsv(csv, existing);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      category: "lead",
      tags: ["buyer", "hot"],
    });
    expect(result.skipped.some((line) => line.includes("already a contact"))).toBe(true);
    expect(result.skipped.some((line) => line.includes("no email or phone"))).toBe(true);
    expect(result.skipped.some((line) => line.includes("country code"))).toBe(true);
  });

  it("builds a template and exports contacts", () => {
    expect(contactImportTemplateCsv()).toContain("name,email,phone");
    expect(contactsToCsv(existing)).toContain("existing@example.com");
  });

  it("merges and removes tags case-insensitively", () => {
    expect(mergeTags(["vip"], ["Hot", "vip"])).toEqual(["vip", "Hot"]);
    expect(removeTags(["VIP", "buyer"], ["vip"])).toEqual(["buyer"]);
  });
});
