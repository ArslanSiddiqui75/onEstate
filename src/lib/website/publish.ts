/** Listings that may appear on a published public site. */
export function isPublishableListingStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "under_offer";
}

export function assertCanPublishWebsite(
  published: boolean,
  listingCount: number,
): void {
  if (published && listingCount < 1) {
    throw new Error("Add an active listing before publishing the website");
  }
}
