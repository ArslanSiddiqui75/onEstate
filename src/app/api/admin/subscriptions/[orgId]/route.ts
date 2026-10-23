import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin/request-admin";
import { adminCanManageBilling } from "@/lib/admin/accounts";
import { saveSubscriptionProjection } from "@/lib/admin/platform-db";
import {
  SUBSCRIPTION_ACTIONS,
  projectSubscriptionAction,
  subscriptionActions,
} from "@/lib/admin/subscription-actions";
import type { TenantRecord } from "@/lib/admin/types";
import { planAmount, seatLimit } from "@/lib/admin/registry";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getStripe, getStripePriceId } from "@/lib/stripe/config";
import { applyStripeSubscriptionAction } from "@/lib/stripe/subscription-admin";
import type { Market, PlanId } from "@/types";

const bodySchema = z.object({
  action: z.enum(SUBSCRIPTION_ACTIONS),
  plan: z.enum(["solo", "team", "enterprise"]).optional(),
});

function regionLabel(market: Market) {
  return market === "uk" ? "UK" : "US";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const admin = await requirePlatformAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!adminCanManageBilling(admin.role)) {
    return NextResponse.json({ error: "Billing permission required" }, { status: 403 });
  }

  const { orgId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ source: "local" });
  }

  const [{ data: org }, { data: subRow }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id, name, market, plan, stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status, current_period_end, cancel_at_period_end, trial_ends_at, last_payment_status, last_payment_at",
      )
      .eq("id", orgId)
      .maybeSingle(),
    supabase.from("platform_subscriptions").select("*").eq("org_id", orgId).maybeSingle(),
  ]);

  if (!org) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const market = (org.market === "us" ? "us" : "uk") as Market;
  const plan = (org.plan || "solo") as PlanId;
  const amount = planAmount(plan, market);
  const status = String(subRow?.status || org.subscription_status || "trialing") as TenantRecord["subscription"]["status"];
  const account: Pick<TenantRecord, "name" | "market" | "lifecycleStatus" | "subscription"> = {
    name: String(org.name),
    market,
    lifecycleStatus: "active",
    subscription: {
      id: String(subRow?.id || orgId),
      plan,
      status,
      interval: subRow?.interval === "year" ? "year" : "month",
      currency: market === "uk" ? "GBP" : "USD",
      unitAmount: Number(subRow?.unit_amount ?? amount),
      mrr: Number(subRow?.mrr ?? 0),
      seatsIncluded: Number(subRow?.seats_included ?? seatLimit(plan)),
      seatsUsed: 1,
      stripeCustomerId: org.stripe_customer_id || undefined,
      stripeSubscriptionId: org.stripe_subscription_id || undefined,
      stripePriceId: org.stripe_price_id || undefined,
      trialEndsAt: org.trial_ends_at || subRow?.trial_ends_at || undefined,
      currentPeriodEnd: org.current_period_end || subRow?.current_period_end || undefined,
      cancelAtPeriodEnd: Boolean(org.cancel_at_period_end ?? subRow?.cancel_at_period_end),
      canceledAt: subRow?.canceled_at || undefined,
      collectionMethod:
        subRow?.collection_method === "send_invoice" || subRow?.collection_method === "manual"
          ? subRow.collection_method
          : "charge_automatically",
      lastPaymentStatus: (org.last_payment_status || subRow?.last_payment_status || "none") as TenantRecord["subscription"]["lastPaymentStatus"],
      lastPaymentAt: org.last_payment_at || subRow?.last_payment_at || undefined,
    },
  };

  const chosen = subscriptionActions(account).find(
    (option) => option.action === parsed.data.action && (parsed.data.action !== "change_plan" || option.plan === parsed.data.plan),
  );
  if (!chosen) {
    return NextResponse.json(
      { error: "That action is not available for this subscription." },
      { status: 409 },
    );
  }

  let next;
  try {
    next = projectSubscriptionAction(account, parsed.data.action, { plan: parsed.data.plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the subscription";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const stripeSubId = org.stripe_subscription_id ? String(org.stripe_subscription_id) : "";
  const stripe = getStripe(market);
  let mode: "stripe" | "recorded" = "recorded";
  let note = "";

  if (stripe && stripeSubId) {
    const changingToEnterprise = parsed.data.action === "change_plan" && parsed.data.plan === "enterprise";
    if (changingToEnterprise) {
      note = " The live Stripe subscription was left unchanged because Enterprise has no price on this account.";
    } else {
      if (parsed.data.action === "change_plan" && parsed.data.plan && parsed.data.plan !== "enterprise") {
        const priceId = getStripePriceId(parsed.data.plan, market);
        if (!priceId) {
          return NextResponse.json(
            { error: `Missing ${regionLabel(market)} Stripe price for ${parsed.data.plan}.` },
            { status: 409 },
          );
        }
        next.subscription.stripePriceId = priceId;
      }
      try {
        await applyStripeSubscriptionAction(stripe, {
          subscriptionId: stripeSubId,
          action: parsed.data.action,
          market,
          plan: parsed.data.plan,
        });
        mode = "stripe";
      } catch (error) {
        const message = error instanceof Error ? error.message : "Stripe could not update this subscription.";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }
  } else if (stripeSubId && !stripe) {
    note = ` ${regionLabel(market)} Stripe is not connected, so this was recorded here only.`;
  }

  await saveSubscriptionProjection(supabase, orgId, admin.email, next);
  return NextResponse.json({ ok: true, mode, message: `${next.summary}${note}` });
}
