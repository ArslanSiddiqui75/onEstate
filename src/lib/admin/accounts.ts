/**
 * Platform admin identities (no passwords). Passwords live in env vars and are
 * checked only on the server — see `credentials.ts` and `/api/admin/login`.
 */
import type { PlatformAdminRole, PlatformAdminUser } from "@/lib/admin/types";

export const PLATFORM_ADMIN_ACCOUNTS: PlatformAdminUser[] = [
  {
    id: "padmin_super",
    name: "Platform Super Admin",
    email: "admin@certified.local",
    role: "super_admin",
  },
  {
    id: "padmin_billing",
    name: "Billing Operations",
    email: "billing-admin@certified.local",
    role: "billing_admin",
  },
  {
    id: "padmin_support",
    name: "Support Operations",
    email: "support-admin@certified.local",
    role: "support_admin",
  },
];

/** Compile-time stripped from production client bundles. */
export const DEV_ADMIN_PASSWORD_HINT =
  process.env.NODE_ENV === "production" ? "" : "CertifiedAdmin1!";

export function isPlatformAdminDevHintsEnabled() {
  return process.env.NODE_ENV !== "production";
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

export function adminCanImpersonate(role: PlatformAdminRole) {
  return role === "super_admin" || role === "support_admin";
}
