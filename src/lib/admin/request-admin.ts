import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin/session-token";
import type { PlatformAdminUser } from "@/lib/admin/types";

export async function requirePlatformAdmin(): Promise<PlatformAdminUser | null> {
  const jar = await cookies();
  return verifyAdminSessionToken(jar.get(ADMIN_SESSION_COOKIE)?.value);
}
