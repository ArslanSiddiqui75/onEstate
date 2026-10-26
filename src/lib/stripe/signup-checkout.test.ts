import { describe, expect, it } from "vitest";
import { parsePendingSignup } from "@/lib/auth/pending-signup";
import {
  signupCheckoutActionLabel,
  signupCheckoutDecision,
  signupCheckoutMetadata,
  signupCheckoutNote,
} from "@/lib/stripe/signup-checkout";

const pending = {
  name: "Jane Smith",
  email: "jane@brokerage.com",
  password: "secret1",
  orgName: "Northbridge Realty",
  plan: "team" as const,
};

describe("pending signup", () => {
  it("accepts a validated signup and rejects a payload without a password", () => {
    expect(parsePendingSignup(pending)?.email).toBe("jane@brokerage.com");
    const { password: _password, ...withoutPassword } = pending;
    expect(parsePendingSignup(withoutPassword)).toBeNull();
    expect(parsePendingSignup({ ...pending, plan: "nope" })).toBeNull();
  });
});

describe("signup checkout decision", () => {
  it("keeps enterprise on the sales path", () => {
    expect(
      signupCheckoutDecision({
        plan: "enterprise",
        stripeConfigured: true,
        priceId: "price_enterprise",
      }),
    ).toEqual({ mode: "sales" });
  });

  it("previews when the regional Stripe account or price is missing", () => {
    expect(
      signupCheckoutDecision({ plan: "team", stripeConfigured: false, priceId: null }),
    ).toEqual({ mode: "preview", reason: "account" });
    expect(
      signupCheckoutDecision({ plan: "solo", stripeConfigured: true, priceId: null }),
    ).toEqual({ mode: "preview", reason: "price" });
  });

  it("goes live only with a price id", () => {
    expect(
      signupCheckoutDecision({
        plan: "team",
        stripeConfigured: true,
        priceId: "price_uk_team",
      }),
    ).toEqual({ mode: "live", priceId: "price_uk_team" });
  });

  it("keeps the password out of Stripe metadata", () => {
    const metadata = signupCheckoutMetadata({
      plan: "team",
      market: "uk",
      email: pending.email,
      orgName: pending.orgName,
    });
    expect(metadata).toEqual({
      plan: "team",
      market: "uk",
      email: pending.email,
      org_name: pending.orgName,
      source: "signup",
    });
    expect(Object.keys(metadata)).not.toContain("password");
  });

  it("describes a preview without asking for a card payment", () => {
    const note = signupCheckoutNote({
      mode: "preview",
      reason: "account",
      region: "UK",
      planName: "Team / Brokerage",
      priceLabel: "£199/mo",
    });
    expect(note).toContain("isn't connected");
    expect(note).toContain("no card is charged");
    expect(note.toLowerCase()).not.toContain("pay £");
    expect(signupCheckoutActionLabel("preview")).toBe("Open workspace");
    expect(signupCheckoutActionLabel("live")).toBe("Continue to Stripe");
  });
});
