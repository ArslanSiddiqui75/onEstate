"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR, TableShell, EmptyRow } from "@/components/ui/table";
import { formatMoney, cn } from "@/lib/utils";
import { PLANS } from "@/lib/plans/catalog";
import type { TenantLifecycleStatus, TenantRecord } from "@/lib/admin/types";
import type { Market, PlanId } from "@/types";

const STATUSES: Array<TenantLifecycleStatus | "all"> = [
  "all",
  "active",
  "trialing",
  "past_due",
  "suspended",
  "canceled",
  "churned",
];

type MarketFilter = "all" | Market;
type PlanFilter = "all" | PlanId;
type MrrFilter = "all" | "none" | "under_100" | "100_199" | "200_plus";
type SeatsFilter = "all" | "one" | "two_five" | "six_plus";
type HealthFilter = "all" | "healthy" | "watch" | "risk";
type ActiveFilter = "all" | "today" | "7d" | "30d" | "older";
type ActionFilter = "all" | "suspend" | "activate";

function sentenceCase(value: string) {
  const label = value.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function HeaderFilter<T extends string>({
  label,
  value,
  onChange,
  options,
  align,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  align?: "right";
}) {
  const active = value !== "all";
  return (
    <div className={cn("flex flex-col", align === "right" && "items-end")}>
      <span>{label}</span>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger
          aria-label={`Filter ${label}`}
          data-active={active ? "true" : undefined}
          className={cn(
            "header-col-filter mt-1.5 h-8 w-fit max-w-[9.5rem] gap-1 rounded-lg px-2 py-0 text-xs font-medium shadow-none [&_svg]:h-3.5 [&_svg]:w-3.5",
            active ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--foreground)]",
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          align={align === "right" ? "end" : "start"}
          data-header-filter-menu=""
          className="w-max min-w-[var(--radix-select-trigger-width)]"
        >
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function sameCalendarDay(iso: string, now: Date) {
  const date = new Date(iso);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function matchesFilters(
  tenant: TenantRecord,
  filters: {
    query: string;
    market: MarketFilter;
    plan: PlanFilter;
    status: (typeof STATUSES)[number];
    mrr: MrrFilter;
    seats: SeatsFilter;
    health: HealthFilter;
    active: ActiveFilter;
    action: ActionFilter;
    now: Date;
  },
) {
  const q = filters.query.trim().toLowerCase();
  if (q) {
    const haystack = [tenant.name, tenant.ownerEmail, tenant.billingEmail, tenant.id]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (filters.market !== "all" && tenant.market !== filters.market) return false;
  if (filters.plan !== "all" && tenant.subscription.plan !== filters.plan) return false;
  if (filters.status !== "all" && tenant.lifecycleStatus !== filters.status) return false;

  const mrr = tenant.subscription.mrr || 0;
  if (filters.mrr === "none" && mrr !== 0) return false;
  if (filters.mrr === "under_100" && !(mrr > 0 && mrr < 100)) return false;
  if (filters.mrr === "100_199" && !(mrr >= 100 && mrr < 200)) return false;
  if (filters.mrr === "200_plus" && mrr < 200) return false;

  const seats = tenant.subscription.seatsUsed;
  if (filters.seats === "one" && seats !== 1) return false;
  if (filters.seats === "two_five" && (seats < 2 || seats > 5)) return false;
  if (filters.seats === "six_plus" && seats < 6) return false;

  if (filters.health === "healthy" && tenant.healthScore < 70) return false;
  if (filters.health === "watch" && (tenant.healthScore < 40 || tenant.healthScore >= 70)) return false;
  if (filters.health === "risk" && tenant.healthScore >= 40) return false;

  const ageDays = (filters.now.getTime() - new Date(tenant.lastActiveAt).getTime()) / 86_400_000;
  if (filters.active === "today" && !sameCalendarDay(tenant.lastActiveAt, filters.now)) return false;
  if (filters.active === "7d" && ageDays > 7) return false;
  if (filters.active === "30d" && ageDays > 30) return false;
  if (filters.active === "older" && ageDays <= 30) return false;

  const canActivate = tenant.lifecycleStatus === "suspended";
  if (filters.action === "activate" && !canActivate) return false;
  if (filters.action === "suspend" && canActivate) return false;

  return true;
}

export default function AdminOrganizationsPage() {
  const { registry } = useAdminSession();
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState<MarketFilter>("all");
  const [plan, setPlan] = useState<PlanFilter>("all");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [mrr, setMrr] = useState<MrrFilter>("all");
  const [seats, setSeats] = useState<SeatsFilter>("all");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [active, setActive] = useState<ActiveFilter>("all");
  const [action, setAction] = useState<ActionFilter>("all");

  const filtersActive =
    query.trim() !== "" ||
    market !== "all" ||
    plan !== "all" ||
    status !== "all" ||
    mrr !== "all" ||
    seats !== "all" ||
    health !== "all" ||
    active !== "all" ||
    action !== "all";

  const rows = useMemo(() => {
    const now = new Date();
    return registry.tenants
      .filter((tenant) =>
        matchesFilters(tenant, {
          query,
          market,
          plan,
          status,
          mrr,
          seats,
          health,
          active,
          action,
          now,
        }),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [registry.tenants, query, market, plan, status, mrr, seats, health, active, action]);

  function clearFilters() {
    setQuery("");
    setMarket("all");
    setPlan("all");
    setStatus("all");
    setMrr("all");
    setSeats("all");
    setHealth("all");
    setActive("all");
    setAction("all");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            className="pl-9"
            placeholder="Search name, email, org id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search organizations"
          />
        </div>
        <p className="text-sm text-[var(--muted)]">
          {rows.length === registry.tenants.length
            ? `${rows.length} organizations`
            : `${rows.length} of ${registry.tenants.length} organizations`}
        </p>
        {filtersActive ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <TableShell>
        <Table className="table-filterable">
          <THead>
            <TR>
              <TH>
                <HeaderFilter
                  label="Organization"
                  value={market}
                  onChange={setMarket}
                  options={[
                    { value: "all", label: "All markets" },
                    { value: "uk", label: "UK" },
                    { value: "us", label: "US" },
                  ]}
                />
              </TH>
              <TH>
                <HeaderFilter
                  label="Plan"
                  value={plan}
                  onChange={setPlan}
                  options={[
                    { value: "all", label: "All plans" },
                    { value: "solo", label: "Solo" },
                    { value: "team", label: "Team" },
                    { value: "enterprise", label: "Enterprise" },
                  ]}
                />
              </TH>
              <TH>
                <HeaderFilter
                  label="Status"
                  value={status}
                  onChange={setStatus}
                  options={STATUSES.map((value) => ({
                    value,
                    label: value === "all" ? "All statuses" : sentenceCase(value),
                  }))}
                />
              </TH>
              <TH>
                <HeaderFilter
                  label="MRR"
                  value={mrr}
                  onChange={setMrr}
                  options={[
                    { value: "all", label: "Any" },
                    { value: "none", label: "None" },
                    { value: "under_100", label: "Under 100" },
                    { value: "100_199", label: "100–199" },
                    { value: "200_plus", label: "200+" },
                  ]}
                />
              </TH>
              <TH>
                <HeaderFilter
                  label="Seats"
                  value={seats}
                  onChange={setSeats}
                  options={[
                    { value: "all", label: "Any" },
                    { value: "one", label: "1" },
                    { value: "two_five", label: "2–5" },
                    { value: "six_plus", label: "6+" },
                  ]}
                />
              </TH>
              <TH>
                <HeaderFilter
                  label="Health"
                  value={health}
                  onChange={setHealth}
                  options={[
                    { value: "all", label: "Any" },
                    { value: "healthy", label: "70+" },
                    { value: "watch", label: "40–69" },
                    { value: "risk", label: "Under 40" },
                  ]}
                />
              </TH>
              <TH>
                <HeaderFilter
                  label="Last active"
                  value={active}
                  onChange={setActive}
                  options={[
                    { value: "all", label: "Any" },
                    { value: "today", label: "Today" },
                    { value: "7d", label: "7 days" },
                    { value: "30d", label: "30 days" },
                    { value: "older", label: "Older" },
                  ]}
                />
              </TH>
              <TH>
                <HeaderFilter
                  label="Actions"
                  value={action}
                  onChange={setAction}
                  align="right"
                  options={[
                    { value: "all", label: "All" },
                    { value: "suspend", label: "Suspend" },
                    { value: "activate", label: "Activate" },
                  ]}
                />
              </TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((tenant) => {
              const seatPct =
                tenant.subscription.seatsIncluded === 999
                  ? 12
                  : (tenant.subscription.seatsUsed / Math.max(tenant.subscription.seatsIncluded, 1)) * 100;
              return (
                <TR key={tenant.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={tenant.name} size="sm" />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/organizations/${tenant.id}`}
                          className="font-medium hover:underline"
                        >
                          {tenant.name}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">
                          {tenant.ownerEmail} · {tenant.market.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD>{PLANS[tenant.subscription.plan].name}</TD>
                  <TD>
                    <Badge
                      tone={
                        tenant.lifecycleStatus === "active"
                          ? "success"
                          : tenant.lifecycleStatus === "past_due"
                            ? "danger"
                            : tenant.lifecycleStatus === "suspended"
                              ? "warning"
                              : "neutral"
                      }
                      className="capitalize"
                    >
                      {tenant.lifecycleStatus.replace("_", " ")}
                    </Badge>
                  </TD>
                  <TD className="font-medium">
                    {formatMoney(tenant.subscription.mrr, tenant.market)}
                  </TD>
                  <TD>
                    <div className="w-24">
                      <p className="text-xs font-medium">
                        {tenant.subscription.seatsUsed}/
                        {tenant.subscription.seatsIncluded === 999
                          ? "∞"
                          : tenant.subscription.seatsIncluded}
                      </p>
                      <Progress value={seatPct} className="mt-1.5" />
                    </div>
                  </TD>
                  <TD>
                    <span
                      className={
                        tenant.healthScore >= 70
                          ? "font-semibold text-[var(--success)]"
                          : tenant.healthScore >= 40
                            ? "font-semibold text-[var(--warning)]"
                            : "font-semibold text-[var(--danger)]"
                      }
                    >
                      {tenant.healthScore}
                    </span>
                  </TD>
                  <TD className="text-xs text-[var(--muted)]">
                    {new Date(tenant.lastActiveAt).toLocaleString()}
                  </TD>
                  <TD className="text-right">
                    <Button
                      size="sm"
                      variant={tenant.lifecycleStatus === "suspended" ? "default" : "secondary"}
                      onClick={() => {
                        const nextStatus = tenant.lifecycleStatus === "suspended" ? "active" : "suspended";
                        tenant.lifecycleStatus = nextStatus;
                        toast.info(`Organization "${tenant.name}" set to ${nextStatus}`);
                      }}
                      className="text-xs"
                    >
                      {tenant.lifecycleStatus === "suspended" ? "Activate" : "Suspend"}
                    </Button>
                  </TD>
                </TR>
              );
            })}
            {rows.length === 0 ? (
              <EmptyRow colSpan={8}>
                No organizations match these filters.
              </EmptyRow>
            ) : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
