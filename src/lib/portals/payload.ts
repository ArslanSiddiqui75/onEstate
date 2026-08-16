import type { Listing, PortalId } from "@/types";

/**
 * Normalized feed payload we would hand to a portal partner API / RTDF-style
 * transport. Until commercial credentials exist, this is the export artifact
 * agents can download and that a future worker can POST.
 */
export type PortalFeedPayload = {
  schemaVersion: "1.0";
  portal: PortalId;
  generatedAt: string;
  branchId?: string;
  networkId?: string;
  listing: {
    externalId: string;
    title: string;
    address: string;
    city: string;
    market: Listing["market"];
    status: Listing["status"];
    price: number;
    currency: Listing["currency"];
    beds: number;
    baths: number;
    sqft: number;
    tenure?: Listing["tenure"];
    mlsDisclosureComplete?: boolean;
    description: string;
    media: { url: string; sortOrder: number }[];
  };
};

export function buildPortalFeedPayload(
  listing: Listing,
  portal: PortalId,
  opts?: { branchId?: string; networkId?: string },
): PortalFeedPayload {
  return {
    schemaVersion: "1.0",
    portal,
    generatedAt: new Date().toISOString(),
    branchId: opts?.branchId,
    networkId: opts?.networkId,
    listing: {
      externalId: listing.id,
      title: listing.title,
      address: listing.address,
      city: listing.city,
      market: listing.market,
      status: listing.status,
      price: listing.price,
      currency: listing.currency,
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      tenure: listing.tenure,
      mlsDisclosureComplete: listing.mlsDisclosureComplete,
      description: listing.description,
      media: listing.imageUrl
        ? [{ url: listing.imageUrl, sortOrder: 0 }]
        : [],
    },
  };
}

export function downloadPortalFeedPayload(payload: PortalFeedPayload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${payload.portal}-${payload.listing.externalId}-feed.json`;
  a.click();
  URL.revokeObjectURL(url);
}
