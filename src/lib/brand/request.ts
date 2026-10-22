import { headers } from "next/headers";
import { getBrandByMarket } from "@/lib/brand/config";
import { alternateRegionHref, defaultMarket, marketFromHost } from "@/lib/brand/host";
import type { Market } from "@/types";

export async function requestMarket(forced?: Market) {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const explicit = headerList.get("x-onestreet-market");
  const headerMarket = explicit === "uk" || explicit === "us" ? explicit : null;
  const market = forced ?? headerMarket ?? marketFromHost(host) ?? defaultMarket();
  return {
    market,
    host,
    brand: getBrandByMarket(market),
    alternateHref: alternateRegionHref(market, host),
  };
}
