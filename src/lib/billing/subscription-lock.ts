/**
 * Client-safe soft-lock statuses (no next/server imports).
 * Keep in sync with server checks in `require-module.ts`.
 */
export const BLOCKED_WORKSPACE_STATUSES = new Set([
  "paused",
  "canceled",
  "unpaid",
  "incomplete_expired",
]);

/** Soft-lock: billing stays reachable; product modules do not. */
export function isSubscriptionSoftLocked(
  status: string | null | undefined,
): boolean {
  return Boolean(status && BLOCKED_WORKSPACE_STATUSES.has(status));
}
