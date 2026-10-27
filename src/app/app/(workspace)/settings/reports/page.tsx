"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { loadAgencyBook } from "@/lib/agency/store";
import type { AgencyBook } from "@/lib/agency/types";
import { loadBook } from "@/lib/lettings/store";
import type { LettingsBook } from "@/lib/lettings/types";
import {
  buildWorkspaceReport,
  reportToCsv,
  type ReportGroup,
  type ReportRecord,
  type WorkspaceReport,
} from "@/lib/reports/detail";
import { SNAPSHOT_RANGES, type SnapshotRange } from "@/lib/reports/snapshot";
import { LockedModule } from "@/components/ui/locked-module";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";

const PREVIEW = 40;

function Records({ records, empty }: { records: ReportRecord[]; empty: string }) {
  if (!records.length) {
    return <p className="mt-2 text-sm text-[var(--muted)]">{empty}</p>;
  }
  const shown = records.slice(0, PREVIEW);
  return (
    <ul className="mt-1 divide-y divide-[var(--border)]">
      {shown.map((record, index) => (
        <li key={`${record.title}-${index}`} className="py-3">
          <p className="font-medium leading-snug">{record.title}</p>
          {record.detail ? (
            <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">{record.detail}</p>
          ) : null}
          {record.note ? (
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{record.note}</p>
          ) : null}
        </li>
      ))}
      {records.length > PREVIEW ? (
        <li className="py-3 text-sm text-[var(--muted)]">
          {records.length - PREVIEW} more are in the CSV export.
        </li>
      ) : null}
    </ul>
  );
}

function GroupBlock({ bundle }: { bundle: ReportGroup }) {
  return (
    <div className="mt-4">
      {bundle.title ? <h3 className="text-sm font-semibold">{bundle.title}</h3> : null}
      <Records records={bundle.records} empty={bundle.empty} />
    </div>
  );
}

function ReportView({ report }: { report: WorkspaceReport }) {
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {report.overview.map((item) => (
          <li key={item.label} className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {item.label}
            </p>
            <p className="mt-1 font-display text-2xl leading-none tracking-tight">{item.value}</p>
            <p className="mt-1.5 text-xs text-[var(--muted)]">{item.hint}</p>
          </li>
        ))}
      </ul>
      {report.sections.map((block) => (
        <Card key={block.id} className="p-4 sm:p-5" data-report-section={block.id}>
          <CardHeader title={block.title} description={block.summary} />
          {block.facts.length ? (
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              {block.facts.map((fact) => (
                <div key={`${block.id}-${fact.label}`}>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {fact.label}
                  </dt>
                  <dd className="text-sm font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {block.groups.map((bundle) => {
            const alreadySaid =
              !bundle.title && !bundle.records.length && block.summary.trim() === bundle.empty.trim();
            if (alreadySaid) return null;
            return <GroupBlock key={bundle.title || block.id} bundle={bundle} />;
          })}
        </Card>
      ))}
    </div>
  );
}

export default function AppReportsPage() {
  const session = useAppSession();
  const {
    user,
    org,
    market,
    members,
    leads,
    contacts,
    listings,
    deals,
    messages,
    callLogs,
    sequences,
    automations,
    enrollments,
    tasks,
    website,
    socialAccounts,
    socialPosts,
    listPortalConnections,
  } = session;
  const [range, setRange] = useState<SnapshotRange>("all");
  const [agency, setAgency] = useState<AgencyBook | null>(null);
  const [lettings, setLettings] = useState<LettingsBook | null>(null);

  useEffect(() => {
    if (!org) return;
    setAgency(loadAgencyBook(org.id));
    setLettings(market === "uk" ? loadBook(org.id) : null);
  }, [org, market]);

  const report = useMemo(() => {
    if (!org) return null;
    return buildWorkspaceReport({
      range,
      market,
      orgName: org.name,
      members,
      leads,
      contacts,
      listings,
      deals,
      messages,
      callLogs,
      sequences,
      automations,
      enrollments,
      tasks,
      website,
      socialAccounts,
      socialPosts,
      portals: listPortalConnections(),
      agency,
      lettings: market === "uk" ? lettings : null,
    });
  }, [
    range,
    market,
    org,
    members,
    leads,
    contacts,
    listings,
    deals,
    messages,
    callLogs,
    sequences,
    automations,
    enrollments,
    tasks,
    website,
    socialAccounts,
    socialPosts,
    listPortalConnections,
    agency,
    lettings,
  ]);

  if (!user || !org || !report) return null;
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
    const blob = new Blob([reportToCsv(report!)], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `reports_${range}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    toast.success("Report exported");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-sm font-medium">{report.headline}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Dated records follow the range. Team, website, sequences, automations, and portal
            feeds stay visible on every range.
          </p>
        </div>
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
      <ReportView report={report} />
    </div>
  );
}
