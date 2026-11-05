/**
 * Opaque platform-admin login gates.
 *
 * Public URLs are single-segment slugs from env (e.g. `/k9m2xq7p4n8w`). Role
 * mapping stays server/edge only — never import this module from client
 * components.
 */
import type { PlatformAdminRole } from "@/lib/admin/types";

const isProd = process.env.NODE_ENV === "production";

/** Paths that must never be used as admin gate slugs. */
export const ADMIN_GATE_RESERVED = new Set(
  [
    "admin",
    "api",
    "app",
    "book",
    "brand",
    "favicon.ico",
    "legal",
    "portal",
    "robots.txt",
    "sign",
    "site",
    "sitemap.xml",
    "uk",
    "us",
    "UK",
    "US",
    "_next",
  ].map((s) => s.toLowerCase()),
);

/** Production gate slugs must be long enough to resist casual guessing. */
export const ADMIN_GATE_MIN_LENGTH = isProd ? 12 : 6;

/** Local/dev defaults when env gates are unset. Empty in production. */
const DEV_DEFAULT_GATES: Record<PlatformAdminRole, string> = {
  super_admin: "w7bfw9devlocal",
  billing_admin: "h4c9rm2devlocal",
  support_admin: "n8q2vxpdevlocal",
};

function envGate(role: PlatformAdminRole): string {
  const fromEnv = {
    super_admin: process.env.PLATFORM_ADMIN_GATE_SUPER,
    billing_admin: process.env.PLATFORM_ADMIN_GATE_BILLING,
    support_admin: process.env.PLATFORM_ADMIN_GATE_SUPPORT,
  }[role]?.trim();
  if (fromEnv) return fromEnv;
  if (isProd) return "";
  return DEV_DEFAULT_GATES[role];
}

function normalizeSlug(slug: string): string {
  return slug.trim().replace(/^\/+/, "").toLowerCase();
}

function isValidGateSlug(slug: string): boolean {
  if (!slug || ADMIN_GATE_RESERVED.has(slug)) return false;
  if (slug.length < ADMIN_GATE_MIN_LENGTH) return false;
  // Opaque alphanumeric only — no dots / path tricks.
  if (!/^[a-z0-9]+$/.test(slug)) return false;
  return true;
}

/** slug → role. Duplicate / reserved / weak slugs are dropped. */
export function adminGateMap(): Record<string, PlatformAdminRole> {
  const map: Record<string, PlatformAdminRole> = {};
  const roles: PlatformAdminRole[] = [
    "super_admin",
    "billing_admin",
    "support_admin",
  ];
  for (const role of roles) {
    const raw = envGate(role);
    if (!raw) continue;
    const slug = normalizeSlug(raw);
    if (!isValidGateSlug(slug)) continue;
    if (map[slug]) continue;
    map[slug] = role;
  }
  return map;
}

export function resolveAdminGate(slug: string): PlatformAdminRole | null {
  if (!slug) return null;
  return adminGateMap()[normalizeSlug(slug)] ?? null;
}

export function adminGateSlugForRole(role: PlatformAdminRole): string | null {
  const slug = normalizeSlug(envGate(role));
  if (!isValidGateSlug(slug)) return null;
  return slug;
}

export function isAdminGatePathname(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return false;
  return resolveAdminGate(parts[0]) != null;
}
