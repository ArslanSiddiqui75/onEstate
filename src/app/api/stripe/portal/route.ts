import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, isStripeConfigured } from "@/lib/stripe/config";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";

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
  const returnUrl = parsed.data.returnUrl || `${origin}/app/billing`;

  // Never trust a client-supplied Stripe customer id — that would let anyone
  // open someone else's billing portal. Resolve the caller's own org instead.
  const supabase = createServiceSupabaseClient();
  let customerId = parsed.data.customerId || null;
  if (supabase) {
    const profile = await resolveProfileFromRequest(request);
    if (!profile) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const { data: org } = await supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", profile.orgId)
      .maybeSingle();
    customerId = org?.stripe_customer_id ? String(org.stripe_customer_id) : null;
  }

  if (!isStripeConfigured() || !customerId) {
    return NextResponse.json({
      mode: "demo",
      message: "Payment method portal opens after your first successful card checkout.",
      returnUrl,
    });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe unavailable" }, { status: 500 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ mode: "live", url: session.url });
}
