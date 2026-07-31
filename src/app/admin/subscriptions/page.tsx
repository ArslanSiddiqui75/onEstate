"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR, TableShell, EmptyRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";
import { PLANS } from "@/lib/plans/catalog";
import { staggerContainer, fadeUp } from "@/lib/motion";
import type { SubscriptionStatus } from "@/lib/admin/types";

const STATUSES: Array<SubscriptionStatus | "all"> = [
  "all",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
  "paused",
];

export default function AdminSubscriptionsPage() {
  const { registry, metrics } = useAdminSession();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  const rows = useMemo(() => {
    return registry.tenants
      .filter((t) => status === "all" || t.subscription.status === status)
      .sort((a, b) => b.subscription.mrr - a.subscription.mrr);
  }, [registry.tenants, status]);

  const byPlan = (Object.keys(PLANS) as Array<keyof typeof PLANS>).map(
    (plan) => ({
      plan,
      count: registry.tenants.filter((t) => t.subscription.plan === plan).length,
      mrr: registry.tenants
        .filter((t) => t.subscription.plan === plan)
        .reduce((s, t) => s + t.subscription.mrr, 0),
    }),
  );
  const totalTenants = Math.max(registry.tenants.length, 1);

  return (
    <div className="space-y-6">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-3 md:grid-cols-4"
      >
        <StatCard label="MRR" value={formatMoney(metrics.mrr, "uk")} icon={DollarSign} tone="accent" />
        <StatCard label="ARR" value={formatMoney(metrics.arr, "uk")} icon={TrendingUp} tone="accent" />
        <StatCard
          label="Past due"
          value={metrics.pastDueCount}
          icon={AlertTriangle}
          tone={metrics.pastDueCount > 0 ? "danger" : "neutral"}
        />
        <StatCard label="Active subs" value={metrics.activeCount} icon={CheckCircle2} tone="success" />
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-3 md:grid-cols-3"
      >
        {byPlan.map((row) => (
          <motion.div key={row.plan} variants={fadeUp}>
            <Card hover>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{PLANS[row.plan].name}</p>
                <Badge tone="accent">{row.count} orgs</Badge>
              </div>
              <p className="mt-3 font-display text-3xl tracking-tight">
                {formatMoney(row.mrr, "uk")}
              </p>
              <p className="text-xs text-[var(--muted)]">Monthly recurring revenue</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--accent-gradient)] transition-all duration-700"
                  style={{ width: `${(row.count / totalTenants) * 100}%` }}
                />
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--muted)]">
          {rows.length} subscription{rows.length === 1 ? "" : "s"}
        </p>
        <Select value={status} onValueChange={(v) => setStatus(v as (typeof STATUSES)[number])}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All subscription statuses" : s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TableShell>
        <Table>
          <THead>
            <TR>
              <TH>Tenant</TH>
              <TH>Plan</TH>
              <TH>Status</TH>
              <TH>MRR</TH>
              <TH>Period end</TH>
              <TH>Last payment</TH>
              <TH>Stripe</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((tenant) => (
              <TR key={tenant.id}>
                <TD>
                  <Link
                    href={`/admin/organizations/${tenant.id}`}
                    className="font-medium hover:underline"
                  >
                    {tenant.name}
                  </Link>
                </TD>
                <TD>{PLANS[tenant.subscription.plan].name}</TD>
                <TD>
                  <Badge
                    tone={
                      tenant.subscription.status === "active"
                        ? "success"
                        : tenant.subscription.status === "past_due" ||
                            tenant.subscription.status === "unpaid"
                          ? "danger"
                          : tenant.subscription.status === "trialing"
                            ? "accent"
                            : "neutral"
                    }
                    className="capitalize"
                  >
                    {tenant.subscription.status.replace("_", " ")}
                  </Badge>
                </TD>
                <TD className="font-medium">
                  {formatMoney(tenant.subscription.mrr, tenant.market)}
                </TD>
                <TD className="text-xs">
                  {tenant.subscription.currentPeriodEnd
                    ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString()
                    : "—"}
                </TD>
                <TD className="capitalize">{tenant.subscription.lastPaymentStatus}</TD>
                <TD className="text-xs text-[var(--muted)]">
                  {tenant.subscription.stripeCustomerId || "unlinked"}
                </TD>
              </TR>
            ))}
            {rows.length === 0 ? (
              <EmptyRow colSpan={7}>No subscriptions match this filter.</EmptyRow>
            ) : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
