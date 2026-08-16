import type { Market, PortalConnection, PortalId } from "@/types";
import { getDefaultPortals } from "@/lib/market/terminology";

const STORE_PREFIX = "certified_portal_connections_v1:";

function keyFor(orgId: string) {
  return `${STORE_PREFIX}${orgId}`;
}

export function loadPortalConnections(orgId: string): PortalConnection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(keyFor(orgId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PortalConnection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePortalConnections(orgId: string, connections: PortalConnection[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(keyFor(orgId), JSON.stringify(connections));
}

export function upsertPortalConnection(
  orgId: string,
  connection: PortalConnection,
): PortalConnection[] {
  const existing = loadPortalConnections(orgId);
  const next = [
    ...existing.filter((c) => c.portal !== connection.portal),
    connection,
  ];
  savePortalConnections(orgId, next);
  return next;
}

export function getConnectionForPortal(
  connections: PortalConnection[],
  portal: PortalId,
): PortalConnection | undefined {
  return connections.find((c) => c.portal === portal);
}

export function isPortalConnected(
  connections: PortalConnection[],
  portal: PortalId,
): boolean {
  const c = getConnectionForPortal(connections, portal);
  return Boolean(c?.connected && c.branchId?.trim());
}

/** Default empty connection cards for the market’s portals. */
export function defaultConnectionsForMarket(market: Market): PortalConnection[] {
  return getDefaultPortals(market).map((portal) => ({
    portal,
    connected: false,
  }));
}

export function mergeConnectionsWithDefaults(
  market: Market,
  saved: PortalConnection[],
): PortalConnection[] {
  const defaults = defaultConnectionsForMarket(market);
  return defaults.map((d) => saved.find((s) => s.portal === d.portal) || d);
}

export const PORTAL_LABEL: Record<PortalId, string> = {
  rightmove: "Rightmove",
  zoopla: "Zoopla",
  onthemarket: "OnTheMarket",
  mls: "MLS",
};
