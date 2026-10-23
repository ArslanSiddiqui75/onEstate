import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/stripe/webhook-handler";
import type { Market } from "@/types";

/** Point the UK Stripe dashboard at /api/stripe/webhook/uk and the US one at /us. */
export async function POST(
  request: Request,
  context: { params: Promise<{ market: string }> },
) {
  const { market } = await context.params;
  if (market !== "uk" && market !== "us") {
    return NextResponse.json({ error: "Unknown Stripe region" }, { status: 404 });
  }
  return handleStripeWebhook(request, market as Market);
}
