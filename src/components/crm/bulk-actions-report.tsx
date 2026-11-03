"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MenuSelect } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BulkImportStatsModal } from "@/components/crm/bulk-import-stats-modal";
import { BulkSmsStatsModal } from "@/components/crm/bulk-sms-stats-modal";
import { dayBoundsPkt, formatPktStamp } from "@/lib/crm/bulk-action-format";
import {
  BULK_ACTION_LABELS,
  BULK_STATUS_LABELS,
  type BulkActionRecord,
  type BulkActionStatus,
  type BulkActionType,
} from "@/lib/crm/bulk-action-log";
import { BarChart3, MoreVertical, Trash2 } from "lucide-react";

const PAGE_SIZE = 20;

const STATUS_TONE: Record<BulkActionStatus, "success" | "warning" | "danger" | "accent"> = {
  complete: "success",
  partial: "warning",
  failed: "danger",
  running: "accent",
};

function hasStats(row: BulkActionRecord) {
  return row.type === "sms" || row.type === "import";
}

export function BulkActionsReport({
  rows,
  onDelete,
  onClear,
}: {
  rows: BulkActionRecord[];
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | BulkActionStatus>("all");
  const [actionFilter, setActionFilter] = useState<"all" | BulkActionType>("all");
  const [userFilter, setUserFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [statsRow, setStatsRow] = useState<BulkActionRecord | null>(null);

  const users = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      const id = row.userId || "unknown";
      map.set(id, row.userName || "Unknown user");
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const at = Date.parse(row.at);
      if (fromDate) {
        const bounds = dayBoundsPkt(fromDate);
        if (bounds && at < bounds.start) return false;
      }
      if (toDate) {
        const bounds = dayBoundsPkt(toDate);
        if (bounds && at > bounds.end) return false;
      }
      const status = row.status || "complete";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (actionFilter !== "all" && row.type !== actionFilter) return false;
      if (userFilter !== "all" && (row.userId || "unknown") !== userFilter) return false;
      return true;
    });
  }, [actionFilter, fromDate, rows, statusFilter, toDate, userFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold">Bulk actions report</p>
          <p className="text-xs text-[var(--muted)]">
            Imports, SMS, and other bulk runs on this seat. Open statistics for SMS and import
            detail.
          </p>
        </div>
        {rows.length ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear log
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-[var(--muted)]">
          From
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            aria-label="From date"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-[var(--muted)]">
          To
          <Input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            aria-label="To date"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-[var(--muted)]">
          Status
          <MenuSelect
            aria-label="Status filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as "all" | BulkActionStatus);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="complete">Complete</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
          </MenuSelect>
        </label>
        <label className="space-y-1 text-xs font-medium text-[var(--muted)]">
          Action
          <MenuSelect
            aria-label="Action filter"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value as "all" | BulkActionType);
              setPage(1);
            }}
          >
            <option value="all">All actions</option>
            {Object.entries(BULK_ACTION_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </MenuSelect>
        </label>
        <label className="space-y-1 text-xs font-medium text-[var(--muted)] sm:col-span-2 lg:col-span-4">
          User
          <MenuSelect
            aria-label="User filter"
            value={userFilter}
            onChange={(e) => {
              setUserFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </MenuSelect>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">
          {rows.length === 0 ? "No bulk actions yet." : "No bulk actions match these filters."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-[56rem] w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Action label</th>
                  <th className="px-3 py-2.5 font-semibold">Operation</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">User</th>
                  <th className="px-3 py-2.5 font-semibold">Created (PKT)</th>
                  <th className="px-3 py-2.5 font-semibold">Completed (PKT)</th>
                  <th className="px-3 py-2.5 font-semibold">Statistics</th>
                  <th className="px-3 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((row) => {
                  const status = row.status || "complete";
                  return (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="max-w-[16rem] truncate px-3 py-2.5 font-medium" title={row.label}>
                        {row.label}
                      </td>
                      <td className="px-3 py-2.5">{BULK_ACTION_LABELS[row.type]}</td>
                      <td className="px-3 py-2.5">
                        <Badge tone={STATUS_TONE[status]}>{BULK_STATUS_LABELS[status]}</Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <Avatar name={row.userName || "User"} className="h-7 w-7 text-[10px]" />
                          <span className="truncate">{row.userName || "Unknown"}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[var(--muted)]">
                        {formatPktStamp(row.at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[var(--muted)]">
                        {formatPktStamp(row.completedAt || row.at)}
                      </td>
                      <td className="px-3 py-2.5">
                        {hasStats(row) ? (
                          <button
                            type="button"
                            aria-label={`View statistics for ${row.label}`}
                            onClick={() => setStatsRow(row)}
                            className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${row.label}`}
                              className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {hasStats(row) ? (
                              <DropdownMenuItem onSelect={() => setStatsRow(row)}>
                                View statistics
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              destructive
                              onSelect={() => onDelete(row.id)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
            <p>Page {safePage}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
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
        </>
      )}

      {statsRow?.type === "sms" ? (
        <BulkSmsStatsModal row={statsRow} onClose={() => setStatsRow(null)} />
      ) : null}
      {statsRow?.type === "import" ? (
        <BulkImportStatsModal row={statsRow} onClose={() => setStatsRow(null)} />
      ) : null}
    </div>
  );
}
