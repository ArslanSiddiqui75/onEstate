import { describe, expect, it } from "vitest";
import {
  isSubscriptionSoftLocked,
  workspaceBlocked,
} from "@/lib/server/require-module";

describe("workspace soft-lock", () => {
  it("locks paused canceled unpaid incomplete_expired", () => {
    for (const status of ["paused", "canceled", "unpaid", "incomplete_expired"]) {
      expect(isSubscriptionSoftLocked(status)).toBe(true);
      expect(workspaceBlocked({ subscriptionStatus: status })).toBe(true);
    }
  });

  it("keeps past_due and active usable (grace)", () => {
    expect(isSubscriptionSoftLocked("past_due")).toBe(false);
    expect(isSubscriptionSoftLocked("active")).toBe(false);
    expect(isSubscriptionSoftLocked(undefined)).toBe(false);
    expect(workspaceBlocked({ subscriptionStatus: "past_due" })).toBe(false);
  });
});
