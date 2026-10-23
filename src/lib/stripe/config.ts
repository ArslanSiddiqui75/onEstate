import Stripe from "stripe";
import type { Market, PlanId } from "@/types";

const clients = new Map<string, Stripe>();

function envValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

/** UK and US are separate Stripe accounts. The old shared secret is not used. */
export function stripeSecretEnv(market: Market) {
  return market === "uk" ? "STRIPE_SECRET_KEY_UK" : "STRIPE_SECRET_KEY_US";
}

export function stripeWebhookEnv(market: Market) {
  return market === "uk" ? "STRIPE_WEBHOOK_SECRET_UK" : "STRIPE_WEBHOOK_SECRET_US";
}

export function stripeSecretKey(market: Market): string | null {
  return envValue(stripeSecretEnv(market));
}

export function stripeWebhookSecret(market: Market): string | null {
  return envValue(stripeWebhookEnv(market));
}

export function getStripe(market: Market): Stripe | null {
  const key = stripeSecretKey(market);
  if (!key) return null;
  const cached = clients.get(key);
  if (cached) return cached;
  const client = new Stripe(key);
  clients.set(key, client);
  return client;
}

function regionalPriceEnv(plan: PlanId, market: Market) {
  const names: Record<Market, Record<PlanId, string>> = {
    uk: {
      solo: "STRIPE_PRICE_SOLO_UK",
      team: "STRIPE_PRICE_TEAM_UK",
      enterprise: "STRIPE_PRICE_ENTERPRISE_UK",
    },
    us: {
      solo: "STRIPE_PRICE_SOLO_US",
      team: "STRIPE_PRICE_TEAM_US",
      enterprise: "STRIPE_PRICE_ENTERPRISE_US",
    },
  };
  return envValue(names[market][plan]);
}

/** Price ids are account-scoped, so a UK checkout never falls back to a shared or US price. */
export function getStripePriceId(plan: PlanId, market: Market = "uk"): string | null {
  return regionalPriceEnv(plan, market);
}

export interface StripeRegionConnection {
  market: Market;
  label: "UK" | "US";
  secretEnv: string;
  webhookEnv: string;
  accountConfigured: boolean;
  webhookConfigured: boolean;
  prices: { solo: boolean; team: boolean; enterprise: boolean };
}

export function stripeRegionConnections(): StripeRegionConnection[] {
  return (["uk", "us"] as const).map((market) => ({
    market,
    label: market === "uk" ? "UK" : "US",
    secretEnv: stripeSecretEnv(market),
    webhookEnv: stripeWebhookEnv(market),
    accountConfigured: Boolean(stripeSecretKey(market)),
    webhookConfigured: Boolean(stripeWebhookSecret(market)),
    prices: {
      solo: Boolean(getStripePriceId("solo", market)),
      team: Boolean(getStripePriceId("team", market)),
      enterprise: Boolean(getStripePriceId("enterprise", market)),
    },
  }));
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

export function isStripeConfigured(market: Market) {
  return Boolean(stripeSecretKey(market));
}
