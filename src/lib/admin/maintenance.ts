import type { Role } from "@/types";

export const MAINTENANCE_MESSAGE =
  "Maintenance mode is on. Please try again later.";

export const WORKSPACE_ROLES: Role[] = [
  "owner",
  "broker",
  "team_lead",
  "agent",
  "assistant",
  "accountant",
];

export interface RoleMaintenanceSettings {
  /** Master switch. When off, nobody is blocked even if roles are selected. */
  enabled: boolean;
  /** Workspace roles currently under maintenance. */
  roles: Role[];
  updatedAt: string;
  updatedBy?: string;
}

const LOCAL_KEY = "certified_platform_maintenance_v1";
export const PLATFORM_SETTING_KEY = "role_maintenance";

export const EMPTY_MAINTENANCE: RoleMaintenanceSettings = {
  enabled: false,
  roles: [],
  updatedAt: new Date(0).toISOString(),
};

export function normalizeMaintenanceSettings(
  raw: unknown,
): RoleMaintenanceSettings {
  const row =
    raw && typeof raw === "object" ? (raw as Partial<RoleMaintenanceSettings>) : {};
  const allowed = new Set<string>(WORKSPACE_ROLES);
  const roles = Array.isArray(row.roles)
    ? [...new Set(row.roles.filter((role): role is Role => allowed.has(String(role))))]
    : [];
  return {
    enabled: row.enabled === true,
    roles,
    updatedAt:
      typeof row.updatedAt === "string" && row.updatedAt
        ? row.updatedAt
        : new Date().toISOString(),
    updatedBy:
      typeof row.updatedBy === "string" && row.updatedBy.trim()
        ? row.updatedBy.trim()
        : undefined,
  };
}

export function isRoleUnderMaintenance(
  settings: RoleMaintenanceSettings,
  role: Role | string | null | undefined,
): boolean {
  if (!settings.enabled || !role) return false;
  return settings.roles.includes(role as Role);
}

export function loadLocalMaintenance(): RoleMaintenanceSettings {
  if (typeof window === "undefined") return { ...EMPTY_MAINTENANCE };
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return { ...EMPTY_MAINTENANCE };
    return normalizeMaintenanceSettings(JSON.parse(raw));
  } catch {
    return { ...EMPTY_MAINTENANCE };
  }
}

export function saveLocalMaintenance(settings: RoleMaintenanceSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    LOCAL_KEY,
    JSON.stringify(normalizeMaintenanceSettings(settings)),
  );
}

/** Public message used when a blocked role tries to sign in or stay signed in. */
export function maintenanceBlockError(): Error {
  return new Error(MAINTENANCE_MESSAGE);
}
