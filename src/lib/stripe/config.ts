import Stripe from "stripe";
import type { Market, PlanId } from "@/types";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export function getStripePriceId(plan: PlanId, market: Market = "uk"): string | null {
  const regional: Record<Market, Record<PlanId, string | undefined>> = {
    uk: {
      solo: process.env.STRIPE_PRICE_SOLO_UK,
      team: process.env.STRIPE_PRICE_TEAM_UK,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE_UK,
    },
    us: {
      solo: process.env.STRIPE_PRICE_SOLO_US,
      team: process.env.STRIPE_PRICE_TEAM_US,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE_US,
    },
  };
  const shared: Record<PlanId, string | undefined> = {
    solo: process.env.STRIPE_PRICE_SOLO,
    team: process.env.STRIPE_PRICE_TEAM,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  };
  return regional[market][plan] || shared[plan] || null;
}

/** Reverse lookup for webhook events, which only carry the Stripe price id. */
export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  const solo = [process.env.STRIPE_PRICE_SOLO, process.env.STRIPE_PRICE_SOLO_UK, process.env.STRIPE_PRICE_SOLO_US];
  const team = [process.env.STRIPE_PRICE_TEAM, process.env.STRIPE_PRICE_TEAM_UK, process.env.STRIPE_PRICE_TEAM_US];
  const enterprise = [
    process.env.STRIPE_PRICE_ENTERPRISE,
    process.env.STRIPE_PRICE_ENTERPRISE_UK,
    process.env.STRIPE_PRICE_ENTERPRISE_US,
  ];
  if (solo.includes(priceId)) return "solo";
  if (team.includes(priceId)) return "team";
  if (enterprise.includes(priceId)) return "enterprise";
  return null;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
