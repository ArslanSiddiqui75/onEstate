import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantRecord } from "@/lib/admin/types";
import { getPlatformMetrics } from "@/lib/admin/registry";
import {
  getStripePriceId,
  isStripeConfigured,
  stripeRegionConnections,
} from "@/lib/stripe/config";

function tenant(market: "uk" | "us", mrr: number, lifecycle: TenantRecord["lifecycleStatus"]): TenantRecord {
  return {
    market,
    lifecycleStatus: lifecycle,
    healthScore: market === "uk" ? 80 : 40,
    subscription: { mrr, seatsUsed: market === "uk" ? 3 : 1 },
  } as TenantRecord;
}

describe("regional books and Stripe accounts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps UK pounds and US dollars in separate totals", () => {
    const metrics = getPlatformMetrics({
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      audit: [],
      tenants: [
        tenant("uk", 199, "active"),
        tenant("uk", 49, "trialing"),
        tenant("us", 249, "past_due"),
      ],
    });

    expect(metrics.byMarket.uk).toMatchObject({
      tenantCount: 2,
      activeCount: 1,
      trialingCount: 1,
      pastDueCount: 0,
      mrr: 248,
      arr: 248 * 12,
      seats: 6,
    });
    expect(metrics.byMarket.us).toMatchObject({
      tenantCount: 1,
      activeCount: 0,
      pastDueCount: 1,
      mrr: 249,
      arr: 249 * 12,
      seats: 1,
      avgHealth: 40,
    });
    expect(metrics.mrr).toBe(248);
    expect(metrics.tenantCount).toBe(3);
  });

  it("does not treat a shared secret key as either region's Stripe account", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_shared");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_shared");
    expect(isStripeConfigured("uk")).toBe(false);
    expect(isStripeConfigured("us")).toBe(false);
  });

  it("connects each Stripe account from its own key and price ids", () => {
    vi.stubEnv("STRIPE_SECRET_KEY_UK", "sk_test_uk");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET_UK", "whsec_uk");
    vi.stubEnv("STRIPE_PRICE_SOLO_UK", "price_uk_solo");
    vi.stubEnv("STRIPE_PRICE_TEAM_UK", "price_uk_team");
    vi.stubEnv("STRIPE_PRICE_SOLO", "price_shared_solo");
    vi.stubEnv("STRIPE_SECRET_KEY_US", "");
    vi.stubEnv("STRIPE_PRICE_SOLO_US", "");

    const rows = stripeRegionConnections();
    expect(rows.find((row) => row.market === "uk")).toMatchObject({
      accountConfigured: true,
      webhookConfigured: true,
      prices: { solo: true, team: true, enterprise: false },
    });
    expect(rows.find((row) => row.market === "us")?.accountConfigured).toBe(false);
    expect(getStripePriceId("solo", "uk")).toBe("price_uk_solo");
    expect(getStripePriceId("solo", "us")).toBeNull();
  });
});
