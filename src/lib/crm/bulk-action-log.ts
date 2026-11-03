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

export type BulkActionRecord = {
  id: string;
  at: string;
  type: BulkActionType;
  label: string;
  count: number;
  detail?: string;
  ok?: number;
  failed?: number;
  skipped?: number;
};

const PREFIX = "onestreet:bulk-actions:";
const MAX_ROWS = 40;

function key(orgId: string, userId: string) {
  return `${PREFIX}${orgId}:${userId}`;
}

export function loadBulkActions(orgId: string, userId: string): BulkActionRecord[] {
  if (typeof window === "undefined" || !orgId || !userId) return [];
  try {
    const raw = window.localStorage.getItem(key(orgId, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is BulkActionRecord =>
        Boolean(row && typeof row === "object" && typeof (row as BulkActionRecord).id === "string"),
    );
  } catch {
    return [];
  }
}

export function recordBulkAction(
  orgId: string,
  userId: string,
  input: Omit<BulkActionRecord, "id" | "at"> & { at?: string },
): BulkActionRecord[] {
  if (typeof window === "undefined" || !orgId || !userId) return [];
  const row: BulkActionRecord = {
    id: `bulk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: input.at || new Date().toISOString(),
    type: input.type,
    label: input.label,
    count: input.count,
    detail: input.detail,
    ok: input.ok,
    failed: input.failed,
    skipped: input.skipped,
  };
  const next = [row, ...loadBulkActions(orgId, userId)].slice(0, MAX_ROWS);
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
  sms: "Bulk SMS",
  export: "Export",
};
