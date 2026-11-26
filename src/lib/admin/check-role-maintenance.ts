import {
  isRoleUnderMaintenance,
  loadLocalMaintenance,
  maintenanceBlockError,
  normalizeMaintenanceSettings,
  type RoleMaintenanceSettings,
} from "@/lib/admin/maintenance";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Role } from "@/types";

async function fetchHostedMaintenance(): Promise<RoleMaintenanceSettings> {
  const res = await fetch("/api/maintenance", { cache: "no-store" });
  if (!res.ok) return loadLocalMaintenance();
  const json = (await res.json().catch(() => null)) as
    | { enabled?: boolean; roles?: Role[]; source?: string }
    | null;
  if (!json) return loadLocalMaintenance();
  if (json.source === "local") return loadLocalMaintenance();
  return normalizeMaintenanceSettings(json);
}

export async function assertRoleNotUnderMaintenance(role: Role | string | null | undefined) {
  const settings = isSupabaseConfigured()
    ? await fetchHostedMaintenance()
    : loadLocalMaintenance();
  if (isRoleUnderMaintenance(settings, role)) {
    throw maintenanceBlockError();
  }
}
