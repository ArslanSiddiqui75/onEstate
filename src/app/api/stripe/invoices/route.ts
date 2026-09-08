import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/config";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";

export async function GET(request: Request) {
  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ mode: "demo", invoices: [] });
  }

  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ mode: "demo", invoices: [] });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_customer_id, plan")
    .eq("id", profile.orgId)
    .maybeSingle();

  const customerId = org?.stripe_customer_id
    ? String(org.stripe_customer_id)
    : null;

  if (!customerId) {
    return NextResponse.json({ mode: "live", invoices: [] });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ mode: "demo", invoices: [] });
  }

  const list = await stripe.invoices.list({
    customer: customerId,
    limit: 12,
  });

  const invoices = list.data.map((inv) => ({
    id: inv.id,
    date: inv.status_transitions.paid_at
      ? new Date(inv.status_transitions.paid_at * 1000).toISOString().slice(0, 10)
      : new Date(inv.created * 1000).toISOString().slice(0, 10),
    description:
      inv.lines.data[0]?.description || "Platform subscription",
    plan: org?.plan || "solo",
    amount: (inv.amount_paid || inv.total) / 100,
    currency: (inv.currency || "gbp").toUpperCase(),
    status: inv.status === "paid" ? "paid" : inv.status || "open",
    hostedInvoiceUrl: inv.hosted_invoice_url,
    invoicePdf: inv.invoice_pdf,
  }));

  return NextResponse.json({ mode: "live", invoices });
}
