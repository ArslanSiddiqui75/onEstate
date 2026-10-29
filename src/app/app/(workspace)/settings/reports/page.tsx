"use client";

import { MenuSelect } from "@/components/ui/select";

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
  type WorkspaceReport,
} from "@/lib/reports/detail";
import { SNAPSHOT_RANGES, type SnapshotRange } from "@/lib/reports/snapshot";
import { LockedModule } from "@/components/ui/locked-module";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";

const PAGE_SIZE = 8;

function recordCount(groups: ReportGroup[]) {
  return groups.reduce((sum, group) => sum + group.records.length, 0);
}

function sectionIdForOverview(label: string, sections: WorkspaceReport["sections"]) {
  if (label === "Open tasks") return "tasks";
  if (label === "Open repairs") return "lettings";
  const match = sections.find(
    (section) => section.title === label || section.id === label.toLowerCase(),
  );
  return match?.id ?? null;
}

function ReportView({ report }: { report: WorkspaceReport }) {
  const [sectionId, setSectionId] = useState(report.sections[0]?.id ?? "");
  const [groupTitle, setGroupTitle] = useState("");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const section = report.sections.find((item) => item.id === sectionId) ?? report.sections[0];

  if (!section) return null;

  const namedGroups = section.groups.filter((group) => group.title);
  const group =
    section.groups.find((item) => item.title && item.title === groupTitle) ??
    section.groups.find((item) => item.records.length) ??
    section.groups[0];
  const needle = query.trim().toLowerCase();
  const records = (group?.records ?? []).filter((record) => {
    if (!needle) return true;
    return `${record.title} ${record.detail} ${record.note || ""}`.toLowerCase().includes(needle);
  });
  const shown = showAll ? records : records.slice(0, PAGE_SIZE);

  function openSection(id: string) {
    setSectionId(id);
    setGroupTitle("");
    setQuery("");
    setShowAll(false);
  }

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {report.overview.map((item) => {
          const target = sectionIdForOverview(item.label, report.sections);
          const active = target === section.id;
          return (
            <li key={item.label}>
              <button
                type="button"
                disabled={!target}
                onClick={() => target && openSection(target)}
                className={cn(
                  "h-full w-full rounded-2xl border px-3 py-3 text-left transition",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)]",
                )}
              >
                <p className="text-[11px] font-medium text-[var(--muted)]">{item.label}</p>
                <p className="mt-1 font-display text-2xl leading-none tracking-tight">{item.value}</p>
                <p className="mt-1.5 line-clamp-1 text-xs text-[var(--muted)]">{item.hint}</p>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-4 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <div>
          <label className="block lg:hidden">
            <span className="sr-only">Report section</span>
            <MenuSelect
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm"
              value={section.id}
              onChange={(event) => openSection(event.target.value)}
            >
              {report.sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({recordCount(item.groups)})
                </option>
              ))}
            </MenuSelect>
          </label>
          <nav className="hidden lg:flex lg:flex-col lg:gap-0.5" aria-label="Report sections">
            {report.sections.map((item) => {
              const count = recordCount(item.groups);
              const active = item.id === section.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openSection(item.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm",
                    active
                      ? "bg-[var(--accent-soft)] font-medium text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  <span className="truncate">{item.title}</span>
                  <span className="shrink-0 text-xs tabular-nums">{count}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <Card className="p-4 sm:p-5" data-report-section={section.id}>
          <div>
            <h2 className="font-semibold tracking-tight">{section.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{section.summary}</p>
          </div>
          {section.facts.length ? (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {section.facts.map((fact) => (
                <li
                  key={`${section.id}-${fact.label}`}
                  className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs"
                >
                  <span className="text-[var(--muted)]">{fact.label}</span>{" "}
                  <span className="font-semibold">{fact.value}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {namedGroups.length > 1 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {namedGroups.map((item) => {
                const active = item.title === group?.title;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => {
                      setGroupTitle(item.title);
                      setQuery("");
                      setShowAll(false);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {item.title}
                    <span className="ml-1 tabular-nums opacity-70">{item.records.length}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {group && group.records.length > PAGE_SIZE ? (
            <label className="mt-4 block">
              <span className="sr-only">Search {section.title}</span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setShowAll(false);
                }}
                placeholder={`Search ${group.title || section.title.toLowerCase()}`}
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              />
            </label>
          ) : null}

          {!group || !group.records.length ? (
            <p className="mt-4 text-sm text-[var(--muted)]">{group?.empty || "Nothing in this section."}</p>
          ) : records.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Nothing matches that search.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {shown.map((record, index) => (
                <li key={`${record.title}-${index}`} className="py-2.5">
                  <div className="grid gap-0.5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] sm:items-baseline sm:gap-4">
                    <p className="truncate font-medium">{record.title}</p>
                    {record.detail ? (
                      <p className="truncate text-sm text-[var(--muted)]">{record.detail}</p>
                    ) : null}
                  </div>
                  {record.note ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-[var(--muted)]">Details</summary>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
                        {record.note}
                      </p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {records.length > shown.length ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-3 text-sm font-medium text-[var(--accent)]"
            >
              Show {records.length - shown.length} more
            </button>
          ) : null}
        </Card>
      </div>
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
    persistence,
    getAuthToken,
  } = session;
  const [range, setRange] = useState<SnapshotRange>("all");
  const [agency, setAgency] = useState<AgencyBook | null>(null);
  const [lettings, setLettings] = useState<LettingsBook | null>(null);

  useEffect(() => {
    if (!org) return;
    let cancel = false;
    void (async () => {
      if (persistence === "supabase") {
        const token = await getAuthToken();
        if (token) {
          const headers = { Authorization: `Bearer ${token}` };
          const [agencyRes, lettingsRes] = await Promise.all([
            fetch("/api/agency/book", { headers, cache: "no-store" }),
            market === "uk"
              ? fetch("/api/lettings/book", { headers, cache: "no-store" })
              : Promise.resolve(null),
          ]);
          if (!cancel && agencyRes.ok) {
            const json = (await agencyRes.json()) as { book?: AgencyBook };
            if (json.book) {
              setAgency(json.book);
            }
          }
          if (!cancel && lettingsRes && lettingsRes.ok) {
            const json = (await lettingsRes.json()) as { book?: LettingsBook };
            if (json.book) setLettings(json.book);
          }
          if (!cancel) return;
        }
      }
      if (cancel) return;
      setAgency(loadAgencyBook(org.id));
      setLettings(market === "uk" ? loadBook(org.id) : null);
    })();
    return () => {
      cancel = true;
    };
  }, [org, market, persistence, getAuthToken]);

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
  if (!hasModuleAccess(user, org.plan, "crm", "view")) {
    return (
      <LockedModule
        title="Reports locked"
        reason="Reports follow CRM access."
        role={user.role}
        moduleAccess={user.moduleAccess}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">{report.headline}</p>
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
