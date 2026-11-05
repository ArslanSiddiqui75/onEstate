import { describe, expect, it } from "vitest";
import {
  decodeBase32,
  encodeBase32,
  generateTotp,
  verifyTotp,
} from "@/lib/admin/totp";

describe("admin totp", () => {
  it("round-trips base32", () => {
    const raw = Buffer.from("HelloWorld!!");
    expect(decodeBase32(encodeBase32(raw)).equals(raw)).toBe(true);
  });

  it("verifies a known secret within the window", () => {
    // "JBSWY3DPEHPK3PXP" is a common test secret ("Hello!").
    const secret = "JBSWY3DPEHPK3PXP";
    const now = Date.UTC(2020, 0, 1, 0, 0, 0);
    const code = generateTotp(secret, now);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code, now)).toBe(true);
    expect(verifyTotp(secret, "000000", now)).toBe(false);
  });
});
