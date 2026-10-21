import type { Market } from "@/types";

export type BrandId = "certified-uk" | "certified-us";

export interface BrandConfig {
  id: BrandId;
  /** Customer-facing product name */
  name: string;
  /** Accent suffix rendered after "Certified" */
  suffix: "UK" | "US";
  market: Market;
  /** Primary pitch line for this market */
  headline: string;
  supporting: string;
  contactCta: string;
  demandCta: string;
  portalsLabel: string;
  localeLabel: string;
  waitlistMarketFixed: Market;
}

export const BRANDS: Record<BrandId, BrandConfig> = {
  "certified-uk": {
    id: "certified-uk",
    name: "CertifiedUK",
    suffix: "UK",
    market: "uk",
    headline: "The unified estate agency operations platform.",
    supporting:
      "One software. One login. Every deal — CRM, listings, contracts, website, social, and billing.",
    contactCta: "Book a CertifiedUK demo",
    demandCta: "Talk to sales",
    portalsLabel: "Rightmove, Zoopla, OnTheMarket",
    localeLabel: "United Kingdom",
    waitlistMarketFixed: "uk",
  },
  "certified-us": {
    id: "certified-us",
    name: "CertifiedUS",
    suffix: "US",
    market: "us",
    headline: "The unified real estate operations platform.",
    supporting:
      "One software. One login. Every deal — CRM, listings, contracts, website, social, and billing.",
    contactCta: "Book a CertifiedUS demo",
    demandCta: "Talk to sales",
    portalsLabel: "MLS boards via brokerage credentials",
    localeLabel: "United States",
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
