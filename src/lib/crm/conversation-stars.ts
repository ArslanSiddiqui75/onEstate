const PREFIX = "onestreet:conversation-stars:";

function key(orgId: string, userId: string) {
  return `${PREFIX}${orgId}:${userId}`;
}

export function loadStarredLeadIds(orgId: string, userId: string): Set<string> {
  if (typeof window === "undefined" || !orgId || !userId) return new Set();
  try {
    const raw = window.localStorage.getItem(key(orgId, userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

export function saveStarredLeadIds(orgId: string, userId: string, ids: Set<string>) {
  if (typeof window === "undefined" || !orgId || !userId) return;
  try {
    window.localStorage.setItem(key(orgId, userId), JSON.stringify([...ids]));
  } catch {
    // Quota / private mode — starring is best-effort.
  }
}

export function toggleStarredLeadId(
  orgId: string,
  userId: string,
  leadId: string,
  starred: boolean,
): Set<string> {
  const next = loadStarredLeadIds(orgId, userId);
  if (starred) next.add(leadId);
  else next.delete(leadId);
  saveStarredLeadIds(orgId, userId, next);
  return next;
}
