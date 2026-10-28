import { NextResponse } from "next/server";
import { z } from "zod";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { getStripe, isStripeConfigured } from "@/lib/stripe/config";
import { signupStripeCreated } from "@/lib/stripe/signup-checkout";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const schema = z
  .object({
    sessionId: z.string().min(8).max(200),
    plan: z.enum(["solo", "team", "enterprise"]),
    market: z.enum(["uk", "us"]),
  })
  .strict();

const isLimited = createSlidingWindowLimiter({ windowMs: 60_000, max: 12 });

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || "unknown";
}

/**
 * Writes the Stripe customer and subscription onto the signed-in org.
 * The workspace must already exist. This does not create one.
 */
export async function POST(request: Request) {
  if (isLimited(clientIp(request))) {
    return NextResponse.json({ error: "Too many checkout checks" }, { status: 429 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ mode: "local" });
  }
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can link a subscription." }, { status: 403 });
  }
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout return" }, { status: 400 });
  }
  const { sessionId, plan, market } = parsed.data;
  if (!isStripeConfigured(market)) {
    return NextResponse.json({ error: "Payment isn’t available yet." }, { status: 409 });
  }
  const stripe = getStripe(market);
  if (!stripe) {
    return NextResponse.json({ error: "Payment isn’t available yet." }, { status: 409 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metadata = session.metadata || {};
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id || null;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;
    const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;
    const verdict = signupStripeCreated({
      metadataMatches: metadata.source === "signup" && metadata.plan === plan && metadata.market === market,
      status: session.status,
      paymentStatus: session.payment_status,
      customerId,
      subscriptionId,
      subscriptionStatus: subscription?.status || null,
    });
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: 402 });
    }
    const { data: current } = await supabase
      .from("organizations")
      .select("stripe_subscription_id, subscription_status")
      .eq("id", profile.orgId)
      .maybeSingle();
    if (
      current?.stripe_subscription_id &&
      current.stripe_subscription_id !== subscriptionId &&
      ["active", "trialing", "past_due"].includes(String(current.subscription_status))
    ) {
      return NextResponse.json({ error: "This workspace already has a subscription." }, { status: 409 });
    }
    const paidEmail = (session.customer_details?.email || session.customer_email || metadata.email || "").toLowerCase();
    if (paidEmail && paidEmail !== profile.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Checkout was completed for a different email than this workspace." },
        { status: 400 },
      );
    }
    const periodEnd = subscription?.items.data[0]?.current_period_end;
    const { error } = await supabase
      .from("organizations")
      .update({
        plan,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: subscription?.items.data[0]?.price?.id || null,
        subscription_status: subscription?.status || "active",
        current_period_end: typeof periodEnd === "number" ? new Date(periodEnd * 1000).toISOString() : null,
        last_payment_status: "paid",
        last_payment_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.orgId);
    if (error) {
      return NextResponse.json({ error: "Could not link the Stripe subscription." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not link the Stripe subscription.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
