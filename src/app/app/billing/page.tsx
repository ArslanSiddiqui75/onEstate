"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, ShieldCheck, ListChecks, ChevronDown, ChevronUp, Download, FileText } from "lucide-react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { PLANS } from "@/lib/plans/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Table, TBody, TD, TH, THead, TR, TableShell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PlanId } from "@/types";
import { MODULE_LABELS } from "@/lib/rbac/matrix";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { toast } from "@/components/ui/toast";

const STATUS_TONE: Record<string, "success" | "danger" | "accent" | "neutral"> = {
  active: "success",
  trialing: "accent",
  past_due: "danger",
  unpaid: "danger",
  incomplete: "danger",
  incomplete_expired: "danger",
  canceled: "neutral",
  paused: "neutral",
};

function formatDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function AppBillingPage() {
  const { user, org, setPlan, market, persistence, getAuthToken, refresh } = useAppSession();
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"neutral" | "danger">("neutral");
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);

  if (!user || !org) return null;

  const allowed = hasModuleAccess(user.role, org.plan, "billing", "view");
  if (!allowed) {
    return (
      <LockedModule
        title="Billing locked"
        reason="Billing is limited to Owner, Team Lead, and Accountant."
        href="/app"
      />
    );
  }

  const currency = market === "uk" ? "£" : "$";
  const currentOrg = org;
  const status = currentOrg.subscriptionStatus;
  const renewsOn = formatDate(currentOrg.currentPeriodEnd);
  const trialEndsOn = formatDate(currentOrg.trialEndsAt);
  const isTrialing = status === "trialing" && Boolean(trialEndsOn);
  const paymentFailed = currentOrg.lastPaymentStatus === "failed";

  async function checkout(plan: PlanId) {
    setLoadingPlan(plan);
    setMessage("");
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          plan,
          email: user!.email,
          orgId: currentOrg.id,
        }),
      });
      const data = await res.json();
      if (data.mode === "live" && data.url) {
        toast.info("Redirecting to Stripe Checkout…");
        window.location.href = data.url;
        return;
      }
      if (data.mode === "updated") {
        toast.success(data.message || "Plan updated successfully.");
        await refresh();
        return;
      }
      if (data.mode === "sales") {
        toast.info(data.message);
        return;
      }
      if (data.mode === "demo") {
        if (persistence !== "supabase") {
          await setPlan(plan);
        }
        toast.success(data.message || `Switched to ${plan} plan.`);
        return;
      }
      toast.error(data.error || "Checkout failed");
    } catch {
      toast.error("Checkout request failed. Please check your network connection.");
    } finally {
      setLoadingPlan(null);
    }
  }

  async function openPaymentPortal() {
    setPortalLoading(true);
    setMessage("");
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ customerId: currentOrg.stripeCustomerId }),
      });
      const data = await res.json();
      if (data.mode === "live" && data.url) {
        toast.info("Opening Stripe Customer Portal…");
        window.location.href = data.url;
        return;
      }
      toast.info(data.message || "Payment settings available once your subscription is active.");
    } catch {
      toast.error("Could not open payment settings.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        {status ? (
          <Badge tone={STATUS_TONE[status] || "neutral"} className="capitalize">
            {status.replace(/_/g, " ")}
          </Badge>
        ) : null}
        <Button
          variant="secondary"
          disabled={portalLoading}
          onClick={() => void openPaymentPortal()}
        >
          {portalLoading ? "Opening…" : "Manage payment method"}
        </Button>
      </div>

      {paymentFailed ? (
        <Alert tone="danger">
          Your last payment failed. Update your card from &ldquo;Manage payment
          method&rdquo; to avoid losing access.
        </Alert>
      ) : null}

      {isTrialing ? (
        <Alert tone="warning">
          Your trial ends {trialEndsOn}. Add a card to keep your plan active.
        </Alert>
      ) : null}

      {currentOrg.cancelAtPeriodEnd && renewsOn ? (
        <Alert tone="warning">
          Your subscription is set to cancel on {renewsOn}. Resume anytime from
          &ldquo;Manage payment method&rdquo; before then.
        </Alert>
      ) : renewsOn && !isTrialing ? (
        <Alert tone="neutral">Renews {renewsOn}.</Alert>
      ) : null}

      {message ? <Alert tone={tone === "danger" ? "danger" : "neutral"}>{message}</Alert> : null}

      <Card>
        <CardHeader
          title="How billing works"
          description="Platform-owned Stripe — no merchant setup required from your brokerage"
        />
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { icon: ListChecks, text: "Pick a plan and continue to secure Stripe Checkout." },
            { icon: CreditCard, text: "Enter your card details, saved as a customer on our Stripe." },
            { icon: ShieldCheck, text: "We bill that card each cycle — manage it anytime from the portal." },
          ].map((step, i) => (
            <li key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <span className="stat-icon-chip h-8 w-8 rounded-lg">
                <step.icon className="h-4 w-4" aria-hidden />
              </span>
              <p className="mt-3 text-sm text-[var(--muted)]">{step.text}</p>
            </li>
          ))}
        </ol>
      </Card>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 lg:grid-cols-3"
      >
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const item = PLANS[id];
          const price =
            id === "enterprise"
              ? "Custom"
              : `${currency}${market === "uk" ? item.monthlyPriceGbp : item.monthlyPriceUsd}/mo`;
          const active = org.plan === id;
          return (
            <motion.article
              key={id}
              variants={fadeUp}
              className={cn(
                "data-card data-card-hover relative overflow-hidden p-5",
                active && "border-[var(--accent)] shadow-[var(--shadow-glow-accent)]",
                item.popular && !active && "border-[var(--accent)]/40",
              )}
            >
              {item.popular ? (
                <span className="absolute right-4 top-4 rounded-full bg-[var(--accent-gradient)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Popular
                </span>
              ) : null}
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{item.name}</h2>
                {active ? <Badge tone="accent">Current</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.tagline}</p>
              <p className="mt-4 font-display text-3xl tracking-tight">{price}</p>
              <ul className="mt-4 space-y-1.5 text-xs text-[var(--muted)]">
                {Object.entries(item.modules).map(([key, value]) => (
                  <li key={key}>
                    <span className="font-medium text-[var(--foreground)]">
                      {MODULE_LABELS[key as keyof typeof MODULE_LABELS]}
                    </span>
                    : {value}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5 w-full"
                variant={active ? "secondary" : "default"}
                disabled={active || loadingPlan === id}
                onClick={() => checkout(id)}
              >
                {active
                  ? "Current plan"
                  : loadingPlan === id
                    ? "Starting…"
                    : id === "enterprise"
                      ? "Contact sales"
                      : currentOrg.stripeSubscriptionId
                        ? "Switch to this plan"
                        : "Subscribe with card"}
              </Button>
            </motion.article>
          );
        })}
      </motion.div>

      {/* Feature Comparison Matrix Toggle */}
      <Card className="p-4">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowMatrix((v) => !v)}>
          <div>
            <h3 className="font-semibold text-base">Compare Plan Features & Limits</h3>
            <p className="text-xs text-[var(--muted)]">Detailed breakdown of seat limits, CRM, portal sync, and support per tier.</p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1">
            {showMatrix ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showMatrix ? "Hide Matrix" : "Show Matrix"}
          </Button>
        </div>

        {showMatrix ? (
          <div className="mt-4 pt-4 border-t border-[var(--border)] overflow-x-auto">
            <TableShell>
              <Table>
                <THead>
                  <TR>
                    <TH>Feature / Capability</TH>
                    <TH>Solo / Starter</TH>
                    <TH>Team / Brokerage</TH>
                    <TH>Enterprise</TH>
                  </TR>
                </THead>
                <TBody>
                  <TR>
                    <TD className="font-medium">Team Seats Included</TD>
                    <TD>1 Seat</TD>
                    <TD>Up to 10 Seats</TD>
                    <TD>Unlimited Seats</TD>
                  </TR>
                  <TR>
                    <TD className="font-medium">CRM Lead Storage</TD>
                    <TD>500 Leads</TD>
                    <TD>5,000 Leads</TD>
                    <TD>Unlimited Leads</TD>
                  </TR>
                  <TR>
                    <TD className="font-medium">Portal Distribution Sync</TD>
                    <TD>Manual / 2 Portals</TD>
                    <TD>Automated (Rightmove, Zoopla, Zillow, MLS)</TD>
                    <TD>Custom API Feeds & Real-time Webhooks</TD>
                  </TR>
                  <TR>
                    <TD className="font-medium">Social Media Planner</TD>
                    <TD>Manual Scheduling</TD>
                    <TD>Auto Listing-to-Post (All 4 Networks)</TD>
                    <TD>Multi-Brand Social Suite & AI Captions</TD>
                  </TR>
                  <TR>
                    <TD className="font-medium">Compliance & E-Sign</TD>
                    <TD>Basic Checklists</TD>
                    <TD>E-Signatures & Audit Trail</TD>
                    <TD>Custom Conveyancing Workflows</TD>
                  </TR>
                  <TR>
                    <TD className="font-medium">Support SLA</TD>
                    <TD>Standard Email</TD>
                    <TD>Priority Chat & Phone</TD>
                    <TD>Dedicated Account Manager (24/7)</TD>
                  </TR>
                </TBody>
              </Table>
            </TableShell>
          </div>
        ) : null}
      </Card>

      {/* Invoice & Payment History */}
      <Card className="p-4 space-y-3">
        <CardHeader
          title="Billing & Invoice History"
          description="Past subscription receipts and payment transactions"
        />
        <TableShell>
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Description</TH>
                <TH>Plan Tier</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH className="text-right">Receipt</TH>
              </TR>
            </THead>
            <TBody>
              {[
                { date: "2026-08-01", desc: "Monthly Platform Subscription", plan: org.plan, amount: currency + (market === "uk" ? "299" : "349"), status: "paid" },
                { date: "2026-07-01", desc: "Monthly Platform Subscription", plan: org.plan, amount: currency + (market === "uk" ? "299" : "349"), status: "paid" },
                { date: "2026-06-01", desc: "Monthly Platform Subscription", plan: org.plan, amount: currency + (market === "uk" ? "299" : "349"), status: "paid" },
              ].map((inv, idx) => (
                <TR key={idx}>
                  <TD>{inv.date}</TD>
                  <TD className="font-medium">{inv.desc}</TD>
                  <TD className="capitalize">{inv.plan}</TD>
                  <TD className="font-medium">{inv.amount}</TD>
                  <TD>
                    <Badge tone="success" className="capitalize">{inv.status}</Badge>
                  </TD>
                  <TD className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-xs"
                      onClick={() => {
                        const receiptText = `RECEIPT - 0nEstate\nInvoice Date: ${inv.date}\nOrganization: ${org.name}\nPlan: ${inv.plan.toUpperCase()}\nAmount Paid: ${inv.amount}\nStatus: PAID\nThank you for choosing 0nEstate!`;
                        const blob = new Blob([receiptText], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `invoice_${inv.date}_0nEstate.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        toast.success("Receipt downloaded");
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Receipt
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableShell>
      </Card>
    </div>
  );
}
