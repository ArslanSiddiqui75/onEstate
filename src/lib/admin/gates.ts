/**
 * Opaque platform-admin login gates.
 *
 * Public URLs are single-segment slugs from env (e.g. `/w7bfw9`). Role mapping
 * stays server/edge only — never import this module from client components.
 */
import type { PlatformAdminRole } from "@/lib/admin/types";

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

/** Local/dev defaults when env gates are unset. Empty in production. */
const DEV_DEFAULT_GATES: Record<PlatformAdminRole, string> = {
  super_admin: "w7bfw9",
  billing_admin: "h4c9rm2",
  support_admin: "n8q2vxp",
};

function envGate(role: PlatformAdminRole): string {
  const fromEnv = {
    super_admin: process.env.PLATFORM_ADMIN_GATE_SUPER,
    billing_admin: process.env.PLATFORM_ADMIN_GATE_BILLING,
    support_admin: process.env.PLATFORM_ADMIN_GATE_SUPPORT,
  }[role]?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return "";
  return DEV_DEFAULT_GATES[role];
}

function normalizeSlug(slug: string): string {
  return slug.trim().replace(/^\/+/, "").toLowerCase();
}

/** slug → role. Duplicate / reserved slugs are dropped. */
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
    if (!slug || ADMIN_GATE_RESERVED.has(slug)) continue;
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
  if (!slug || ADMIN_GATE_RESERVED.has(slug)) return null;
  return slug;
}

export function isAdminGatePathname(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return false;
  return resolveAdminGate(parts[0]) != null;
}
