import type { ModuleId, PlanId } from "@/types";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  seats: string;
  popular?: boolean;
  modules: Partial<Record<ModuleId, string>>;
  monthlyPriceGbp: number;
  monthlyPriceUsd: number;
  stripePriceEnvKey: string;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  solo: {
    id: "solo",
    name: "Solo Agent",
    tagline: "Independent agents running their own book of business.",
    seats: "1 user",
    modules: {
      crm: "Core pipelines",
      listings: "1 portal feed",
      transactions: "Checklists + e-sign",
      website: "1 branded site",
      social: "Manual scheduling",
      billing: "Included",
    },
    monthlyPriceGbp: 49,
    monthlyPriceUsd: 59,
    stripePriceEnvKey: "STRIPE_PRICE_SOLO",
  },
  team: {
    id: "team",
    name: "Team / Brokerage",
    tagline: "Growing teams and single-office brokerages.",
    seats: "Up to 25 users",
    popular: true,
    modules: {
      crm: "Lead routing & scoring",
      listings: "Full two-way portal sync",
      transactions: "Compliance workflows",
      website: "Team site + client portal",
      social: "Auto listing-to-post",
      billing: "Included",
    },
    monthlyPriceGbp: 199,
    monthlyPriceUsd: 249,
    stripePriceEnvKey: "STRIPE_PRICE_TEAM",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise / Multi-office",
    tagline: "Multi-office brokerages and franchise groups.",
    seats: "Unlimited, custom SLAs",
    modules: {
      crm: "Cross-office routing",
      listings: "Unlimited feeds, multi-MLS",
      transactions: "Ledger + reconciliation",
      website: "Multi-office site network",
      social: "Brand governance controls",
      billing: "Included",
    },
    monthlyPriceGbp: 0,
    monthlyPriceUsd: 0,
    stripePriceEnvKey: "STRIPE_PRICE_ENTERPRISE",
  },
};

/** Which modules a plan unlocks at all (beyond RBAC). */
export const PLAN_MODULE_ACCESS: Record<PlanId, ModuleId[]> = {
  solo: ["crm", "listings", "transactions", "website", "social", "billing"],
  team: ["crm", "listings", "transactions", "website", "social", "billing"],
  enterprise: ["crm", "listings", "transactions", "website", "social", "billing"],
};

/** Feature ceilings narrowed by plan (Solo/Team vs Enterprise). */
export const PLAN_FEATURE_FLAGS: Record<
  PlanId,
  {
    maxSeats: number | null;
    portalFeeds: number | null;
    leadRouting: boolean;
    leadScoring: boolean;
    autoListingPosts: boolean;
    multiOffice: boolean;
    clientPortal: boolean;
  }
> = {
  solo: {
    maxSeats: 1,
    portalFeeds: 1,
    leadRouting: false,
    leadScoring: false,
    autoListingPosts: false,
    multiOffice: false,
    clientPortal: false,
  },
  team: {
    maxSeats: 25,
    portalFeeds: null,
    leadRouting: true,
    leadScoring: true,
    autoListingPosts: true,
    multiOffice: false,
    clientPortal: true,
  },
  enterprise: {
    maxSeats: null,
    portalFeeds: null,
    leadRouting: true,
    leadScoring: true,
    autoListingPosts: true,
    multiOffice: true,
    clientPortal: true,
  },
};

export function planIncludesModule(plan: PlanId, module: ModuleId): boolean {
  return PLAN_MODULE_ACCESS[plan].includes(module);
}
