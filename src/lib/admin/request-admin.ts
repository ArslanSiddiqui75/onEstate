import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin/session-token";
import type { PlatformAdminRole, PlatformAdminUser } from "@/lib/admin/types";
import { checkAdminRole, type AdminRoleCheck } from "@/lib/admin/roles";

export type { AdminRoleCheck };

export async function requirePlatformAdmin(): Promise<PlatformAdminUser | null> {
  const jar = await cookies();
  return verifyAdminSessionToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
}

/**
 * Verifies the admin session and (when roles are given) that the admin holds
 * one of the allowed roles. Distinguishes 401 (no session) from 403 (role).
 */
export async function requireAdminRole(
  ...roles: PlatformAdminRole[]
): Promise<AdminRoleCheck> {
  return checkAdminRole(await requirePlatformAdmin(), roles);
}
