import { describe, expect, it } from "vitest";
import { isE164, toE164 } from "@/lib/phone/e164";

describe("toE164", () => {
  it("drops the bracketed trunk zero after a country code", () => {
    expect(toE164("+44 (0)7911 123456", "+44")).toBe("+447911123456");
    expect(toE164("+4407911123456", "+44")).toBe("+447911123456");
  });

  it("treats a leading 0 as a local prefix", () => {
    expect(toE164("07911 123456", "+44")).toBe("+447911123456");
  });

  it("does not double the US country code", () => {
    expect(toE164("1 (555) 019-9000", "+1")).toBe("+15550199000");
  });

  it("rejects letters", () => {
    expect(isE164(toE164("abc", "+44"))).toBe(false);
  });
});
