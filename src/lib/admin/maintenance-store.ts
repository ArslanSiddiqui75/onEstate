import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPTY_MAINTENANCE,
  PLATFORM_SETTING_KEY,
  normalizeMaintenanceSettings,
  type RoleMaintenanceSettings,
} from "@/lib/admin/maintenance";

type ServiceClient = SupabaseClient;

export async function readMaintenanceSettings(
  supabase: ServiceClient | null,
): Promise<RoleMaintenanceSettings> {
  if (!supabase) return { ...EMPTY_MAINTENANCE };
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value, updated_at, updated_by")
    .eq("key", PLATFORM_SETTING_KEY)
    .maybeSingle();
  if (error || !data) return { ...EMPTY_MAINTENANCE };
  return normalizeMaintenanceSettings({
    ...(data.value as object),
    updatedAt: data.updated_at,
    updatedBy: data.updated_by,
  });
}

export async function writeMaintenanceSettings(
  supabase: ServiceClient,
  settings: RoleMaintenanceSettings,
  actorEmail: string,
): Promise<RoleMaintenanceSettings> {
  const next = normalizeMaintenanceSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  });
  const { error } = await supabase.from("platform_settings").upsert(
    {
      key: PLATFORM_SETTING_KEY,
      value: {
        enabled: next.enabled,
        roles: next.roles,
        updatedAt: next.updatedAt,
        updatedBy: next.updatedBy,
      },
      updated_at: next.updatedAt,
      updated_by: actorEmail,
    },
    { onConflict: "key" },
  );
  if (error) throw error;
  return next;
}
