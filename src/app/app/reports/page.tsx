"use client";

import { useMemo, useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  SNAPSHOT_RANGES,
  countBy,
  rowsToCsv,
  snapshotCutoff,
  withinSnapshot,
  type SnapshotRange,
} from "@/lib/reports/snapshot";
import { Users, Building2, FileText, ListChecks, Download } from "lucide-react";

function BarList({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  if (!rows.length) {
    return <p className="mt-3 text-sm text-[var(--muted)]">Nothing in this range.</p>;
  }
  return (
    <ul className="mt-3 space-y-2">
      {rows.map(([label, n]) => (
        <li key={label}>
          <div className="flex justify-between text-sm">
            <span className="capitalize">{label.replace("_", " ")}</span>
            <span>{n}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${(n / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AppReportsPage() {
  const { user, org, leads, listings, deals, tasks, callLogs, messages, market } =
    useAppSession();
  const [range, setRange] = useState<SnapshotRange>("all");

  const snapshot = useMemo(() => {
    const cutoff = snapshotCutoff(range);
    const rangedLeads = leads.filter((l) => l.market === market && withinSnapshot(l.createdAt, cutoff));
    const rangedListings = listings.filter((l) =>
      l.market === market && withinSnapshot(l.createdAt, cutoff),
    );
    const rangedDeals = deals.filter((d) => d.market === market && withinSnapshot(d.updatedAt, cutoff));
    const marketLeadIds = new Set(leads.filter((lead) => lead.market === market).map((lead) => lead.id));
    const openTasks = tasks.filter((task) => task.status === "open" && marketLeadIds.has(task.leadId)).length;
    const rangedCalls = callLogs.filter((c) =>
      withinSnapshot(c.createdAt, cutoff),
    );
    const rangedSms = messages.filter(
      (m) =>
        m.channel !== "email" && withinSnapshot(m.sentAt, cutoff),
    );
    return {
      leads: rangedLeads,
      listings: rangedListings,
      deals: rangedDeals,
      openTasks,
      calls: rangedCalls.length,
      sms: rangedSms.length,
      leadStages: countBy(
        rangedLeads as unknown as Array<Record<string, unknown>>,
        "stage",
      ),
      listingStatuses: countBy(
        rangedListings as unknown as Array<Record<string, unknown>>,
        "status",
      ),
      dealStages: countBy(
        rangedDeals as unknown as Array<Record<string, unknown>>,
        "stage",
      ),
    };
  }, [range, leads, listings, deals, tasks, callLogs, messages, market]);

  if (!user || !org) return null;
  if (!hasModuleAccess(user.role, org.plan, "crm", "view")) {
    return (
      <LockedModule
        title="Reports locked"
        reason="Reports follow CRM access."
        role={user.role}
        plan={org.plan}
      />
    );
  }

  function exportCsv() {
    const rows: string[][] = [
      ["Metric", "Value"],
      ["Range", range],
      ["Leads", String(snapshot.leads.length)],
      ["Listings", String(snapshot.listings.length)],
      ["Deals", String(snapshot.deals.length)],
      ["Open tasks", String(snapshot.openTasks)],
      ["Calls logged", String(snapshot.calls)],
      ["SMS messages", String(snapshot.sms)],
      [],
      ["Leads by stage", "Count"],
      ...snapshot.leadStages.map(([k, n]) => [k, String(n)]),
      [],
      ["Listings by status", "Count"],
      ...snapshot.listingStatuses.map(([k, n]) => [k, String(n)]),
      [],
      ["Deals by stage", "Count"],
      ...snapshot.dealStages.map(([k, n]) => [k, String(n)]),
    ];
    const blob = new Blob([rowsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `reports_snapshot_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    toast.success("Snapshot exported");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          {market === "uk" ? "UK book" : "US book"}. Counts include this region’s
          leads, listings, and deals. The other region keeps its own stats.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-[var(--border)] p-0.5">
            {SNAPSHOT_RANGES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRange(option.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  range === option.id
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export CSV
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Leads" value={snapshot.leads.length} icon={Users} />
        <StatCard
          label="Listings"
          value={snapshot.listings.length}
          icon={Building2}
        />
        <StatCard label="Deals" value={snapshot.deals.length} icon={FileText} />
        <StatCard
          label="Open tasks"
          value={snapshot.openTasks}
          icon={ListChecks}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <CardHeader title="Leads by stage" />
          <BarList rows={snapshot.leadStages} />
        </Card>
        <Card className="p-4">
          <CardHeader title="Listings by status" />
          <BarList rows={snapshot.listingStatuses} />
        </Card>
        <Card className="p-4">
          <CardHeader title="Deals by stage" />
          <BarList rows={snapshot.dealStages} />
        </Card>
        <Card className="p-4">
          <CardHeader title="Activity" />
          <BarList
            rows={[
              ["Calls logged", snapshot.calls],
              ["SMS messages", snapshot.sms],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
