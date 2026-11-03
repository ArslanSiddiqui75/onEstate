"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MenuSelect } from "@/components/ui/select";
import {
  filterImportItems,
  formatCompactCount,
  importStatsFromRecord,
} from "@/lib/crm/bulk-action-format";
import type { BulkActionRecord, BulkImportItemType } from "@/lib/crm/bulk-action-log";
import { downloadCsv, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { CloudDownload, X } from "lucide-react";

type ImportTab = "all" | "success" | "error" | "warning";

const TABS: { id: ImportTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "success", label: "Success" },
  { id: "error", label: "Error" },
  { id: "warning", label: "Warning" },
];

const TYPE_TONE: Record<BulkImportItemType, "neutral" | "success" | "warning" | "danger"> = {
  created: "success",
  updated: "success",
  error: "danger",
  warning: "warning",
};

const TYPE_LABEL: Record<BulkImportItemType, string> = {
  created: "Created",
  updated: "Updated",
  error: "Error",
  warning: "Warning",
};

function pageWindow(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4, 5].forEach((n) => pages.add(n));
  if (current >= total - 2) [total - 4, total - 3, total - 2, total - 1].forEach((n) => pages.add(n));
  return [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
}

export function BulkImportStatsModal({
  row,
  onClose,
}: {
  row: BulkActionRecord;
  onClose: () => void;
}) {
  const stats = useMemo(() => importStatsFromRecord(row), [row]);
  const [tab, setTab] = useState<ImportTab>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filtered = useMemo(() => filterImportItems(stats.items, tab), [stats.items, tab]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pages = pageWindow(safePage, pageCount);

  function download() {
    downloadCsv(
      "bulk-import-stats.csv",
      toCsv([
        ["Line", "Identifier", "Object", "Type", "Detail"],
        ...filtered.map((item) => [
          String(item.line),
          item.identifier,
          item.object,
          TYPE_LABEL[item.type],
          item.detail || "",
        ]),
      ]),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-solid)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Bulk import stats</h2>
            <p className="text-xs text-[var(--muted)]">{row.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
            aria-label="Close bulk import stats"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] px-4 py-3">
              <p className="text-xs font-medium text-[var(--muted)]">All</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatCompactCount(stats.all)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] px-4 py-3">
              <p className="text-xs font-medium text-[var(--muted)]">Success</p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-semibold tabular-nums">
                  {formatCompactCount(stats.success)}
                </p>
                <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--success)]">
                  {stats.successPct} %
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] px-4 py-3">
              <p className="text-xs font-medium text-[var(--muted)]">Error</p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-semibold tabular-nums">
                  {formatCompactCount(stats.error)}
                </p>
                <span className="rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--warning)]">
                  {stats.errorPct} %
                </span>
              </div>
            </div>
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
                  <th className="px-3 py-2.5 font-semibold">Line</th>
                  <th className="px-3 py-2.5 font-semibold">Identifier</th>
                  <th className="px-3 py-2.5 font-semibold">Object</th>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
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
                      <td className="px-3 py-2.5 tabular-nums text-[var(--muted)]">{item.line}</td>
                      <td className="px-3 py-2.5 font-medium">{item.identifier}</td>
                      <td className="px-3 py-2.5">{item.object}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={TYPE_TONE[item.type]}>{TYPE_LABEL[item.type]}</Badge>
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
              {pages.map((n, index) => {
                const prev = pages[index - 1];
                const gap = prev != null && n - prev > 1;
                return (
                  <span key={n} className="contents">
                    {gap ? <span className="px-1">…</span> : null}
                    <button
                      type="button"
                      onClick={() => setPage(n)}
                      className={cn(
                        "min-w-8 rounded-md px-2 py-1 text-sm",
                        n === safePage
                          ? "border border-[var(--accent)] font-semibold text-[var(--accent)]"
                          : "hover:bg-[var(--surface-muted)]",
                      )}
                    >
                      {n}
                    </button>
                  </span>
                );
              })}
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
