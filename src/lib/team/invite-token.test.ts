import { describe, expect, it } from "vitest";
import { newInviteToken, TERMS_VERSION } from "@/lib/team/invite-token";

describe("invite token", () => {
  it("creates a high-entropy hex token", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a).toMatch(/^[a-f0-9]{48}$/);
    expect(b).toMatch(/^[a-f0-9]{48}$/);
    expect(a).not.toBe(b);
  });

  it("pins a terms version for audit", () => {
    expect(TERMS_VERSION.length).toBeGreaterThan(4);
  });
});
