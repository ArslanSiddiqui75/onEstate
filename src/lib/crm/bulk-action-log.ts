export type BulkActionType =
  | "import"
  | "tags_add"
  | "tags_remove"
  | "category"
  | "assign"
  | "dnd_on"
  | "dnd_off"
  | "promote"
  | "delete"
  | "sms"
  | "export";

export type BulkActionStatus = "complete" | "partial" | "failed" | "running";

export type BulkSmsItemStatus = "pending" | "sent" | "delivered" | "error" | "skipped";

export type BulkSmsItem = {
  id: string;
  identifier: string;
  phone?: string;
  status: BulkSmsItemStatus;
  at: string;
  detail?: string;
};

export type BulkImportItemType = "created" | "updated" | "error" | "warning";

export type BulkImportItem = {
  id: string;
  line: number;
  identifier: string;
  object: "Contacts";
  type: BulkImportItemType;
  detail?: string;
};

export type BulkActionRecord = {
  id: string;
  at: string;
  completedAt?: string;
  type: BulkActionType;
  label: string;
  count: number;
  detail?: string;
  ok?: number;
  failed?: number;
  skipped?: number;
  status?: BulkActionStatus;
  userId?: string;
  userName?: string;
  smsItems?: BulkSmsItem[];
  importItems?: BulkImportItem[];
};

const PREFIX = "onestreet:bulk-actions:";
const MAX_ROWS = 100;

function key(orgId: string, userId: string) {
  return `${PREFIX}${orgId}:${userId}`;
}

function isRecord(row: unknown): row is BulkActionRecord {
  return Boolean(
    row &&
      typeof row === "object" &&
      typeof (row as BulkActionRecord).id === "string" &&
      typeof (row as BulkActionRecord).type === "string",
  );
}

export function loadBulkActions(orgId: string, userId: string): BulkActionRecord[] {
  if (typeof window === "undefined" || !orgId || !userId) return [];
  try {
    const raw = window.localStorage.getItem(key(orgId, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord);
  } catch {
    return [];
  }
}

export function deriveBulkStatus(input: {
  ok?: number;
  failed?: number;
  skipped?: number;
  count: number;
}): BulkActionStatus {
  const failed = input.failed ?? 0;
  const ok = input.ok ?? Math.max(0, input.count - failed - (input.skipped ?? 0));
  if (failed > 0 && ok <= 0 && (input.skipped ?? 0) <= 0) return "failed";
  if (failed > 0) return "partial";
  return "complete";
}

export function recordBulkAction(
  orgId: string,
  userId: string,
  input: Omit<BulkActionRecord, "id" | "at" | "status"> & {
    at?: string;
    status?: BulkActionStatus;
  },
): BulkActionRecord[] {
  if (typeof window === "undefined" || !orgId || !userId) return [];
  const completedAt = input.completedAt || new Date().toISOString();
  const row: BulkActionRecord = {
    id: `bulk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: input.at || new Date().toISOString(),
    completedAt,
    type: input.type,
    label: input.label,
    count: input.count,
    detail: input.detail,
    ok: input.ok,
    failed: input.failed,
    skipped: input.skipped,
    status: input.status || deriveBulkStatus(input),
    userId: input.userId || userId,
    userName: input.userName,
    smsItems: input.smsItems,
    importItems: input.importItems,
  };
  const next = [row, ...loadBulkActions(orgId, userId)].slice(0, MAX_ROWS);
  window.localStorage.setItem(key(orgId, userId), JSON.stringify(next));
  return next;
}

export function deleteBulkAction(orgId: string, userId: string, id: string): BulkActionRecord[] {
  if (typeof window === "undefined" || !orgId || !userId) return [];
  const next = loadBulkActions(orgId, userId).filter((row) => row.id !== id);
  window.localStorage.setItem(key(orgId, userId), JSON.stringify(next));
  return next;
}

export function clearBulkActions(orgId: string, userId: string) {
  if (typeof window === "undefined" || !orgId || !userId) return;
  window.localStorage.removeItem(key(orgId, userId));
}

export const BULK_ACTION_LABELS: Record<BulkActionType, string> = {
  import: "Import",
  tags_add: "Add tags",
  tags_remove: "Remove tags",
  category: "Category",
  assign: "Assign",
  dnd_on: "DND on",
  dnd_off: "DND off",
  promote: "Promote",
  delete: "Delete",
  sms: "SMS",
  export: "Export",
};

export const BULK_STATUS_LABELS: Record<BulkActionStatus, string> = {
  complete: "Complete",
  partial: "Partial",
  failed: "Failed",
  running: "Running",
};
