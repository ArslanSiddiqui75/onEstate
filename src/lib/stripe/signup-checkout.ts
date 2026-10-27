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
    return `${input.planName} is scoped with sales at a custom price. No card is taken here, and the workspace is not created.`;
  }
  if (input.mode === "live") {
    return `You’ll enter your card next. The ${input.planName} workspace is created only after payment.`;
  }
  if (input.reason === "price") {
    return `${input.planName} is ${input.priceLabel}. Payment isn’t available for this plan yet, so the workspace is not created.`;
  }
  return `${input.planName} is ${input.priceLabel}. Payment isn’t available yet, so the workspace is not created.`;
}

export function signupCheckoutActionLabel(mode: "sales" | "preview" | "live") {
  return mode === "live" ? "Continue to payment" : "Payment required";
}

/**
 * A signup workspace may open only after Stripe has a paid subscription
 * for this checkout. A session that is merely open, or missing a customer,
 * does not count.
 */
export function signupStripeCreated(input: {
  metadataMatches: boolean;
  status: string | null;
  paymentStatus: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (!input.metadataMatches) {
    return { ok: false, error: "Checkout session doesn't match this plan." };
  }
  if (input.status !== "complete") {
    return { ok: false, error: "Payment isn't complete yet." };
  }
  if (!input.customerId || !input.subscriptionId) {
    return { ok: false, error: "Stripe hasn't created the subscription yet." };
  }
  const active = input.subscriptionStatus === "active" || input.subscriptionStatus === "trialing";
  if (input.paymentStatus !== "paid" || !active) {
    return { ok: false, error: "Stripe hasn't collected payment for this subscription." };
  }
  return { ok: true };
}
