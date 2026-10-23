import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, getStripePriceId, isStripeConfigured } from "@/lib/stripe/config";
import type { Market } from "@/types";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";
import { sameOriginUrl } from "@/lib/http/same-origin";

const schema = z.object({
  plan: z.enum(["solo", "team", "enterprise"]),
  market: z.enum(["uk", "us"]).optional(),
  email: z.string().email().optional(),
  orgId: z.string().min(1).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout payload" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const successUrl = sameOriginUrl(
    parsed.data.successUrl,
    `${origin}/app/billing?checkout=success`,
    origin,
  );
  const cancelUrl = sameOriginUrl(
    parsed.data.cancelUrl,
    `${origin}/app/billing?checkout=cancel`,
    origin,
  );

  // Once Supabase is configured this is a real hosted deployment: never trust
  // a client-supplied orgId/email for something that moves money — resolve
  // the caller's own org from their auth token instead.
  const supabase = createServiceSupabaseClient();
  let orgId = parsed.data.orgId;
  let email = parsed.data.email;
  if (supabase) {
    const profile = await resolveProfileFromRequest(request);
    if (!profile) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const denied = forbiddenIfNoModule(profile, "billing", "view");
    if (denied) return denied;
    orgId = profile.orgId;
    email = profile.email || email;
  }
  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  // The org's market picks the Stripe account. A UK tenant is never charged
  // on the US account, even if the client sends the other market.
  let market: Market = parsed.data.market === "us" ? "us" : "uk";
  let existingCustomerId: string | null = null;
  let existingSubscriptionId: string | null = null;
  if (supabase) {
    const { data: org } = await supabase
      .from("organizations")
      .select("market, stripe_customer_id, stripe_subscription_id")
      .eq("id", orgId)
      .maybeSingle();
    if (org?.market === "uk" || org?.market === "us") market = org.market;
    existingCustomerId = org?.stripe_customer_id ? String(org.stripe_customer_id) : null;
    existingSubscriptionId = org?.stripe_subscription_id
      ? String(org.stripe_subscription_id)
      : null;
  }

  const regionLabel = market === "uk" ? "UK" : "US";

  if (!isStripeConfigured(market)) {
    // Each region has its own Stripe account. Keys stay with the operator.
    return NextResponse.json({
      mode: "demo",
      market,
      message: supabase
        ? `The ${regionLabel} Stripe account isn't connected, so this plan can't be billed. Add that region's secret key and webhook secret.`
        : `Subscription preview applied. Live mode collects the card on the ${regionLabel} Stripe account.`,
      preview: { plan: parsed.data.plan, market, successUrl, cancelUrl },
    });
  }

  if (parsed.data.plan === "enterprise") {
    return NextResponse.json({
      mode: "sales",
      market,
      message: "Enterprise plans are sales-assisted. Contact sales to scope rollout and integrations.",
    });
  }

  const stripe = getStripe(market);
  const priceId = getStripePriceId(parsed.data.plan, market);
  if (!stripe || !priceId) {
    return NextResponse.json(
      { error: `Missing ${regionLabel} Stripe price ID for ${parsed.data.plan}` },
      { status: 500 },
    );
  }

  // Tenant already has a live subscription — swap the price on it instead of
  // starting a second, duplicate subscription every time they change plans.
  if (existingSubscriptionId && supabase) {
    try {
      const subscription = await stripe.subscriptions.retrieve(existingSubscriptionId);
      const item = subscription.items.data[0];
      if (!item) throw new Error("Subscription has no line items");

      const updated = await stripe.subscriptions.update(existingSubscriptionId, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: "create_prorations",
        metadata: { org_id: orgId, plan: parsed.data.plan },
      });
      const updatedItem = updated.items.data[0];

      await supabase
        .from("organizations")
        .update({
          plan: parsed.data.plan,
          stripe_price_id: priceId,
          subscription_status: updated.status,
          current_period_end: updatedItem
            ? new Date(updatedItem.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: updated.cancel_at_period_end,
          trial_ends_at: updated.trial_end
            ? new Date(updated.trial_end * 1000).toISOString()
            : null,
        })
        .eq("id", orgId);

      await supabase.from("audit_logs").insert({
        org_id: orgId,
        action: "subscription.plan_changed",
        entity_type: "billing",
        entity_id: updated.id,
        metadata: { plan: parsed.data.plan },
      });

      return NextResponse.json({
        mode: "updated",
        message: `Plan changed to ${parsed.data.plan}. Stripe applies a prorated charge or credit automatically.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update subscription";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // Platform-owned Stripe account: tenant only enters a payment method.
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(existingCustomerId
      ? { customer: existingCustomerId }
      : { customer_email: email }),
    allow_promotion_codes: true,
    payment_method_collection: "always",
    billing_address_collection: "required",
    client_reference_id: orgId,
    metadata: { plan: parsed.data.plan, org_id: orgId, market },
    // Metadata on the Checkout Session does NOT carry over to the Subscription
    // object, so every later customer.subscription.* / invoice.* webhook event
    // would arrive without org_id unless we copy it here too.
    subscription_data: { metadata: { plan: parsed.data.plan, org_id: orgId, market } },
  });

  return NextResponse.json({ mode: "live", url: session.url, id: session.id });
}
