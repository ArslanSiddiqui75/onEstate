import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, isStripeConfigured } from "@/lib/stripe/config";
import type { Market } from "@/types";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";
import { sameOriginUrl } from "@/lib/http/same-origin";

const schema = z.object({
  customerId: z.string().min(1).optional(),
  returnUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const returnUrl = sameOriginUrl(parsed.data.returnUrl, `${origin}/app/settings/billing`, origin);

  // Never trust a client-supplied Stripe customer id — that would let anyone
  // open someone else's billing portal. Resolve the caller's own org instead.
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      mode: "demo",
      market: "uk",
      message: "Payment settings open after your first payment.",
      returnUrl,
    });
  }
  let customerId: string | null = null;
  let market: Market = "uk";
  {
    const profile = await resolveProfileFromRequest(request);
    if (!profile) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const denied = forbiddenIfNoModule(profile, "billing", "view");
    if (denied) return denied;
    const { data: org } = await supabase
      .from("organizations")
      .select("market, stripe_customer_id")
      .eq("id", profile.orgId)
      .maybeSingle();
    if (org?.market === "uk" || org?.market === "us") market = org.market;
    customerId = org?.stripe_customer_id ? String(org.stripe_customer_id) : null;
  }

  if (!isStripeConfigured(market) || !customerId) {
    return NextResponse.json({
      mode: "demo",
      market,
      message: "Payment settings open after your first payment.",
      returnUrl,
    });
  }

  const stripe = getStripe(market);
  if (!stripe) {
    return NextResponse.json({ error: "Stripe unavailable" }, { status: 500 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ mode: "live", url: session.url });
}
