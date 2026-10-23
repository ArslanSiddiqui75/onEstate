"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Users2,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { MetricCard } from "@/components/admin/region-metric";
import { formatMoney } from "@/lib/utils";
import { PLANS } from "@/lib/plans/catalog";
import { fadeUp, staggerContainer } from "@/lib/motion";
import type { StripeRegionConnection } from "@/lib/stripe/config";
import type { Market } from "@/types";

function stripeState(connection: StripeRegionConnection) {
  if (connection.accountConfigured && connection.webhookConfigured) return "connected";
  if (connection.accountConfigured || connection.webhookConfigured) return "partial";
  return "off";
}

function StripePill({ connection }: { connection: StripeRegionConnection }) {
  const state = stripeState(connection);
  const label =
    state === "connected"
      ? `${connection.label} Stripe connected`
      : state === "partial"
        ? `${connection.label} Stripe incomplete`
        : `${connection.label} Stripe not connected`;
  const tone =
    state === "connected"
      ? "border-transparent bg-[var(--success-soft)] text-[var(--success)]"
      : state === "partial"
        ? "border-transparent bg-[var(--warning-soft)] text-[var(--warning)]"
        : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]";
  const missingPrices = (["solo", "team"] as const).filter((plan) => !connection.prices[plan]);
  const hint =
    state === "connected"
      ? missingPrices.length > 0
        ? `Add ${missingPrices.join(" and ")} price ids on this account.`
        : `Checkout, portal, and invoices use this account only.`
      : `Set ${connection.secretEnv} and ${connection.webhookEnv}. Webhook: /api/stripe/webhook/${connection.market}`;

  return (
    <div className="max-w-md text-left">
      <span
        className={`stripe-region-pill inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
        data-stripe-region={connection.market}
        data-stripe-state={state}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            state === "connected"
              ? "bg-[var(--success)]"
              : state === "partial"
                ? "bg-[var(--warning)]"
                : "bg-[var(--muted)]"
          }`}
        />
        {label}
      </span>
      <p className="mt-1.5 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

export function AdminOverview({ connections }: { connections: StripeRegionConnection[] }) {
  const { metrics, registry, recentAudit } = useAdminSession();
  const byMarket = Object.fromEntries(connections.map((row) => [row.market, row])) as Record<
    Market,
    StripeRegionConnection
  >;

  const attention = registry.tenants
    .filter((t) => ["past_due", "suspended", "trialing"].includes(t.lifecycleStatus))
    .slice(0, 8);

  const uk = metrics.byMarket.uk;
  const us = metrics.byMarket.us;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {byMarket.uk ? <StripePill connection={byMarket.uk} /> : null}
        {byMarket.us ? <StripePill connection={byMarket.us} /> : null}
      </div>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard label="Tenants" uk={uk.tenantCount} us={us.tenantCount} icon={Building2} tone="neutral" />
        <MetricCard label="Active" uk={uk.activeCount} us={us.activeCount} icon={CheckCircle2} tone="success" />
        <MetricCard label="Trialing" uk={uk.trialingCount} us={us.trialingCount} icon={Clock} tone="accent" />
        <MetricCard
          label="Past due"
          uk={uk.pastDueCount}
          us={us.pastDueCount}
          icon={AlertTriangle}
          tone={uk.pastDueCount + us.pastDueCount > 0 ? "danger" : "neutral"}
        />
        <MetricCard
          label="MRR"
          uk={formatMoney(uk.mrr, "uk")}
          us={formatMoney(us.mrr, "us")}
          icon={DollarSign}
          tone="accent"
        />
        <MetricCard
          label="ARR"
          uk={formatMoney(uk.arr, "uk")}
          us={formatMoney(us.arr, "us")}
          icon={TrendingUp}
          tone="accent"
        />
        <MetricCard label="Seats in use" uk={uk.seats} us={us.seats} icon={Users2} tone="neutral" />
        <MetricCard label="Avg health" uk={uk.avgHealth} us={us.avgHealth} icon={Activity} tone="success" />
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 lg:grid-cols-2"
      >
        <motion.div variants={fadeUp}>
          <Card hover className="h-full">
            <CardHeader
              title="Attention queue"
              description="Trialing, past due, or suspended, with the region on each row"
              action={
                <Link
                  href="/admin/subscriptions"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"
                >
                  Subscriptions <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {attention.map((tenant) => (
                <li key={tenant.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={tenant.name} size="sm" />
                    <div className="min-w-0">
                      <Link
                        href={`/admin/organizations/${tenant.id}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {tenant.name}
                      </Link>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {PLANS[tenant.subscription.plan].name} · {tenant.ownerEmail}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="accent">{tenant.market.toUpperCase()}</Badge>
                    <Badge
                      tone={
                        tenant.lifecycleStatus === "past_due"
                          ? "danger"
                          : tenant.lifecycleStatus === "suspended"
                            ? "warning"
                            : "neutral"
                      }
                      className="capitalize"
                    >
                      {tenant.lifecycleStatus.replace("_", " ")}
                    </Badge>
                  </div>
                </li>
              ))}
              {attention.length === 0 ? (
                <li className="py-8 text-center text-sm text-[var(--muted)]">
                  No attention items. Tenants look healthy.
                </li>
              ) : null}
            </ul>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card hover className="h-full">
            <CardHeader
              title="Recent audit"
              description="Latest platform and tenant events"
              action={
                <Link
                  href="/admin/audit"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"
                >
                  Full log <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {recentAudit.slice(0, 8).map((event) => (
                <li key={event.id} className="py-3 text-sm first:pt-0 last:pb-0">
                  <p className="font-medium">{event.summary}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {event.actorEmail} · {event.action} · {new Date(event.at).toLocaleString()}
                  </p>
                </li>
              ))}
              {recentAudit.length === 0 ? (
                <li className="py-8 text-center text-sm text-[var(--muted)]">
                  No admin events yet. Tenant signups will appear here.
                </li>
              ) : null}
            </ul>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
