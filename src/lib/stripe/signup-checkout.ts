import type { Market, PlanId } from "@/types";

export type SignupCheckoutPreviewReason = "account" | "price";

export type SignupCheckoutDecision =
  | { mode: "sales" }
  | { mode: "preview"; reason: SignupCheckoutPreviewReason }
  | { mode: "live"; priceId: string };

/**
 * Signup checkout never charges a card unless this market has a Stripe account
 * and a price for the plan. Enterprise stays sales-assisted either way.
 */
export function signupCheckoutDecision(input: {
  plan: PlanId;
  stripeConfigured: boolean;
  priceId: string | null;
}): SignupCheckoutDecision {
  if (input.plan === "enterprise") return { mode: "sales" };
  if (!input.stripeConfigured) return { mode: "preview", reason: "account" };
  if (!input.priceId) return { mode: "preview", reason: "price" };
  return { mode: "live", priceId: input.priceId };
}

/** Sent to Stripe. The password is intentionally absent. */
export function signupCheckoutMetadata(input: {
  plan: PlanId;
  market: Market;
  email: string;
  orgName: string;
}) {
  return {
    plan: input.plan,
    market: input.market,
    email: input.email,
    org_name: input.orgName,
    source: "signup",
  };
}

export function signupCheckoutNote(input: {
  mode: "sales" | "preview" | "live";
  reason?: SignupCheckoutPreviewReason;
  region: "UK" | "US";
  planName: string;
  priceLabel: string;
}) {
  if (input.mode === "sales") {
    return `${input.planName} is scoped with sales at a custom price. No card is charged. Continue opens the workspace on this plan.`;
  }
  if (input.mode === "live") {
    return `Card details are collected on Stripe for the ${input.region} account. The workspace is created after payment succeeds, in this browser.`;
  }
  if (input.reason === "price") {
    return `${input.planName} is ${input.priceLabel}. A Stripe price isn't connected for this plan yet, so no card is charged. Continue opens the workspace on this plan.`;
  }
  return `${input.planName} is ${input.priceLabel}. The ${input.region} Stripe account isn't connected yet, so no card is charged. Continue opens the workspace on this plan. Card checkout will replace this step once that account is connected.`;
}

export function signupCheckoutActionLabel(mode: "sales" | "preview" | "live") {
  return mode === "live" ? "Continue to Stripe" : "Open workspace";
}
