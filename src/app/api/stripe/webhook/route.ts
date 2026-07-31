import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured, planFromPriceId } from "@/lib/stripe/config";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

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

  await supabase.from("audit_logs").insert({
    org_id: orgId,
    action: audit.action,
    entity_type: "billing",
    entity_id: audit.entityId ?? null,
    metadata: audit.metadata ?? {},
  });
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

function subscriptionPatch(subscription: Stripe.Subscription): BillingPatch {
  const item = subscription.items.data[0];
  const priceId = item?.price?.id;
  const plan = planFromPriceId(priceId);
  return {
    ...(plan ? { plan } : {}),
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId || null,
    subscription_status: subscription.status,
    // Billing periods live on the subscription item, not the subscription
    // itself, as of the Stripe API versions this SDK targets.
    current_period_end: iso(item?.current_period_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_ends_at: iso(subscription.trial_end),
  };
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({
      received: true,
      mode: "demo",
      message: "Webhook accepted in demo mode (Stripe not configured).",
    });
  }

  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ received: true, mode: "no-db" });
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
          { action: "checkout.completed", entityId: subscriptionId, metadata: { plan: session.metadata?.plan } },
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
          metadata: { status: subscription.status },
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
          { action: "subscription.canceled", entityId: subscription.id },
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
          { action: "subscription.trial_ending_soon", entityId: subscription.id },
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
          { action: "invoice.paid", entityId: invoice.id, metadata: { amount: invoice.amount_paid } },
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
          { action: "invoice.payment_failed", entityId: invoice.id },
        );
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
