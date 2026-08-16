import type { Listing } from "@/types";

/** Field-completeness score (0–100) instead of fake +20 bumps on queue. */
export function computeSyncReadiness(listing: Listing): {
  score: number;
  nextMilestone: string;
  gaps: string[];
} {
  const gaps: string[] = [];
  let points = 0;
  const add = (ok: boolean, pts: number, gap: string) => {
    if (ok) points += pts;
    else gaps.push(gap);
  };

  add(Boolean(listing.title?.trim()), 15, "Add a title");
  add(listing.price > 0, 15, "Set a price");
  add(Boolean(listing.address?.trim()), 10, "Add an address");
  add(Boolean(listing.city?.trim()), 10, "Add a city");
  add(Boolean(listing.description?.trim()), 15, "Add a description");
  add(Boolean(listing.imageUrl?.trim()), 15, "Add a cover image");
  add(listing.beds > 0, 5, "Set bedrooms");
  add(listing.baths > 0, 5, "Set bathrooms");

  if (listing.market === "uk") {
    add(Boolean(listing.tenure), 10, "Set tenure (freehold / leasehold)");
  } else {
    add(
      Boolean(listing.mlsDisclosureComplete),
      10,
      "Complete MLS disclosures",
    );
  }

  const score = Math.min(100, points);
  const nextMilestone =
    gaps.length === 0
      ? "Ready to queue portal sync"
      : gaps[0] || "Complete listing details";

  return { score, nextMilestone, gaps };
}
