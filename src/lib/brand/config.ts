import type { Market } from "@/types";

export type BrandId = "certified-uk" | "certified-us";

export interface BrandConfig {
  id: BrandId;
  /** Customer-facing product name. The mark is shared; the region is not. */
  name: string;
  /** Accent suffix rendered after "0ne" */
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
  "certified-uk": {
    id: "certified-uk",
    name: "0neStreet",
    suffix: "Street",
    regionShort: "UK",
    domain: "0nestreet.co.uk",
    market: "uk",
    headline: "The estate agency platform for the UK.",
    supporting:
      "Enquiries, viewings, progression, lettings, and payments in pounds. One login on 0nestreet.co.uk.",
    contactCta: "Book a UK demo",
    demandCta: "Talk to sales",
    portalsLabel: "Rightmove, Zoopla, OnTheMarket",
    localeLabel: "United Kingdom",
    currency: "GBP",
    waitlistMarketFixed: "uk",
  },
  "certified-us": {
    id: "certified-us",
    name: "0neStreet",
    suffix: "Street",
    regionShort: "US",
    domain: "0nestreet.com",
    market: "us",
    headline: "The real estate platform for the US.",
    supporting:
      "Enquiries, showings, progression, and payments in dollars. One login on 0nestreet.com.",
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
 * Set NEXT_PUBLIC_BRAND=certified-uk | certified-us
 * (aliases: uk → certified-uk, us → certified-us)
 */
export function resolveBrandId(
  raw = process.env.NEXT_PUBLIC_BRAND ?? process.env.NEXT_PUBLIC_MARKET,
): BrandId {
  const value = (raw || "certified-uk").toLowerCase().trim();
  if (value === "certified-us" || value === "us" || value === "usa") {
    return "certified-us";
  }
  return "certified-uk";
}

export function getActiveBrand(): BrandConfig {
  return BRANDS[resolveBrandId()];
}

export function getBrandByMarket(market: Market): BrandConfig {
  return market === "us" ? BRANDS["certified-us"] : BRANDS["certified-uk"];
}
