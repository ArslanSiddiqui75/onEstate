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
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { formatMoney } from "@/lib/utils";
import { PLANS } from "@/lib/plans/catalog";
import { fadeUp, staggerContainer } from "@/lib/motion";

export default function AdminOverviewPage() {
  const { metrics, registry, recentAudit } = useAdminSession();
  const marketForMoney = registry.tenants[0]?.market || "uk";

  const attention = registry.tenants
    .filter((t) => ["past_due", "suspended", "trialing"].includes(t.lifecycleStatus))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard label="Tenants" value={metrics.tenantCount} icon={Building2} tone="neutral" />
        <StatCard label="Active" value={metrics.activeCount} icon={CheckCircle2} tone="success" />
        <StatCard label="Trialing" value={metrics.trialingCount} icon={Clock} tone="accent" />
        <StatCard
          label="Past due"
          value={metrics.pastDueCount}
          icon={AlertTriangle}
          tone={metrics.pastDueCount > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="MRR"
          value={formatMoney(metrics.mrr, marketForMoney)}
          icon={DollarSign}
          tone="accent"
        />
        <StatCard
          label="ARR"
          value={formatMoney(metrics.arr, marketForMoney)}
          icon={TrendingUp}
          tone="accent"
        />
        <StatCard label="Seats in use" value={metrics.seats} icon={Users2} tone="neutral" />
        <StatCard label="Avg health" value={metrics.avgHealth} icon={Activity} tone="success" />
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
              description="Tenants trialing, past due, or suspended"
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
                  <Badge
                    tone={
                      tenant.lifecycleStatus === "past_due"
                        ? "danger"
                        : tenant.lifecycleStatus === "suspended"
                          ? "warning"
                          : "neutral"
                    }
                    className="shrink-0 capitalize"
                  >
                    {tenant.lifecycleStatus.replace("_", " ")}
                  </Badge>
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
                    {event.actorEmail} · {event.action} ·{" "}
                    {new Date(event.at).toLocaleString()}
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
