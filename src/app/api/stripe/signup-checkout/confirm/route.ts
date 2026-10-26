import { NextResponse } from "next/server";
import { z } from "zod";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";
import { getStripe, isStripeConfigured } from "@/lib/stripe/config";

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
      { error: "Stripe isn't connected for this region." },
      { status: 409 },
    );
  }
  const stripe = getStripe(market);
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe isn't connected for this region." },
      { status: 409 },
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metadata = session.metadata || {};
    const matches =
      metadata.source === "signup" && metadata.plan === plan && metadata.market === market;
    if (!matches) {
      return NextResponse.json({ error: "Checkout session doesn't match this plan." }, { status: 400 });
    }
    if (session.status !== "complete") {
      return NextResponse.json({ error: "Payment isn't complete yet." }, { status: 402 });
    }
    const email = session.customer_details?.email || session.customer_email || metadata.email || "";
    return NextResponse.json({ ok: true, email, plan, market });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not confirm checkout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
