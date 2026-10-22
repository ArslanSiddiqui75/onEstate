import type { Market } from "@/types";

export const UK_DOMAIN = "0nestreet.co.uk";
export const US_DOMAIN = "0nestreet.com";

export function normalizeHost(host: string) {
  return host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

export function marketFromHost(host: string): Market | null {
  const name = normalizeHost(host);
  if (name === UK_DOMAIN || name.endsWith(`.${UK_DOMAIN}`)) return "uk";
  if (name === US_DOMAIN || name.endsWith(`.${US_DOMAIN}`)) return "us";
  return null;
}

export function marketFromPath(pathname: string): Market | null {
  if (pathname === "/uk" || pathname.startsWith("/uk/")) return "uk";
  if (pathname === "/us" || pathname.startsWith("/us/")) return "us";
  return null;
}

export function defaultMarket(): Market {
  const raw = (process.env.NEXT_PUBLIC_BRAND || process.env.NEXT_PUBLIC_MARKET || "uk").toLowerCase();
  if (raw === "us" || raw === "usa" || raw === "certified-us" || raw.endsWith("-us")) return "us";
  return "uk";
}

/** Where the other region's homepage lives from this request. */
export function alternateRegionHref(market: Market, host: string) {
  const name = normalizeHost(host);
  if (name === UK_DOMAIN || name === US_DOMAIN) {
    return market === "uk" ? `https://${US_DOMAIN}` : `https://${UK_DOMAIN}`;
  }
  return market === "uk" ? "/us" : "/uk";
}
