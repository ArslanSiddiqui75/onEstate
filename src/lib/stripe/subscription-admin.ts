import type Stripe from "stripe";
import { getStripePriceId } from "@/lib/stripe/config";
import type { SubscriptionAction } from "@/lib/admin/subscription-actions";
import type { Market, PlanId } from "@/types";

const TRIAL_EXTENSION_SECONDS = 14 * 24 * 60 * 60;

function stripeMessage(error: unknown) {
  return error instanceof Error ? error.message : "Stripe could not update this subscription.";
}

/**
 * Apply one operator action on the Stripe account that bills this market.
 * A UK subscription is never sent to the US account, and the reverse.
 */
export async function applyStripeSubscriptionAction(
  stripe: Stripe,
  input: {
    subscriptionId: string;
    action: SubscriptionAction;
    market: Market;
    plan?: PlanId;
  },
) {
  const id = input.subscriptionId;

  try {
    if (input.action === "pause") {
      await stripe.subscriptions.update(id, {
        pause_collection: { behavior: "void" },
      });
      return;
    }

    if (input.action === "continue") {
      const current = await stripe.subscriptions.retrieve(id);
      if (current.status === "canceled") {
        throw new Error("Stripe cannot continue a canceled subscription. Start a new checkout for this account.");
      }
      await stripe.subscriptions.update(id, {
        cancel_at_period_end: false,
        pause_collection: "",
      });
      return;
    }

    if (input.action === "cancel_at_period_end") {
      await stripe.subscriptions.update(id, { cancel_at_period_end: true });
      return;
    }

    if (input.action === "cancel_now") {
      await stripe.subscriptions.cancel(id);
      return;
    }

    if (input.action === "retry_payment") {
      const open = await stripe.invoices.list({ subscription: id, status: "open", limit: 1 });
      const invoice = open.data[0];
      if (!invoice) throw new Error("No open invoice to retry.");
      await stripe.invoices.pay(invoice.id);
      return;
    }

    if (input.action === "charge_automatically") {
      await stripe.subscriptions.update(id, { collection_method: "charge_automatically" });
      return;
    }

    if (input.action === "send_invoice") {
      await stripe.subscriptions.update(id, {
        collection_method: "send_invoice",
        days_until_due: 7,
      });
      return;
    }

    if (input.action === "extend_trial") {
      const current = await stripe.subscriptions.retrieve(id);
      const now = Math.floor(Date.now() / 1000);
      const base = current.trial_end && current.trial_end > now ? current.trial_end : now;
      await stripe.subscriptions.update(id, { trial_end: base + TRIAL_EXTENSION_SECONDS });
      return;
    }

    if (input.action === "change_plan") {
      if (!input.plan || input.plan === "enterprise") {
        throw new Error("Enterprise is sales-assisted and has no Stripe price on this account.");
      }
      const priceId = getStripePriceId(input.plan, input.market);
      if (!priceId) {
        const region = input.market === "uk" ? "UK" : "US";
        throw new Error(`Missing ${region} Stripe price for ${input.plan}.`);
      }
      const current = await stripe.subscriptions.retrieve(id);
      const item = current.items.data[0];
      if (!item) throw new Error("Subscription has no line items.");
      await stripe.subscriptions.update(id, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: "create_prorations",
        metadata: { plan: input.plan },
      });
    }
  } catch (error) {
    throw new Error(stripeMessage(error));
  }
}
