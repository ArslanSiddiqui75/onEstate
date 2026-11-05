import { createHmac, timingSafeEqual } from "crypto";
import type { PlatformAdminRole } from "@/lib/admin/types";
import { PLATFORM_ADMIN_ACCOUNTS } from "@/lib/admin/accounts";
import type { PlatformAdminUser } from "@/lib/admin/types";

const isProd = process.env.NODE_ENV === "production";

/** Local-only fallback — never used when NODE_ENV=production. */
const DEV_FALLBACK_PASSWORD = isProd ? "" : "CertifiedAdmin1!";

/** Production passwords must be at least this long. */
export const ADMIN_PASSWORD_MIN_LENGTH = 16;

/** Session signing secrets must be at least this long in production. */
export const ADMIN_SESSION_SECRET_MIN_LENGTH = 32;

/**
 * Constant-time string compare via fixed-length digests so password length
 * cannot be inferred from early exits.
 */
function safeEqual(provided: string, expected: string): boolean {
  const left = createHmac("sha256", "platform-admin-pw")
    .update(provided)
    .digest();
  const right = createHmac("sha256", "platform-admin-pw")
    .update(expected)
    .digest();
  return timingSafeEqual(left, right);
}

function passwordLooksStrong(password: string): boolean {
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) return false;
  // Reject obvious placeholders / shared demo strings.
  const lowered = password.toLowerCase();
  if (
    lowered.includes("password") ||
    lowered.includes("changeme") ||
    lowered === "certifiedadmin1!"
  ) {
    return false;
  }
  return true;
}

function passwordForRole(role: PlatformAdminRole): string | null {
  const specific = {
    super_admin: process.env.PLATFORM_ADMIN_PASSWORD_SUPER,
    billing_admin: process.env.PLATFORM_ADMIN_PASSWORD_BILLING,
    support_admin: process.env.PLATFORM_ADMIN_PASSWORD_SUPPORT,
  }[role]?.trim();

  if (specific) {
    if (isProd && !passwordLooksStrong(specific)) return null;
    return specific;
  }

  // Shared password is a local convenience only — production requires
  // distinct per-role secrets so one breach cannot unlock every gate.
  if (isProd) return null;

  const shared = process.env.PLATFORM_ADMIN_PASSWORD?.trim();
  if (shared) return shared;

  return DEV_FALLBACK_PASSWORD || null;
}

/**
 * Dedicated cookie-signing secret. In production the session secret must be
 * set, long enough, and distinct from every admin password.
 */
export function adminSessionSecret(): string | null {
  const dedicated = process.env.PLATFORM_ADMIN_SESSION_SECRET?.trim();
  if (dedicated) {
    if (isProd) {
      if (dedicated.length < ADMIN_SESSION_SECRET_MIN_LENGTH) return null;
      const passwords = [
        process.env.PLATFORM_ADMIN_PASSWORD_SUPER,
        process.env.PLATFORM_ADMIN_PASSWORD_BILLING,
        process.env.PLATFORM_ADMIN_PASSWORD_SUPPORT,
        process.env.PLATFORM_ADMIN_PASSWORD,
      ]
        .map((v) => v?.trim())
        .filter((v): v is string => Boolean(v));
      if (passwords.some((p) => safeEqual(dedicated, p))) return null;
    }
    return dedicated;
  }

  if (isProd) return null;

  const shared = process.env.PLATFORM_ADMIN_PASSWORD?.trim();
  if (shared) return shared;
  return DEV_FALLBACK_PASSWORD || null;
}

export function authenticatePlatformAdmin(
  email: string,
  password: string,
  requiredRole?: PlatformAdminRole,
): PlatformAdminUser | null {
  const account = PLATFORM_ADMIN_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!account) {
    // Still hash against a dummy so timing is similar for unknown emails.
    safeEqual(password, "missing-account-sentinel");
    return null;
  }
  if (requiredRole && account.role !== requiredRole) {
    safeEqual(password, "wrong-role-sentinel");
    return null;
  }
  const expected = passwordForRole(account.role);
  if (!expected || !safeEqual(password, expected)) return null;
  return account;
}
