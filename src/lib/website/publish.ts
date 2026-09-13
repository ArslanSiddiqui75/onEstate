export function assertCanPublishWebsite(
  published: boolean,
  listingCount: number,
): void {
  if (published && listingCount < 1) {
    throw new Error("Add a listing before publishing the website");
  }
}
