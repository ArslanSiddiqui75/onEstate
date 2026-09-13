"use client";

import { useMemo } from "react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Users, Building2, FileText, ListChecks } from "lucide-react";

function counts(items: Array<Record<string, unknown>>, key: string) {
  const map = new Map<string, number>();
  for (const item of items) {
    const value = String(item[key] || "—");
    map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export default function AppReportsPage() {
  const { user, org, leads, listings, deals, tasks, callLogs, messages } =
    useAppSession();

  const summary = useMemo(() => {
    const openTasks = tasks.filter((t) => t.status === "open").length;
    const sms = messages.filter((m) => m.channel !== "email").length;
    return { openTasks, sms };
  }, [tasks, messages]);

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

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--muted)]">
        Live workspace snapshot — not a historical warehouse.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Leads" value={leads.length} icon={Users} />
        <StatCard label="Listings" value={listings.length} icon={Building2} />
        <StatCard label="Deals" value={deals.length} icon={FileText} />
        <StatCard label="Open tasks" value={summary.openTasks} icon={ListChecks} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <CardHeader title="Leads by stage" />
          <ul className="mt-3 space-y-1 text-sm">
            {counts(leads as unknown as Array<Record<string, unknown>>, "stage").map(([stage, n]) => (
              <li key={stage} className="flex justify-between">
                <span className="capitalize">{stage}</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <CardHeader title="Listings by status" />
          <ul className="mt-3 space-y-1 text-sm">
            {counts(listings as unknown as Array<Record<string, unknown>>, "status").map(([status, n]) => (
              <li key={status} className="flex justify-between">
                <span className="capitalize">{status.replace("_", " ")}</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <CardHeader title="Deals by stage" />
          <ul className="mt-3 space-y-1 text-sm">
            {counts(deals as unknown as Array<Record<string, unknown>>, "stage").map(([stage, n]) => (
              <li key={stage} className="flex justify-between">
                <span>{stage}</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <CardHeader title="Activity" />
          <ul className="mt-3 space-y-1 text-sm">
            <li className="flex justify-between">
              <span>Calls logged</span>
              <span>{callLogs.length}</span>
            </li>
            <li className="flex justify-between">
              <span>SMS messages</span>
              <span>{summary.sms}</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
