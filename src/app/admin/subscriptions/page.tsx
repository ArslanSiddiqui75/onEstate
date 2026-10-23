"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR, TableShell, EmptyRow } from "@/components/ui/table";
import { cn, formatMoney } from "@/lib/utils";
import { PLANS } from "@/lib/plans/catalog";
import { staggerContainer, fadeUp } from "@/lib/motion";
import type { SubscriptionStatus, TenantRecord } from "@/lib/admin/types";
import type { PlanId } from "@/types";

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

type CardFilter =
  | { type: "mrr" }
  | { type: "arr" }
  | { type: "past_due" }
  | { type: "active" }
  | { type: "plan"; plan: PlanId };

function sameFilter(a: CardFilter | null, b: CardFilter) {
  if (!a) return false;
  if (a.type !== b.type) return false;
  return a.type !== "plan" || b.type !== "plan" || a.plan === b.plan;
}

function matchesCard(tenant: TenantRecord, filter: CardFilter) {
  if (filter.type === "mrr" || filter.type === "arr") return tenant.subscription.mrr > 0;
  if (filter.type === "past_due") return tenant.lifecycleStatus === "past_due";
  if (filter.type === "active") return tenant.lifecycleStatus === "active";
  return tenant.subscription.plan === filter.plan;
}

function cardClass(selected: boolean) {
  return selected ? "is-filter-selected" : undefined;
}

function FilterCard({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className="block h-full w-full cursor-pointer rounded-[1.25rem] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      {children}
    </button>
  );
}

export default function AdminSubscriptionsPage() {
  const { registry, metrics } = useAdminSession();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [card, setCard] = useState<CardFilter | null>(null);

  function selectCard(next: CardFilter) {
    const turningOff = sameFilter(card, next);
    setCard(turningOff ? null : next);
    setStatus(
      turningOff || (next.type !== "past_due" && next.type !== "active") ? "all" : next.type,
    );
  }

  const rows = useMemo(() => {
    return registry.tenants
      .filter((tenant) => {
        if (card) return matchesCard(tenant, card);
        return status === "all" || tenant.subscription.status === status;
      })
      .sort((a, b) => b.subscription.mrr - a.subscription.mrr);
  }, [registry.tenants, status, card]);

  const byPlan = (Object.keys(PLANS) as Array<keyof typeof PLANS>).map((plan) => {
    const onPlan = registry.tenants.filter((t) => t.subscription.plan === plan);
    const mrrFor = (market: "uk" | "us") =>
      onPlan.filter((t) => t.market === market).reduce((s, t) => s + t.subscription.mrr, 0);
    return {
      plan,
      count: onPlan.length,
      mrrUk: mrrFor("uk"),
      mrrUs: mrrFor("us"),
    };
  });
  const totalTenants = Math.max(registry.tenants.length, 1);

  return (
    <div className="space-y-6">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-3 md:grid-cols-4"
      >
        <FilterCard
          label="Show subscriptions that make up MRR"
          pressed={card?.type === "mrr"}
          onClick={() => selectCard({ type: "mrr" })}
        >
          <StatCard
            label="MRR"
            value={
              <span className="flex flex-col gap-1">
                <span>{formatMoney(metrics.byMarket.uk.mrr, "uk")}</span>
                <span className="text-[1.15rem] leading-none text-[var(--muted)]">
                  {formatMoney(metrics.byMarket.us.mrr, "us")}
                </span>
              </span>
            }
            sub="UK pounds, then US dollars"
            icon={DollarSign}
            tone="accent"
            className={cardClass(card?.type === "mrr")}
          />
        </FilterCard>
        <FilterCard
          label="Show subscriptions that make up ARR"
          pressed={card?.type === "arr"}
          onClick={() => selectCard({ type: "arr" })}
        >
          <StatCard
            label="ARR"
            value={
              <span className="flex flex-col gap-1">
                <span>{formatMoney(metrics.byMarket.uk.arr, "uk")}</span>
                <span className="text-[1.15rem] leading-none text-[var(--muted)]">
                  {formatMoney(metrics.byMarket.us.arr, "us")}
                </span>
              </span>
            }
            sub="UK pounds, then US dollars"
            icon={TrendingUp}
            tone="accent"
            className={cardClass(card?.type === "arr")}
          />
        </FilterCard>
        <FilterCard
          label="Show past due subscriptions"
          pressed={card?.type === "past_due"}
          onClick={() => selectCard({ type: "past_due" })}
        >
          <StatCard
            label="Past due"
            value={metrics.pastDueCount}
            icon={AlertTriangle}
            tone={metrics.pastDueCount > 0 ? "danger" : "neutral"}
            className={cardClass(card?.type === "past_due")}
          />
        </FilterCard>
        <FilterCard
          label="Show active subscriptions"
          pressed={card?.type === "active"}
          onClick={() => selectCard({ type: "active" })}
        >
          <StatCard
            label="Active subs"
            value={metrics.activeCount}
            icon={CheckCircle2}
            tone="success"
            className={cardClass(card?.type === "active")}
          />
        </FilterCard>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-3 md:grid-cols-3"
      >
        {byPlan.map((row) => {
          const selected = card?.type === "plan" && card.plan === row.plan;
          return (
            <motion.div key={row.plan} variants={fadeUp}>
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`Show ${PLANS[row.plan].name} subscriptions`}
                onClick={() => selectCard({ type: "plan", plan: row.plan })}
                className={cn(
                  "data-card data-card-hover w-full cursor-pointer p-5 text-left",
                  cardClass(selected),
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{PLANS[row.plan].name}</p>
                  <Badge tone="accent">{row.count} orgs</Badge>
                </div>
                <p className="mt-3 font-display text-2xl leading-tight tracking-tight">
                  {formatMoney(row.mrrUk, "uk")}
                  <span className="mt-1 block text-lg text-[var(--muted)]">
                    {formatMoney(row.mrrUs, "us")}
                  </span>
                </p>
                <p className="text-xs text-[var(--muted)]">UK pounds, then US dollars</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent-gradient)] transition-all duration-700"
                    style={{ width: `${(row.count / totalTenants) * 100}%` }}
                  />
                </div>
              </button>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--muted)]">
          {card || status !== "all"
            ? `${rows.length} of ${registry.tenants.length} subscriptions`
            : `${rows.length} subscription${rows.length === 1 ? "" : "s"}`}
        </p>
        <Select
          value={status}
          onValueChange={(v) => {
            setCard(null);
            setStatus(v as (typeof STATUSES)[number]);
          }}
        >
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
