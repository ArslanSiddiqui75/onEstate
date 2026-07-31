/**
 * DEV/OPS platform admin accounts.
 * Keep separate from brokerage seed users. Rotate credentials before production.
 */
import type { PlatformAdminRole, PlatformAdminUser } from "@/lib/admin/types";

export interface PlatformAdminAccount extends PlatformAdminUser {
  password: string;
}

export const PLATFORM_ADMIN_PASSWORD = "CertifiedAdmin1!";

export const PLATFORM_ADMIN_ACCOUNTS: PlatformAdminAccount[] = [
  {
    id: "padmin_super",
    name: "Platform Super Admin",
    email: "admin@certified.local",
    password: PLATFORM_ADMIN_PASSWORD,
    role: "super_admin",
  },
  {
    id: "padmin_billing",
    name: "Billing Operations",
    email: "billing-admin@certified.local",
    password: PLATFORM_ADMIN_PASSWORD,
    role: "billing_admin",
  },
  {
    id: "padmin_support",
    name: "Support Operations",
    email: "support-admin@certified.local",
    password: PLATFORM_ADMIN_PASSWORD,
    role: "support_admin",
  },
];

export function findPlatformAdmin(
  email: string,
  password: string,
): PlatformAdminAccount | null {
  const account = PLATFORM_ADMIN_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!account) return null;
  if (account.password !== password) return null;
  return account;
}

export function adminCanManageBilling(role: PlatformAdminRole) {
  return role === "super_admin" || role === "billing_admin";
}

export function adminCanSuspendTenants(role: PlatformAdminRole) {
  return role === "super_admin" || role === "billing_admin";
}

export function adminCanEditNotes(role: PlatformAdminRole) {
  return (
    role === "super_admin" ||
    role === "billing_admin" ||
    role === "support_admin"
  );
}
