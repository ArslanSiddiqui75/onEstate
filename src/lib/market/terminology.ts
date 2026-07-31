import type { Market } from "@/types";

export const MARKET_LABELS: Record<Market, string> = {
  uk: "United Kingdom",
  us: "United States",
};

export const terminology = {
  uk: {
    agent: "Estate agent",
    agents: "Estate agents",
    lease: "Tenancy",
    leases: "Tenancies",
    conveyancer: "Conveyancer",
    realtorBoard: "Portal",
    portals: "Rightmove, Zoopla, OnTheMarket",
    currencySymbol: "£",
    taxLabel: "VAT",
    propertyLaw: "Leasehold / freehold",
  },
  us: {
    agent: "Realtor",
    agents: "Realtors",
    lease: "Lease",
    leases: "Leases",
    conveyancer: "Title company",
    realtorBoard: "MLS",
    portals: "MLS boards",
    currencySymbol: "$",
    taxLabel: "Sales tax",
    propertyLaw: "MLS disclosures",
  },
} as const;

export type Terminology = (typeof terminology)[Market];

export function getTerminology(market: Market): Terminology {
  return terminology[market];
}

export function getCurrency(market: Market): "GBP" | "USD" {
  return market === "uk" ? "GBP" : "USD";
}

export function getDefaultPortals(market: Market) {
  return market === "uk"
    ? (["rightmove", "zoopla", "onthemarket"] as const)
    : (["mls"] as const);
}
