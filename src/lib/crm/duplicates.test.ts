import { describe, expect, it } from "vitest";
import { findDuplicateLead } from "@/lib/crm/duplicates";

const leads = [
  { id: "a", name: "Ava", email: "Ava@Example.com", phone: "+44 7700 900123" },
  { id: "b", name: "Ben", email: "", phone: "" },
];

describe("findDuplicateLead", () => {
  it("matches an email regardless of case", () => {
    expect(findDuplicateLead(leads, { email: "ava@example.com" })?.id).toBe("a");
  });

  it("matches the same phone written differently", () => {
    expect(findDuplicateLead(leads, { phone: "+447700900123" })?.id).toBe("a");
  });

  it("does not match short or empty values", () => {
    expect(findDuplicateLead(leads, { email: "", phone: "123" })).toBeUndefined();
    expect(findDuplicateLead(leads, {})).toBeUndefined();
  });
});
