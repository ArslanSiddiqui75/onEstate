/**
 * DEV-ONLY seed accounts.
 * Remove this file and its imports before production deployment.
 */
import type { PlanId, Role } from "@/types";

export interface DevSeedAccount {
  id: string;
  name: string;
  email: string;
  /** Local-only password for quick role testing. Remove before deploy. */
  password: string;
  role: Role;
  avatarInitials: string;
}

export const DEV_SEED_ORG = {
  id: "org_dev_northbridge",
  name: "Northbridge Realty Group",
  plan: "team" as PlanId,
};

/** Shared password for all seed accounts (local/dev only). */
export const DEV_SEED_PASSWORD = "CertifiedDev1!";

export const DEV_SEED_ACCOUNTS: DevSeedAccount[] = [
  {
    id: "dev_owner",
    name: "Ava North",
    email: "owner@certified.local",
    password: DEV_SEED_PASSWORD,
    role: "owner",
    avatarInitials: "AN",
  },
  {
    id: "dev_broker",
    name: "James Cole",
    email: "broker@certified.local",
    password: DEV_SEED_PASSWORD,
    role: "broker",
    avatarInitials: "JC",
  },
  {
    id: "dev_team_lead",
    name: "Mia Patel",
    email: "teamlead@certified.local",
    password: DEV_SEED_PASSWORD,
    role: "team_lead",
    avatarInitials: "MP",
  },
  {
    id: "dev_agent",
    name: "Noah Reed",
    email: "agent@certified.local",
    password: DEV_SEED_PASSWORD,
    role: "agent",
    avatarInitials: "NR",
  },
  {
    id: "dev_assistant",
    name: "Sofia Lane",
    email: "assistant@certified.local",
    password: DEV_SEED_PASSWORD,
    role: "assistant",
    avatarInitials: "SL",
  },
  {
    id: "dev_accountant",
    name: "Ben Ortiz",
    email: "accountant@certified.local",
    password: DEV_SEED_PASSWORD,
    role: "accountant",
    avatarInitials: "BO",
  },
];

export function findDevSeedAccount(email: string, password?: string) {
  const account = DEV_SEED_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!account) return null;
  if (password != null && password !== account.password) return null;
  return account;
}

export function isDevSeedEnabled() {
  return process.env.NODE_ENV !== "production";
}
