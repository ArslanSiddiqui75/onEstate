import type { AccessLevel, ModuleId, Role } from "@/types";

/** Enterprise-tier RBAC ceilings from the stakeholder deck. */
export const RBAC_MATRIX: Record<Role, Record<ModuleId, AccessLevel>> = {
  owner: {
    crm: "full",
    listings: "full",
    transactions: "full",
    website: "edit",
    social: "edit",
    billing: "view",
  },
  broker: {
    crm: "full",
    listings: "full",
    transactions: "edit",
    website: "edit",
    social: "view",
    billing: "none",
  },
  team_lead: {
    crm: "full",
    listings: "full",
    transactions: "edit",
    website: "edit",
    social: "view",
    billing: "view",
  },
  agent: {
    crm: "full",
    listings: "edit",
    transactions: "view",
    website: "none",
    social: "none",
    billing: "none",
  },
  assistant: {
    crm: "full",
    listings: "view",
    transactions: "none",
    website: "none",
    social: "edit",
    billing: "none",
  },
  accountant: {
    crm: "full",
    listings: "full",
    transactions: "view",
    website: "none",
    social: "none",
    billing: "full",
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner / Admin",
  broker: "Broker",
  team_lead: "Team Lead",
  agent: "Agent",
  assistant: "Assistant / ISA",
  accountant: "Accountant",
};

export const MODULE_LABELS: Record<ModuleId, string> = {
  crm: "CRM & Leads",
  listings: "Listings & Portals",
  transactions: "Transactions & Compliance",
  website: "Website Builder",
  social: "Social Tools",
  billing: "Billing & Plans",
};

export const MODULE_HREF: Record<ModuleId, string> = {
  crm: "/app/crm",
  listings: "/app/listings",
  transactions: "/app/transactions",
  website: "/app/website",
  social: "/app/social",
  billing: "/app/billing",
};

export const APP_MODULE_HREF: Record<ModuleId, string> = {
  crm: "/app/crm",
  listings: "/app/listings",
  transactions: "/app/transactions",
  website: "/app/website",
  social: "/app/social",
  billing: "/app/billing",
};

export function getRoleAccess(role: Role, module: ModuleId): AccessLevel {
  return RBAC_MATRIX[role][module];
}

export function canAccess(level: AccessLevel, required: AccessLevel): boolean {
  const rank: Record<AccessLevel, number> = {
    none: 0,
    view: 1,
    edit: 2,
    full: 3,
  };
  return rank[level] >= rank[required];
}
