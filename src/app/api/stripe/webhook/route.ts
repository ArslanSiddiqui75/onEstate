import { handleStripeWebhook } from "@/lib/stripe/webhook-handler";

/** Legacy URL. Tries the UK signing secret, then the US one. */
export async function POST(request: Request) {
  return handleStripeWebhook(request);
}
