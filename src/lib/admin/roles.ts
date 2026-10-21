import type { PlatformAdminRole, PlatformAdminUser } from "@/lib/admin/types";

export type AdminRoleCheck =
  | { ok: true; admin: PlatformAdminUser }
  | { ok: false; status: 401 | 403; error: string };

export function checkAdminRole(
  admin: PlatformAdminUser | null,
  roles: PlatformAdminRole[] = [],
): AdminRoleCheck {
  if (!admin) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (roles.length > 0 && !roles.includes(admin.role)) {
    return { ok: false, status: 403, error: "Insufficient admin role" };
  }
  return { ok: true, admin };
}
