import { NextResponse } from "next/server";
import { z } from "zod";
import { createSlidingWindowLimiter } from "@/lib/server/rate-limit";
import { getStripe, getStripePriceId, isStripeConfigured } from "@/lib/stripe/config";
import {
  signupCheckoutDecision,
  signupCheckoutMetadata,
} from "@/lib/stripe/signup-checkout";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "@/lib/team/invite-token";
import type { Market, PlanId } from "@/types";

const planSchema = z.enum(["solo", "team", "enterprise"]);
const marketSchema = z.enum(["uk", "us"]);

const postSchema = z
  .object({
    plan: planSchema,
    market: marketSchema,
    email: z.string().email(),
    orgName: z.string().min(1).max(120),
    acceptTerms: z.literal(true),
  })
  .strict();

const isStatusLimited = createSlidingWindowLimiter({ windowMs: 60_000, max: 30 });
const isSessionLimited = createSlidingWindowLimiter({ windowMs: 60_000, max: 8 });

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || "unknown";
}

function decisionFor(plan: PlanId, market: Market) {
  return signupCheckoutDecision({
    plan,
    stripeConfigured: isStripeConfigured(market),
    priceId: getStripePriceId(plan, market),
  });
}

export async function GET(request: Request) {
  if (isStatusLimited(clientIp(request))) {
    return NextResponse.json({ error: "Too many checkout checks" }, { status: 429 });
  }
  const url = new URL(request.url);
  const plan = planSchema.safeParse(url.searchParams.get("plan"));
  const market = marketSchema.safeParse(url.searchParams.get("market"));
  if (!plan.success || !market.success) {
    return NextResponse.json({ error: "Invalid checkout plan" }, { status: 400 });
  }
  const decision = decisionFor(plan.data, market.data);
  if (decision.mode === "live") {
    return NextResponse.json({ mode: "live", market: market.data, plan: plan.data });
  }
  return NextResponse.json({ ...decision, market: market.data, plan: plan.data });
}

export async function POST(request: Request) {
  if (isSessionLimited(clientIp(request))) {
    return NextResponse.json({ error: "Too many checkout attempts" }, { status: 429 });
  }
  const json = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout payload" }, { status: 400 });
  }

  const { plan, market, email, orgName } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const supabase = createServiceSupabaseClient();
  if (supabase) {
    const { data: pendingInvite } = await supabase
      .from("team_invites")
      .select("token, organizations(name)")
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingInvite?.token) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      return NextResponse.json(
        {
          error:
            "This email has a team invite. Accept it instead of opening a new paid workspace.",
          inviteUrl: `${appUrl}/app/invite?token=${encodeURIComponent(String(pendingInvite.token))}`,
        },
        { status: 409 },
      );
    }
  }

  const decision = decisionFor(plan, market);
  if (decision.mode !== "live") {
    return NextResponse.json({ ...decision, market, plan });
  }

  const stripe = getStripe(market);
  if (!stripe) {
    return NextResponse.json({ mode: "preview", reason: "account", market, plan });
  }

  const origin = new URL(request.url).origin;
  const metadata = signupCheckoutMetadata({
    plan,
    market,
    email: normalizedEmail,
    orgName,
    acceptTerms: true,
    termsVersion: TERMS_VERSION,
  });
  const successUrl = `${origin}/app/checkout/complete?plan=${plan}&market=${market}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/app/checkout?plan=${plan}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: decision.priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: normalizedEmail,
      allow_promotion_codes: true,
      payment_method_collection: "always",
      billing_address_collection: "required",
      client_reference_id: normalizedEmail.slice(0, 200),
      metadata,
      subscription_data: { metadata },
    });
    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
    }

    if (supabase) {
      await supabase.from("signup_checkout_intents").upsert(
        {
          stripe_session_id: session.id,
          email: normalizedEmail,
          org_name: orgName,
          plan,
          market,
          accept_terms: true,
          status: "open",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_session_id" },
      );
    }

    return NextResponse.json({ mode: "live", url: session.url, sessionId: session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start Stripe checkout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
