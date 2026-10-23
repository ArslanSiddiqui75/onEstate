import { describe, expect, it } from "vitest";
import { projectSubscriptionAction, subscriptionActions } from "@/lib/admin/subscription-actions";
import type { TenantRecord } from "@/lib/admin/types";

const now = new Date("2026-10-24T00:00:00.000Z");

function account(patch: Partial<TenantRecord["subscription"]> & { market?: "uk" | "us"; name?: string }): TenantRecord {
  const market = patch.market || "uk";
  return {
    name: patch.name || "Harbour & Co",
    market,
    lifecycleStatus: "active",
    subscription: {
      id: "sub_1",
      plan: "team",
      status: "active",
      interval: "month",
      currency: market === "uk" ? "GBP" : "USD",
      unitAmount: market === "uk" ? 199 : 249,
      mrr: market === "uk" ? 199 : 249,
      seatsIncluded: 25,
      seatsUsed: 4,
      cancelAtPeriodEnd: false,
      collectionMethod: "charge_automatically",
      lastPaymentStatus: "paid",
      currentPeriodEnd: "2026-11-24T00:00:00.000Z",
      ...patch,
    },
  } as TenantRecord;
}

describe("subscription management actions", () => {
  it("offers pause, both cancels, invoicing, and the other plans on a live account", () => {
    const labels = subscriptionActions(account({})).map((option) => option.label);
    expect(labels).toEqual([
      "Pause",
      "Send invoice",
      "Solo Agent",
      "Enterprise / Multi-office",
      "Cancel at period end",
      "Cancel now",
    ]);
  });

  it("pauses collection and continues a trial back to trialing", () => {
    const trialing = account({
      status: "trialing",
      mrr: 0,
      trialEndsAt: "2026-11-01T00:00:00.000Z",
      lastPaymentStatus: "none",
    });
    const paused = projectSubscriptionAction(trialing, "pause", { now });
    expect(paused.subscription.status).toBe("paused");
    expect(paused.subscription.mrr).toBe(0);
    expect(paused.lifecycleStatus).toBe("suspended");

    const continued = projectSubscriptionAction(
      account({
        ...trialing.subscription,
        status: "paused",
        mrr: 0,
      }),
      "continue",
      { now },
    );
    expect(continued.subscription.status).toBe("trialing");
    expect(continued.subscription.mrr).toBe(0);
    expect(continued.lifecycleStatus).toBe("trialing");
  });

  it("continues a paused paying account and restores its price", () => {
    const continued = projectSubscriptionAction(account({ status: "paused", mrr: 0 }), "continue", { now });
    expect(continued.subscription.status).toBe("active");
    expect(continued.subscription.mrr).toBe(199);
    expect(continued.summary).toContain("Continued Harbour & Co");
  });

  it("keeps revenue until period end, then continue clears the schedule", () => {
    const scheduled = projectSubscriptionAction(account({}), "cancel_at_period_end", { now });
    expect(scheduled.subscription.cancelAtPeriodEnd).toBe(true);
    expect(scheduled.subscription.mrr).toBe(199);
    expect(scheduled.subscription.status).toBe("active");

    const kept = projectSubscriptionAction(
      account({ cancelAtPeriodEnd: true }),
      "continue",
      { now },
    );
    expect(kept.subscription.cancelAtPeriodEnd).toBe(false);
    expect(kept.subscription.status).toBe("active");
    expect(kept.subscription.mrr).toBe(199);
  });

  it("cancels immediately and leaves no further billing actions", () => {
    const canceled = projectSubscriptionAction(account({}), "cancel_now", { now });
    expect(canceled.subscription.status).toBe("canceled");
    expect(canceled.subscription.mrr).toBe(0);
    expect(canceled.lifecycleStatus).toBe("canceled");
    expect(subscriptionActions(account({ status: "canceled", mrr: 0, canceledAt: now.toISOString() }))).toEqual([]);
  });

  it("retries a past due US account in dollars and switches its plan", () => {
    const retried = projectSubscriptionAction(
      account({ market: "us", status: "past_due", lastPaymentStatus: "failed", unitAmount: 249, mrr: 249 }),
      "retry_payment",
      { now },
    );
    expect(retried.subscription.status).toBe("active");
    expect(retried.subscription.lastPaymentStatus).toBe("paid");
    expect(retried.subscription.mrr).toBe(249);

    const solo = projectSubscriptionAction(
      account({ market: "us", unitAmount: 249, mrr: 249 }),
      "change_plan",
      { plan: "solo", now },
    );
    expect(solo.subscription.plan).toBe("solo");
    expect(solo.subscription.unitAmount).toBe(59);
    expect(solo.subscription.mrr).toBe(59);
  });

  it("extends a trial by 14 days and can email invoices", () => {
    const extended = projectSubscriptionAction(
      account({ status: "trialing", mrr: 0, trialEndsAt: "2026-11-01T00:00:00.000Z" }),
      "extend_trial",
      { now },
    );
    expect(extended.subscription.trialEndsAt).toBe("2026-11-15T00:00:00.000Z");
    expect(extended.subscription.currentPeriodEnd).toBe("2026-11-15T00:00:00.000Z");

    const invoiced = projectSubscriptionAction(account({}), "send_invoice", { now });
    expect(invoiced.subscription.collectionMethod).toBe("send_invoice");
    const charged = projectSubscriptionAction(
      account({ collectionMethod: "send_invoice" }),
      "charge_automatically",
      { now },
    );
    expect(charged.subscription.collectionMethod).toBe("charge_automatically");
  });

  it("refuses an action the account cannot take", () => {
    expect(() => projectSubscriptionAction(account({}), "continue", { now })).toThrow(/not available/);
  });
});
