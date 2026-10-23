"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { Badge } from "@/components/ui/badge";
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
import type { StripeRegionConnection } from "@/lib/stripe/config";
import type { Market, PlanId } from "@/types";

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

const TONE_CHIP = {
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  neutral: "bg-[var(--surface-muted)] text-[var(--foreground)]",
};

function RegionLine({
  code,
  value,
  detail,
}: {
  code: "UK" | "US";
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline gap-3 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{code}</span>
      {detail != null ? (
        <span className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-baseline gap-3">
          <span className="text-right font-display text-xl leading-none tracking-tight whitespace-nowrap tabular-nums">
            {value}
          </span>
          <span className="text-right text-[11px] font-medium text-[var(--muted)]">{detail}</span>
        </span>
      ) : (
        <span className="text-right font-display text-xl leading-none tracking-tight whitespace-nowrap tabular-nums">
          {value}
        </span>
      )}
    </div>
  );
}

function RegionPair({
  uk,
  us,
  ukDetail,
  usDetail,
}: {
  uk: ReactNode;
  us: ReactNode;
  ukDetail?: ReactNode;
  usDetail?: ReactNode;
}) {
  return (
    <div className="mt-1 divide-y divide-[var(--border)]" data-stacked-values="true">
      <RegionLine code="UK" value={uk} detail={ukDetail} />
      <RegionLine code="US" value={us} detail={usDetail} />
    </div>
  );
}

