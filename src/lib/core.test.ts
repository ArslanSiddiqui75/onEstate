import { describe, expect, it } from "vitest";
import { defaultDialCode, isE164, toE164 } from "@/lib/phone/e164";
import { phoneLookupVariants } from "@/lib/messaging/service";
import { getPasswordStrength, signupSchema, validateForm } from "@/lib/auth/validation";
import {
  isPortalConnected,
  mergeConnectionsWithDefaults,
} from "@/lib/portals/connections";
import { scoreLead } from "@/lib/crm/scoring";
import { planAmount, seatLimit } from "@/lib/admin/registry";

describe("E.164 phones", () => {
  it("rejects local numbers without a country code", () => {
    expect(isE164("03331234567")).toBe(false);
    expect(isE164("447700900123")).toBe(false);
  });

  it("accepts international numbers", () => {
    expect(isE164("++447700900123")).toBe(false);
    expect(isE164("+447700900123")).toBe(true);
    expect(isE164("+923331234567")).toBe(true);
  });

  it("composes E.164 from a local trunk prefix", () => {
    expect(toE164("0333 1234567", "+92")).toBe("+923331234567");
    expect(defaultDialCode("uk")).toBe("+44");
    expect(defaultDialCode("us")).toBe("+1");
  });

  it("builds lookup variants for matching inbound SMS", () => {
    const variants = phoneLookupVariants("+44 7700 900123");
    expect(variants).toEqual(expect.arrayContaining(["+447700900123", "447700900123"]));
  });
});

describe("auth validation", () => {
  it("requires a valid signup payload", () => {
    const bad = validateForm(signupSchema, {
      name: "A",
      email: "not-an-email",
      password: "123",
      orgName: "X",
      plan: "hobby",
    });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.errors.email).toBeTruthy();
      expect(bad.errors.password).toBeTruthy();
      expect(bad.errors.plan).toBeTruthy();
    }
  });

  it("accepts a complete signup", () => {
    const ok = validateForm(signupSchema, {
      name: "Ava North",
      email: "ava@brokerage.com",
      password: "longenough",
      orgName: "Northbridge",
      plan: "team",
    });
    expect(ok.success).toBe(true);
  });

  it("scores password strength", () => {
    expect(getPasswordStrength("").score).toBe(0);
    expect(getPasswordStrength("password").label).toBe("Weak");
    expect(getPasswordStrength("Password1!").score).toBe(4);
    expect(getPasswordStrength("Password1!").label).toBe("Strong");
  });
});

describe("portal connections", () => {
  it("fills UK defaults and keeps saved Rightmove credentials", () => {
    const merged = mergeConnectionsWithDefaults("uk", [
      { portal: "rightmove", connected: true, branchId: "123" },
    ]);
    expect(merged.map((c) => c.portal)).toEqual([
      "rightmove",
      "zoopla",
      "onthemarket",
    ]);
    expect(isPortalConnected(merged, "rightmove")).toBe(true);
    expect(isPortalConnected(merged, "zoopla")).toBe(false);
  });
});

describe("lead scoring", () => {
  it("adds points for completeness, referral source, and urgency", () => {
    const result = scoreLead({
      email: "lead@example.com",
      phone: "+447700900123",
      source: "referral",
      type: "seller",
      priority: "urgent",
      budget: 500000,
      notes: "Ready to list",
    });
    expect(result.score).toBeGreaterThan(70);
    expect(result.factors.some((f) => f.label === "Source · referral")).toBe(true);
  });
});

describe("plan catalog helpers", () => {
  it("returns GBP/USD monthly amounts and seat ceilings", () => {
    expect(planAmount("enterprise", "uk")).toBe(0);
    expect(planAmount("solo", "uk")).toBeGreaterThan(0);
    expect(planAmount("team", "us")).toBeGreaterThan(planAmount("solo", "us"));
    expect(seatLimit("solo")).toBe(1);
    expect(seatLimit("team")).toBe(25);
  });
});
