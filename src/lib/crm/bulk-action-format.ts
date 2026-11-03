import type {
  BulkActionRecord,
  BulkImportItem,
  BulkSmsItem,
  BulkSmsItemStatus,
} from "@/lib/crm/bulk-action-log";

const PKT = "Asia/Karachi";

/** Table timestamps under Created/Completed (PKT) headers. */
export function formatPktStamp(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: PKT,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Stats modal timestamps that include the zone label. */
export function formatPktStampWithZone(iso?: string | null) {
  const stamp = formatPktStamp(iso);
  return stamp === "—" ? stamp : `${stamp} (PKT)`;
}

export function formatCompactCount(count: number) {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  const rounded = thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10;
  return `${rounded}K`;
}

export function percentOf(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function smsStatsFromRecord(row: BulkActionRecord) {
  const items = row.smsItems || [];
  const counts: Record<BulkSmsItemStatus, number> = {
    pending: 0,
    sent: 0,
    delivered: 0,
    error: 0,
    skipped: 0,
  };
  for (const item of items) counts[item.status] += 1;

  if (!items.length) {
    counts.sent = row.ok ?? 0;
    counts.error = row.failed ?? 0;
    counts.skipped = row.skipped ?? 0;
  }

  const all =
    counts.pending + counts.sent + counts.delivered + counts.error + counts.skipped ||
    row.count ||
    0;
  const sentOrDelivered = counts.sent + counts.delivered;
  return {
    all,
    pending: counts.pending,
    sent: counts.sent,
    delivered: counts.delivered,
    error: counts.error,
    skipped: counts.skipped,
    pendingPct: percentOf(counts.pending, all),
    sentPct: percentOf(counts.sent, all),
    /** Delivered rate is vs messages that left the queue. */
    deliveredPct: percentOf(counts.delivered, sentOrDelivered || all),
    errorPct: percentOf(counts.error, all),
    skippedPct: percentOf(counts.skipped, all),
    items,
  };
}

export function importStatsFromRecord(row: BulkActionRecord) {
  const items = row.importItems || [];
  let success = 0;
  let error = 0;
  let warning = 0;
  for (const item of items) {
    if (item.type === "created" || item.type === "updated") success += 1;
    else if (item.type === "error") error += 1;
    else warning += 1;
  }
  if (!items.length) {
    success = row.ok ?? row.count ?? 0;
    error = row.failed ?? 0;
    warning = row.skipped ?? 0;
  }
  const all = success + error + warning || row.count || 0;
  return {
    all,
    success,
    error,
    warning,
    successPct: percentOf(success, all),
    errorPct: percentOf(error, all),
    warningPct: percentOf(warning, all),
    items,
  };
}

export function filterSmsItems(items: BulkSmsItem[], tab: "all" | BulkSmsItemStatus) {
  if (tab === "all") return items;
  return items.filter((item) => item.status === tab);
}

export function filterImportItems(
  items: BulkImportItem[],
  tab: "all" | "success" | "error" | "warning",
) {
  if (tab === "all") return items;
  if (tab === "success") {
    return items.filter((item) => item.type === "created" || item.type === "updated");
  }
  return items.filter((item) => item.type === tab);
}

export function toDateInputValue(iso?: string) {
  if (!iso) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: PKT,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(iso));
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (!year || !month || !day) return "";
    return `${year}-${month}-${day}`;
  } catch {
    return iso.slice(0, 10);
  }
}

export function dayBoundsPkt(dateValue: string): { start: number; end: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  // Interpret the calendar day in PKT.
  const start = Date.parse(`${dateValue}T00:00:00+05:00`);
  const end = Date.parse(`${dateValue}T23:59:59.999+05:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end };
}
