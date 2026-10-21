import type {
  IntegrationProviderId,
  Listing,
  ListingPortalSync,
  Market,
  PortalConnection,
  PortalId,
  SyncStatus,
} from "@/types";
import { getIntegrationStack } from "@/lib/integrations/registry";
import { isPortalConnected } from "@/lib/portals/connections";
import { buildPortalFeedPayload } from "@/lib/portals/payload";
import { computeSyncReadiness } from "@/lib/portals/readiness";

export type PortalSyncResult = {
  portal: PortalId;
  status: SyncStatus;
  message: string;
  provider: IntegrationProviderId;
  nextAction?: string;
  payload?: ReturnType<typeof buildPortalFeedPayload>;
};

export type PortalAdapter = {
  id: PortalId;
  provider: IntegrationProviderId;
  market: Market;
  validate(listing: Listing): { ok: boolean; errors: string[] };
};

function providerExists(market: Market, provider: IntegrationProviderId) {
  return getIntegrationStack(market).some((item) => item.id === provider);
}

export const rightmoveAdapter: PortalAdapter = {
  id: "rightmove",
  provider: "rightmove",
  market: "uk",
  validate(listing) {
    const errors: string[] = [];
    if (!listing.title?.trim()) errors.push("Title required");
    if (!listing.price) errors.push("Price required");
    if (!listing.tenure) errors.push("Tenure required for UK portal exports");
    if (!listing.imageUrl?.trim()) errors.push("Cover image required");
    if (!providerExists("uk", "rightmove")) {
      errors.push("Rightmove provider unavailable");
    }
    return { ok: errors.length === 0, errors };
  },
};

export const zooplaAdapter: PortalAdapter = {
  id: "zoopla",
  provider: "zoopla",
  market: "uk",
  validate(listing) {
    const errors: string[] = [];
    if (!listing.title?.trim()) errors.push("Title required");
    if (!listing.price) errors.push("Price required");
    if (!listing.tenure) errors.push("Tenure required for UK portal exports");
    if (!listing.imageUrl?.trim()) errors.push("Cover image required");
    if (!providerExists("uk", "zoopla")) errors.push("Zoopla provider unavailable");
    return { ok: errors.length === 0, errors };
  },
};

export const onTheMarketAdapter: PortalAdapter = {
  id: "onthemarket",
  provider: "onthemarket",
  market: "uk",
  validate(listing) {
    const errors: string[] = [];
    if (!listing.title?.trim()) errors.push("Title required");
    if (!listing.price) errors.push("Price required");
    if (!listing.tenure) errors.push("Tenure required for UK portal exports");
    if (!providerExists("uk", "onthemarket")) {
      errors.push("OnTheMarket provider unavailable");
    }
    return { ok: errors.length === 0, errors };
  },
};

export const mlsAdapter: PortalAdapter = {
  id: "mls",
  provider: "mls",
  market: "us",
  validate(listing) {
    const errors: string[] = [];
    if (!listing.title?.trim()) errors.push("Title required");
    if (!listing.price) errors.push("Price required");
    if (!listing.mlsDisclosureComplete) {
      errors.push("MLS disclosures must be complete before upload");
    }
    if (!listing.imageUrl?.trim()) errors.push("Cover image required");
    if (!providerExists("us", "mls")) errors.push("MLS provider unavailable");
    return { ok: errors.length === 0, errors };
  },
};

export function getAdaptersForMarket(market: Market): PortalAdapter[] {
  return market === "uk"
    ? [rightmoveAdapter, zooplaAdapter, onTheMarketAdapter]
    : [mlsAdapter];
}

/**
 * Runs sync for every portal adapter on the listing's market.
 * Without a commercial portal partnership we prepare the feed payload and
 * mark connected portals as synced (export-ready). Unconnected stay not_connected.
 */
export function syncListingToPortals(
  listing: Listing,
  connections: PortalConnection[],
): {
  portals: ListingPortalSync[];
  results: PortalSyncResult[];
  readiness: ReturnType<typeof computeSyncReadiness>;
  summary: string;
} {
  const adapters = getAdaptersForMarket(listing.market);
  const readiness = computeSyncReadiness(listing);
  const results: PortalSyncResult[] = [];
  const now = new Date().toISOString();

  for (const adapter of adapters) {
    const connected = isPortalConnected(connections, adapter.id);
    const connection = connections.find((c) => c.portal === adapter.id);

    if (!connected) {
      results.push({
        portal: adapter.id,
        provider: adapter.provider,
        status: "not_connected",
        message: `${adapter.id} is not connected for this workspace.`,
        nextAction: "Open Portal connections and add a branch ID + feed key.",
      });
      continue;
    }

    const validation = adapter.validate(listing);
    if (!validation.ok) {
      results.push({
        portal: adapter.id,
        provider: adapter.provider,
        status: "error",
        message: validation.errors.join("; "),
        nextAction: "Fix listing validation errors, then sync again.",
      });
      continue;
    }

    const payload = buildPortalFeedPayload(listing, adapter.id, {
      branchId: connection?.branchId,
      networkId: connection?.networkId,
    });

    // Honest status: payload is ready. Live HTTP/FTP to Rightmove/Zoopla/MLS
    // requires commercial partner credentials we don't have in this environment.
    results.push({
      portal: adapter.id,
      provider: adapter.provider,
      status: "synced",
      message: `Feed payload prepared for ${adapter.id} (branch ${connection?.branchId}). Live portal transport needs a commercial partnership — download the JSON export until then.`,
      nextAction: "Download feed export from Portal Sync Logs, or wire partner transport later.",
      payload,
    });
  }

  const portals: ListingPortalSync[] = results.map((r) => ({
    portal: r.portal,
    status: r.status,
    lastError: r.status === "error" ? r.message : undefined,
    lastMessage: r.message,
    lastSyncedAt: r.status === "synced" ? now : undefined,
  }));

  // Preserve any portals already on the listing that aren't in this market's adapters
  const known = new Set(portals.map((p) => p.portal));
  for (const existing of listing.portals) {
    if (!known.has(existing.portal)) portals.push(existing);
  }

  const synced = results.filter((r) => r.status === "synced").length;
  const errors = results.filter((r) => r.status === "error").length;
  const skipped = results.filter((r) => r.status === "not_connected").length;

  const summary =
    errors > 0
      ? `Synced ${synced}/${results.length} portals; ${errors} failed validation; ${skipped} not connected.`
      : synced > 0
        ? `Prepared feed export for ${synced} portal${synced === 1 ? "" : "s"}${skipped ? ` (${skipped} not connected)` : ""}.`
        : skipped === results.length
          ? "No portals connected. Connect at least one under Portal connections."
          : "Portal sync finished.";

  return { portals, results, readiness, summary };
}
