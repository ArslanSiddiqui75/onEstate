import { timingSafeEqual } from "crypto";
import type { PlatformAdminRole } from "@/lib/admin/types";
import { PLATFORM_ADMIN_ACCOUNTS } from "@/lib/admin/accounts";
import type { PlatformAdminUser } from "@/lib/admin/types";

const DEV_FALLBACK_PASSWORD =
  process.env.NODE_ENV === "production" ? "" : "CertifiedAdmin1!";

function safeEqual(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function passwordForRole(role: PlatformAdminRole): string | null {
  const specific = {
    super_admin: process.env.PLATFORM_ADMIN_PASSWORD_SUPER,
    billing_admin: process.env.PLATFORM_ADMIN_PASSWORD_BILLING,
    support_admin: process.env.PLATFORM_ADMIN_PASSWORD_SUPPORT,
  }[role]?.trim();
  if (specific) return specific;

  const shared = process.env.PLATFORM_ADMIN_PASSWORD?.trim();
  if (shared) return shared;

  return DEV_FALLBACK_PASSWORD || null;
}

export function adminSessionSecret(): string | null {
  const dedicated = process.env.PLATFORM_ADMIN_SESSION_SECRET?.trim();
  if (dedicated) return dedicated;
  const shared = process.env.PLATFORM_ADMIN_PASSWORD?.trim();
  if (shared) return shared;
  return DEV_FALLBACK_PASSWORD || null;
}

export function authenticatePlatformAdmin(
  email: string,
  password: string,
): PlatformAdminUser | null {
  const account = PLATFORM_ADMIN_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!account) return null;
  const expected = passwordForRole(account.role);
  if (!expected || !safeEqual(password, expected)) return null;
  return account;
}
