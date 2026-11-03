"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MenuSelect } from "@/components/ui/select";
import {
  filterSmsItems,
  formatCompactCount,
  formatPktStampWithZone,
  smsStatsFromRecord,
} from "@/lib/crm/bulk-action-format";
import type { BulkActionRecord, BulkSmsItemStatus } from "@/lib/crm/bulk-action-log";
import { downloadCsv, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { CloudDownload, X } from "lucide-react";

type SmsTab = "all" | BulkSmsItemStatus;

const TABS: { id: SmsTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "sent", label: "Sent" },
  { id: "delivered", label: "Delivered" },
  { id: "error", label: "Error" },
  { id: "skipped", label: "Skipped" },
];

const STATUS_TONE: Record<BulkSmsItemStatus, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  pending: "accent",
  sent: "success",
  delivered: "success",
  error: "danger",
  skipped: "warning",
};

function StatCard({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct?: string;
  tone?: "neutral" | "accent" | "success" | "danger" | "warning";
}) {
  const bar =
    tone === "accent"
      ? "bg-[var(--accent)]"
      : tone === "success"
        ? "bg-[var(--success)]"
        : tone === "danger"
          ? "bg-[var(--danger)]"
          : tone === "warning"
            ? "bg-[var(--warning)]"
            : "bg-[var(--border)]";
  const pctColor =
    tone === "accent"
      ? "text-[var(--accent)]"
      : tone === "success"
        ? "text-[var(--success)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : tone === "warning"
            ? "text-[var(--warning)]"
            : "text-[var(--muted)]";
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        {pct ? <p className={cn("text-xs font-semibold tabular-nums", pctColor)}>{pct}</p> : null}
      </div>
      {pct ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <div
            className={cn("h-full rounded-full", bar)}
            style={{ width: `${Math.min(100, Number.parseFloat(pct) || 0)}%` }}
          />
        </div>
      ) : (
        <div className="mt-2 h-1 rounded-full bg-[var(--surface-muted)]" />
      )}
    </div>
  );
}

export function BulkSmsStatsModal({
  row,
  onClose,
}: {
  row: BulkActionRecord;
  onClose: () => void;
}) {
  const stats = useMemo(() => smsStatsFromRecord(row), [row]);
  const [tab, setTab] = useState<SmsTab>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filtered = useMemo(() => filterSmsItems(stats.items, tab), [stats.items, tab]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const from = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const to = Math.min(safePage * pageSize, filtered.length);

  function download() {
    downloadCsv(
      "bulk-sms-stats.csv",
      toCsv([
        ["Identifier", "Phone", "Status", "Date added"],
        ...filtered.map((item) => [
          item.identifier,
          item.phone || "",
          item.status,
          formatPktStampWithZone(item.at),
        ]),
      ]),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-solid)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Bulk SMS stats</h2>
            <p className="text-xs text-[var(--muted)]">{row.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
            aria-label="Close bulk SMS stats"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="All" value={formatCompactCount(stats.all)} />
            <StatCard
              label="Pending"
              value={formatCompactCount(stats.pending)}
              pct={`${stats.pendingPct}%`}
              tone="accent"
            />
            <StatCard
              label="Sent"
              value={formatCompactCount(stats.sent)}
              pct={`${stats.sentPct}%`}
              tone="success"
            />
            <StatCard
              label="Delivered"
              value={formatCompactCount(stats.delivered)}
              pct={`${stats.deliveredPct}%`}
              tone="success"
            />
            <StatCard
              label="Error"
              value={formatCompactCount(stats.error)}
              pct={`${stats.errorPct}%`}
              tone="danger"
            />
            <StatCard
              label="Skipped"
              value={formatCompactCount(stats.skipped)}
              pct={`${stats.skippedPct}%`}
              tone="warning"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => {
                  setTab(item.id);
                  setPage(1);
                }}
                className={cn(
                  "relative shrink-0 px-3 py-2 text-sm font-medium",
                  tab === item.id
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute inset-x-2 bottom-0 h-0.5 rounded-full",
                    tab === item.id ? "bg-[var(--accent)]" : "bg-transparent",
                  )}
                />
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Identifier</th>
                  <th className="px-3 py-2.5 font-semibold">Phone</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Date added</th>
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-[var(--muted)]">
                      No rows in this view.
                    </td>
                  </tr>
                ) : (
                  slice.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2.5 font-medium">{item.identifier}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{item.phone || "—"}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={STATUS_TONE[item.status]}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">
                        {formatPktStampWithZone(item.at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" onClick={download} disabled={!filtered.length}>
            <CloudDownload className="h-4 w-4" />
            Download
          </Button>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
            <label className="flex items-center gap-2">
              Rows per page
              <MenuSelect
                aria-label="Rows per page"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) || 20);
                  setPage(1);
                }}
                className="h-9 w-[4.5rem]"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </MenuSelect>
            </label>
            <span className="tabular-nums">
              {from} - {to} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="px-2 tabular-nums">
                Page {safePage} of {pageCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