function MetricCard({
  label,
  icon: Icon,
  tone,
  uk,
  us,
  className,
}: {
  label: string;
  icon: typeof DollarSign;
  tone: keyof typeof TONE_CHIP;
  uk: ReactNode;
  us: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fadeUp} className={cn("data-card data-card-hover flex h-full flex-col p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
        <span className={cn("stat-icon-chip h-9 w-9 rounded-[0.7rem]", TONE_CHIP[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <RegionPair uk={uk} us={us} />
    </motion.div>
  );
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

function stripeLabel(connection: StripeRegionConnection) {
  if (connection.accountConfigured && connection.webhookConfigured) {
    return { state: "connected", text: `${connection.label} Stripe connected` };
  }
  if (connection.accountConfigured || connection.webhookConfigured) {
    return { state: "partial", text: `${connection.label} Stripe incomplete` };
  }
  return { state: "off", text: `${connection.label} Stripe not connected` };
}

export function SubscriptionsBoard({ connections }: { connections: StripeRegionConnection[] }) {
  const { registry, metrics } = useAdminSession();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [marketFilter, setMarketFilter] = useState<Market | "all">("all");
  const [card, setCard] = useState<CardFilter | null>(null);

  function selectCard(next: CardFilter) {
    const turningOff = sameFilter(card, next);
    setCard(turningOff ? null : next);
    setMarketFilter("all");
    setStatus(
      turningOff || (next.type !== "past_due" && next.type !== "active") ? "all" : next.type,
    );
  }

  const rows = useMemo(() => {
    return registry.tenants
      .filter((tenant) => {
        if (card) return matchesCard(tenant, card);
        if (marketFilter !== "all" && tenant.market !== marketFilter) return false;
        return status === "all" || tenant.subscription.status === status;
      })
      .sort((a, b) => b.subscription.mrr - a.subscription.mrr);
  }, [registry.tenants, status, card, marketFilter]);

  const filtered = Boolean(card) || status !== "all" || marketFilter !== "all";
  const uk = metrics.byMarket.uk;
  const us = metrics.byMarket.us;
  const plans = (Object.keys(PLANS) as PlanId[]).map((plan) => {
    const listed = (market: Market) =>
      registry.tenants.filter((tenant) => tenant.market === market && tenant.subscription.plan === plan);
    const ukOrgs = listed("uk");
    const usOrgs = listed("us");
    return {
      plan,
      ukCount: ukOrgs.length,
      usCount: usOrgs.length,
      ukMrr: ukOrgs.reduce((sum, tenant) => sum + tenant.subscription.mrr, 0),
      usMrr: usOrgs.reduce((sum, tenant) => sum + tenant.subscription.mrr, 0),
    };
  });
  const totalTenants = Math.max(registry.tenants.length, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 px-1">
        {connections.map((connection) => {
          const stripe = stripeLabel(connection);
          return (
            <span
              key={connection.market}
              className={cn(
                "stripe-region-pill inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                stripe.state === "connected"
                  ? "border-transparent bg-[var(--success-soft)] text-[var(--success)]"
                  : stripe.state === "partial"
                    ? "border-transparent bg-[var(--warning-soft)] text-[var(--warning)]"
                    : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]",
              )}
              data-stripe-region={connection.market}
              data-stripe-state={stripe.state}
            >
              {stripe.text}
            </span>
          );
        })}
      </div>

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
          <MetricCard
            label="MRR"
            uk={formatMoney(uk.mrr, "uk")}
            us={formatMoney(us.mrr, "us")}
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
          <MetricCard
            label="ARR"
            uk={formatMoney(uk.arr, "uk")}
            us={formatMoney(us.arr, "us")}
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
          <MetricCard
            label="Past due"
            uk={uk.pastDueCount}
            us={us.pastDueCount}
            icon={AlertTriangle}
            tone={uk.pastDueCount + us.pastDueCount > 0 ? "danger" : "neutral"}
            className={cardClass(card?.type === "past_due")}
          />
        </FilterCard>
        <FilterCard
          label="Show active subscriptions"
          pressed={card?.type === "active"}
          onClick={() => selectCard({ type: "active" })}
        >
          <MetricCard
            label="Active subs"
            uk={uk.activeCount}
            us={us.activeCount}
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
        {plans.map((row) => {
          const selected = card?.type === "plan" && card.plan === row.plan;
          const count = row.ukCount + row.usCount;
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
                <p className="font-semibold">{PLANS[row.plan].name}</p>
                <RegionPair
                  uk={formatMoney(row.ukMrr, "uk")}
                  us={formatMoney(row.usMrr, "us")}
                  ukDetail={`${row.ukCount} ${row.ukCount === 1 ? "org" : "orgs"}`}
                  usDetail={`${row.usCount} ${row.usCount === 1 ? "org" : "orgs"}`}
                />
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent-gradient)] transition-all duration-700"
                    style={{ width: `${(count / totalTenants) * 100}%` }}
                  />
                </div>
              </button>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--muted)]">
          {filtered
            ? `${rows.length} of ${registry.tenants.length} subscriptions`
            : `${rows.length} subscription${rows.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Select
            value={marketFilter}
            onValueChange={(value) => {
              setCard(null);
              setMarketFilter(value as Market | "all");
            }}
          >
            <SelectTrigger className="w-40" aria-label="Subscription region">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">UK and US</SelectItem>
              <SelectItem value="uk">UK · GBP</SelectItem>
              <SelectItem value="us">US · USD</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setCard(null);
              setStatus(value as (typeof STATUSES)[number]);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "all" ? "All subscription statuses" : item.replace("_", " ").replace(/^\w/, (letter) => letter.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableShell>
        <Table className="table-filterable">
          <THead>
            <TR>
              <TH>Tenant</TH>
              <TH>Region</TH>
              <TH>Plan</TH>
              <TH>Status</TH>
              <TH>MRR</TH>
              <TH>Period end</TH>
              <TH>Last payment</TH>
              <TH>Stripe</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((tenant) => {
              const currency = tenant.market === "uk" ? "GBP" : "USD";
              const region = tenant.market === "uk" ? "UK" : "US";
              return (
                <TR key={tenant.id}>
                  <TD>
                    <Link href={`/admin/organizations/${tenant.id}`} className="font-medium hover:underline">
                      {tenant.name}
                    </Link>
                  </TD>
                  <TD>
                    <Badge tone={tenant.market === "us" ? "accent" : "neutral"}>
                      {region} · {currency}
                    </Badge>
                  </TD>
                  <TD>{PLANS[tenant.subscription.plan].name}</TD>
                  <TD>
                    <Badge
                      tone={
                        tenant.subscription.status === "active"
                          ? "success"
                          : tenant.subscription.status === "past_due" || tenant.subscription.status === "unpaid"
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
                  <TD className="font-medium">{formatMoney(tenant.subscription.mrr, tenant.market)}</TD>
                  <TD className="text-xs">
                    {tenant.subscription.currentPeriodEnd
                      ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString()
                      : "—"}
                  </TD>
                  <TD className="capitalize">{tenant.subscription.lastPaymentStatus}</TD>
                  <TD className="text-xs text-[var(--muted)]">
                    {region} Stripe
                    <span className="mt-0.5 block">
                      {tenant.subscription.stripeCustomerId ? "linked" : "not linked"}
                    </span>
                  </TD>
                </TR>
              );
            })}
            {rows.length === 0 ? (
              <EmptyRow colSpan={8}>
                {marketFilter === "us"
                  ? "No USD subscriptions in this view."
                  : "No subscriptions match this filter."}
              </EmptyRow>
            ) : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
