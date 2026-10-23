import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripe,
  isStripeConfigured,
  planFromPriceId,
  stripeWebhookSecret,
} from "@/lib/stripe/config";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { syncLifecycleFromSubscription, upsertPlatformSubscriptionFromOrg } from "@/lib/admin/platform-db";
import type { Market } from "@/types";

type SupabaseClient = NonNullable<ReturnType<typeof createServiceSupabaseClient>>;

function iso(unixSeconds: number | null | undefined) {
  return typeof unixSeconds === "number" ? new Date(unixSeconds * 1000).toISOString() : null;
}

/** Fields we mirror onto `organizations` so the tenant billing page reflects Stripe in real time. */
interface BillingPatch {
  plan?: "solo" | "team" | "enterprise";
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  trial_ends_at?: string | null;
  last_payment_status?: string | null;
  last_payment_at?: string | null;
}

async function applyBillingPatch(
  supabase: SupabaseClient,
  orgId: string,
  patch: BillingPatch,
  audit: { action: string; entityId?: string | null; metadata?: Record<string, unknown> },
) {
  await supabase
    .from("organizations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", orgId);

  if (patch.subscription_status) {
    await syncLifecycleFromSubscription(supabase, orgId, patch.subscription_status);
  }

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    action: audit.action,
    entity_type: "billing",
    entity_id: audit.entityId ?? null,
    metadata: audit.metadata ?? {},
  });
  await upsertPlatformSubscriptionFromOrg(supabase, orgId);
}

async function orgIdForCustomer(supabase: SupabaseClient, customerId: string | null | undefined) {
  if (!customerId) return null;
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data ? String(data.id) : null;
}

function mirroredStatus(subscription: Stripe.Subscription) {
  if (subscription.pause_collection) return "paused";
  if (subscription.status === "incomplete_expired") return "canceled";
  return subscription.status;
}

function subscriptionPatch(subscription: Stripe.Subscription): BillingPatch {
  const item = subscription.items.data[0];
  const priceId = item?.price?.id;
  const plan = planFromPriceId(priceId);
  return {
    ...(plan ? { plan } : {}),
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId || null,
    subscription_status: mirroredStatus(subscription),
    // Billing periods live on the subscription item, not the subscription
    // itself, as of the Stripe API versions this SDK targets.
    current_period_end: iso(item?.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_ends_at: iso(subscription.trial_end),
  };
}

function verifyEvent(payload: string, signature: string, market: Market) {
  const stripe = getStripe(market);
  const secret = stripeWebhookSecret(market);
  if (!stripe || !secret) return null;
  try {
    return { market, stripe, event: stripe.webhooks.constructEvent(payload, signature, secret) };
  } catch {
    return null;
  }
}

/**
 * Verify a webhook against one region's Stripe account, or try UK then US
 * when the legacy shared URL is used. Each account has its own signing secret.
 */
export async function handleStripeWebhook(request: Request, only?: Market) {
  const markets: Market[] = only ? [only] : ["uk", "us"];
  const configured = markets.filter((market) => isStripeConfigured(market) && stripeWebhookSecret(market));
  if (configured.length === 0) {
    return NextResponse.json({
      received: true,
      mode: "demo",
      market: only ?? null,
      message: only
        ? `Webhook accepted in demo mode (${only.toUpperCase()} Stripe is not connected).`
        : "Webhook accepted in demo mode (neither region's Stripe account is connected).",
    });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  const verified = configured
    .map((market) => verifyEvent(payload, signature, market))
    .find((result) => result !== null);

  if (!verified) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { stripe, event, market } = verified;
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ received: true, mode: "no-db", market });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.org_id || session.client_reference_id || null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (orgId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const patch = subscriptionPatch(subscription);
        await applyBillingPatch(
          supabase,
          orgId,
          {
            ...patch,
            plan: (session.metadata?.plan as BillingPatch["plan"]) || patch.plan,
            stripe_customer_id: customerId || null,
            last_payment_status: "paid",
            last_payment_at: new Date().toISOString(),
          },
          { action: "checkout.completed", entityId: subscriptionId, metadata: { plan: session.metadata?.plan, market } },
        );
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const orgId =
        subscription.metadata?.org_id || (await orgIdForCustomer(supabase, customerId));
      if (orgId) {
        await applyBillingPatch(supabase, orgId, subscriptionPatch(subscription), {
          action: `subscription.${event.type === "customer.subscription.created" ? "created" : "updated"}`,
          entityId: subscription.id,
          metadata: { status: subscription.status, market },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const orgId =
        subscription.metadata?.org_id || (await orgIdForCustomer(supabase, customerId));
      if (orgId) {
        await applyBillingPatch(
          supabase,
          orgId,
          {
            subscription_status: "canceled",
            cancel_at_period_end: false,
          },
          { action: "subscription.canceled", entityId: subscription.id, metadata: { market } },
        );
      }
      break;
    }

    case "customer.subscription.trial_will_end": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const orgId =
        subscription.metadata?.org_id || (await orgIdForCustomer(supabase, customerId));
      if (orgId) {
        await applyBillingPatch(
          supabase,
          orgId,
          { trial_ends_at: iso(subscription.trial_end) },
          { action: "subscription.trial_ending_soon", entityId: subscription.id, metadata: { market } },
        );
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      const orgId = await orgIdForCustomer(supabase, customerId);
      if (orgId) {
        await applyBillingPatch(
          supabase,
          orgId,
          { last_payment_status: "paid", last_payment_at: new Date().toISOString() },
          { action: "invoice.paid", entityId: invoice.id, metadata: { amount: invoice.amount_paid, market } },
        );
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      const orgId = await orgIdForCustomer(supabase, customerId);
      if (orgId) {
        await applyBillingPatch(
          supabase,
          orgId,
          { last_payment_status: "failed", subscription_status: "past_due" },
          { action: "invoice.payment_failed", entityId: invoice.id, metadata: { market } },
        );
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true, market });
}
