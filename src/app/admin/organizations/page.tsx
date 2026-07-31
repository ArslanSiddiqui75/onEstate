"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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
import type { TenantLifecycleStatus } from "@/lib/admin/types";

const STATUSES: Array<TenantLifecycleStatus | "all"> = [
  "all",
  "active",
  "trialing",
  "past_due",
  "suspended",
  "canceled",
  "churned",
];

export default function AdminOrganizationsPage() {
  const { registry } = useAdminSession();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  const rows = useMemo(() => {
    return registry.tenants
      .filter((t) => status === "all" || t.lifecycleStatus === status)
      .filter((t) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.ownerEmail.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.billingEmail.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [registry.tenants, query, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-sm flex-1 min-w-[14rem]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            className="pl-9"
            placeholder="Search name, email, org id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as (typeof STATUSES)[number])}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TableShell>
        <Table>
          <THead>
            <TR>
              <TH>Organization</TH>
              <TH>Plan</TH>
              <TH>Status</TH>
              <TH>MRR</TH>
              <TH>Seats</TH>
              <TH>Health</TH>
              <TH>Last active</TH>
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
                </TR>
              );
            })}
            {rows.length === 0 ? (
              <EmptyRow colSpan={7}>
                No organizations match. Create a workspace in <code>/app</code> or sign in
                with a seed account to populate the registry.
              </EmptyRow>
            ) : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
