import { NextResponse } from "next/server";
import { z } from "zod";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";
import { getStripe, isStripeConfigured } from "@/lib/stripe/config";
import { signupStripeCreated } from "@/lib/stripe/signup-checkout";

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

/** Checks a signup Checkout Session on the regional Stripe account. No workspace is created here. */
export async function POST(request: Request) {
  if (isLimited(clientIp(request))) {
    return NextResponse.json({ error: "Too many checkout checks" }, { status: 429 });
  }
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout return" }, { status: 400 });
  }

  const { sessionId, plan, market } = parsed.data;
  if (!isStripeConfigured(market)) {
    return NextResponse.json(
      { error: "Payment isn’t available yet." },
      { status: 409 },
    );
  }
  const stripe = getStripe(market);
  if (!stripe) {
    return NextResponse.json(
      { error: "Payment isn’t available yet." },
      { status: 409 },
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metadata = session.metadata || {};
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id || null;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;
    let subscriptionStatus: string | null = null;
    let currentPeriodEnd: string | null = null;
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      subscriptionStatus = subscription.status;
      const periodEnd = subscription.items.data[0]?.current_period_end;
      currentPeriodEnd = typeof periodEnd === "number" ? new Date(periodEnd * 1000).toISOString() : null;
    }
    const verdict = signupStripeCreated({
      metadataMatches: metadata.source === "signup" && metadata.plan === plan && metadata.market === market,
      status: session.status,
      paymentStatus: session.payment_status,
      customerId,
      subscriptionId,
      subscriptionStatus,
    });
    if (!verdict.ok) {
      const status = verdict.error.startsWith("Payment") || verdict.error.startsWith("Stripe hasn't collected") ? 402 : 400;
      return NextResponse.json({ error: verdict.error }, { status });
    }
    const email = session.customer_details?.email || session.customer_email || metadata.email || "";
    return NextResponse.json({
      ok: true,
      email,
      plan,
      market,
      customerId,
      subscriptionId,
      subscriptionStatus,
      currentPeriodEnd,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not confirm checkout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
