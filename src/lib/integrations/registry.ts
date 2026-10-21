import type {
  IntegrationCategory,
  IntegrationHealth,
  IntegrationProviderId,
  Market,
} from "@/types";

export interface IntegrationProvider {
  id: IntegrationProviderId;
  name: string;
  category: IntegrationCategory;
  market: Market;
  summary: string;
  health: IntegrationHealth;
  credentialOwner: string;
  requirements: string[];
}

const providers: Record<Market, IntegrationProvider[]> = {
  uk: [
    {
      id: "rightmove",
      name: "Rightmove",
      category: "portal",
      market: "uk",
      summary: "Listing distribution, status sync, and rejection feedback.",
      health: "attention",
      credentialOwner: "Brokerage portal account",
      requirements: ["listing media", "tenure", "pricing", "branch mapping"],
    },
    {
      id: "zoopla",
      name: "Zoopla",
      category: "portal",
      market: "uk",
      summary: "Lead capture and listing publish/sync workflows.",
      health: "attention",
      credentialOwner: "Brokerage portal account",
      requirements: ["listing media", "branch mapping"],
    },
    {
      id: "onthemarket",
      name: "OnTheMarket",
      category: "portal",
      market: "uk",
      summary: "Secondary portal coverage with inventory sync.",
      health: "planned",
      credentialOwner: "Brokerage portal account",
      requirements: ["listing media", "listing metadata"],
    },
    {
      id: "dropbox-sign",
      name: "Dropbox Sign",
      category: "esign",
      market: "uk",
      summary: "Offer packs, landlord paperwork, and deal signatures.",
      health: "planned",
      credentialOwner: "Platform workspace",
      requirements: ["document templates", "signer roles", "audit timestamps"],
    },
    {
      id: "xero",
      name: "Xero",
      category: "accounting",
      market: "uk",
      summary: "Invoice export, reconciliation handoff, VAT-aware mapping.",
      health: "planned",
      credentialOwner: "Brokerage finance account",
      requirements: ["tax codes", "ledger mapping", "customer sync"],
    },
    {
      id: "audit-hub",
      name: "Compliance Audit Hub",
      category: "compliance",
      market: "uk",
      summary: "Tracks regulated workflow events and handoffs.",
      health: "planned",
      credentialOwner: "Platform managed",
      requirements: ["activity log", "actor identity", "document references"],
    },
  ],
  us: [
    {
      id: "mls",
      name: "MLS",
      category: "mls",
      market: "us",
      summary: "Board credential based syndication, status sync, and validation.",
      health: "attention",
      credentialOwner: "Brokerage board account",
      requirements: ["listing media", "disclosures", "board mapping"],
    },
    {
      id: "docusign",
      name: "DocuSign",
      category: "esign",
      market: "us",
      summary: "Contract packets, addenda, and disclosure signatures.",
      health: "planned",
      credentialOwner: "Platform workspace",
      requirements: ["document templates", "signer routing", "audit trail"],
    },
    {
      id: "quickbooks",
      name: "QuickBooks",
      category: "accounting",
      market: "us",
      summary: "Billing sync, deposit tracking, and accounting export.",
      health: "planned",
      credentialOwner: "Brokerage finance account",
      requirements: ["tax mapping", "customer sync", "ledger references"],
    },
    {
      id: "audit-hub",
      name: "Compliance Audit Hub",
      category: "compliance",
      market: "us",
      summary: "Captures MLS, signature, and operational audit events.",
      health: "planned",
      credentialOwner: "Platform managed",
      requirements: ["activity log", "actor identity", "document references"],
    },
  ],
};

export function getIntegrationStack(market: Market) {
  return providers[market];
}

export function getIntegrationCount(market: Market, health: IntegrationHealth) {
  return providers[market].filter((provider) => provider.health === health).length;
}
