import type { Market } from "@/types";

export type BrandId = "onestreet-uk" | "onestreet-us";

export interface BrandConfig {
  id: BrandId;
  /** Customer-facing product name. The mark is shared; the region is not. */
  name: string;
  /** Word after the leading character in the wordmark. */
  suffix: "Street";
  regionShort: "UK" | "US";
  domain: string;
  market: Market;
  /** Primary pitch line for this market */
  headline: string;
  supporting: string;
  contactCta: string;
  demandCta: string;
  portalsLabel: string;
  localeLabel: string;
  currency: "GBP" | "USD";
  waitlistMarketFixed: Market;
}

export const BRANDS: Record<BrandId, BrandConfig> = {
  "onestreet-uk": {
    id: "onestreet-uk",
    name: "0neStreet",
    suffix: "Street",
    regionShort: "UK",
    domain: "0nestreet.co.uk",
    market: "uk",
    headline: "The estate agency platform for the UK.",
    supporting:
      "Enquiries, viewings, progression, lettings, and payments in pounds.",
    contactCta: "Book a UK demo",
    demandCta: "Talk to sales",
    portalsLabel: "Rightmove, Zoopla, OnTheMarket",
    localeLabel: "United Kingdom",
    currency: "GBP",
    waitlistMarketFixed: "uk",
  },
  "onestreet-us": {
    id: "onestreet-us",
    name: "OneStreet",
    suffix: "Street",
    regionShort: "US",
    domain: "0nestreet.com",
    market: "us",
    headline: "The real estate platform for the US.",
    supporting:
      "Enquiries, showings, progression, and payments in dollars.",
    contactCta: "Book a US demo",
    demandCta: "Talk to sales",
    portalsLabel: "MLS boards via brokerage credentials",
    localeLabel: "United States",
    currency: "USD",
    waitlistMarketFixed: "us",
  },
};

/**
 * Active go-to-market brand for this deployment.
 * Market rules live in backend/config — not a user-facing switcher.
 *
 * Set NEXT_PUBLIC_BRAND=onestreet-uk | onestreet-us
 * (aliases: uk, us, and the older certified-uk / certified-us values)
 */
export function resolveBrandId(
  raw = process.env.NEXT_PUBLIC_BRAND ?? process.env.NEXT_PUBLIC_MARKET,
): BrandId {
  const value = (raw || "onestreet-uk").toLowerCase().trim();
  if (
    value === "onestreet-us" ||
    value === "certified-us" ||
    value === "us" ||
    value === "usa" ||
    value.endsWith("-us")
  ) {
    return "onestreet-us";
  }
  return "onestreet-uk";
}

export function getActiveBrand(): BrandConfig {
  return BRANDS[resolveBrandId()];
}

export function getBrandByMarket(market: Market): BrandConfig {
  return market === "us" ? BRANDS["onestreet-us"] : BRANDS["onestreet-uk"];
}
