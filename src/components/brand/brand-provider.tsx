"use client";

import { createContext, useContext } from "react";
import { getBrandByMarket, type BrandConfig } from "@/lib/brand/config";
import type { Market } from "@/types";

const BrandContext = createContext<BrandConfig>(getBrandByMarket("uk"));

export function BrandProvider({ market, children }: { market: Market; children: React.ReactNode }) {
  return <BrandContext.Provider value={getBrandByMarket(market)}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
