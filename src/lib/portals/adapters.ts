import type {
  IntegrationProviderId,
  Market,
  PortalId,
  SyncStatus,
} from "@/types";
import { getIntegrationStack } from "@/lib/integrations/registry";
import { globalJobQueue } from "@/lib/jobs/queue";

export interface PortalSyncResult {
  portal: PortalId;
  status: SyncStatus;
  message: string;
  provider: IntegrationProviderId;
  nextAction?: string;
}

export interface PortalAdapter {
  id: PortalId;
  provider: IntegrationProviderId;
  market: Market;
  queueName: string;
  validate(listing: {
    title: string;
    price: number;
    tenure?: string;
    mlsDisclosureComplete?: boolean;
  }): { ok: boolean; errors: string[] };
  publish(listingId: string): Promise<PortalSyncResult>;
}

function createQueuedResult(
  portal: PortalId,
  provider: IntegrationProviderId,
  listingId: string,
  queueName: string,
): Promise<PortalSyncResult> {
  const job = globalJobQueue.enqueue({
    queue: queueName,
    type: "portal_sync",
    payload: { portal, provider, listingId },
  });

  return Promise.resolve({
    portal,
    provider,
    status: "pending",
    message: `Queued ${listingId} as ${job.id} for ${provider} on ${queueName}.`,
    nextAction: "Sync worker will pick up the job once credentials are connected.",
  });
}

function providerExists(market: Market, provider: IntegrationProviderId) {
  return getIntegrationStack(market).some((item) => item.id === provider);
}

export const rightmoveAdapter: PortalAdapter = {
  id: "rightmove",
  provider: "rightmove",
  market: "uk",
  queueName: "uk-portal-feed",
  validate(listing) {
    const errors: string[] = [];
    if (!listing.title) errors.push("Title required");
    if (!listing.price) errors.push("Price required");
    if (!listing.tenure) errors.push("Tenure required for UK portal exports");
    if (!providerExists("uk", "rightmove")) {
      errors.push("Rightmove provider unavailable");
    }
    return { ok: errors.length === 0, errors };
  },
  publish(listingId) {
    return createQueuedResult(
      "rightmove",
      "rightmove",
      listingId,
      this.queueName,
    );
  },
};

export const zooplaAdapter: PortalAdapter = {
  ...rightmoveAdapter,
  id: "zoopla",
  provider: "zoopla",
  publish(listingId) {
    return createQueuedResult("zoopla", "zoopla", listingId, this.queueName);
  },
};

export const onTheMarketAdapter: PortalAdapter = {
  ...rightmoveAdapter,
  id: "onthemarket",
  provider: "onthemarket",
  publish(listingId) {
    return createQueuedResult(
      "onthemarket",
      "onthemarket",
      listingId,
      this.queueName,
    );
  },
};

export const mlsAdapter: PortalAdapter = {
  id: "mls",
  provider: "mls",
  market: "us",
  queueName: "us-mls-feed",
  validate(listing) {
    const errors: string[] = [];
    if (!listing.title) errors.push("Title required");
    if (!listing.price) errors.push("Price required");
    if (!listing.mlsDisclosureComplete) {
      errors.push("MLS disclosures must be complete before upload");
    }
    if (!providerExists("us", "mls")) errors.push("MLS provider unavailable");
    return { ok: errors.length === 0, errors };
  },
  publish(listingId) {
    return createQueuedResult("mls", "mls", listingId, this.queueName);
  },
};

export function getAdaptersForMarket(market: Market): PortalAdapter[] {
  return market === "uk"
    ? [rightmoveAdapter, zooplaAdapter, onTheMarketAdapter]
    : [mlsAdapter];
}
