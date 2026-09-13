/** Soft-archive is the product delete. Hard delete would break messages, tasks, and e-sign. */

export function isActiveRecord(row: { archivedAt?: string | null }): boolean {
  return !row.archivedAt;
}

export function archiveStamp(now = new Date()): string {
  return now.toISOString();
}
