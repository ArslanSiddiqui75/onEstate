import type { AccessLevel, ModuleGrants, ModuleGrantValue, ModuleId, PlanId, Role } from "@/types";
import { accessRank, getRoleAccess, canAccess } from "@/lib/rbac/matrix";
import { planIncludesModule, PLAN_FEATURE_FLAGS } from "@/lib/plans/catalog";

export const MODULE_IDS: readonly ModuleId[] = [
  "crm",
  "listings",
  "transactions",
  "website",
  "social",
  "billing",
];

export const ACCESS_LEVELS: readonly AccessLevel[] = ["none", "view", "edit", "full"];

export type AccessActor = Role | { role: Role; moduleAccess?: ModuleGrants | null };

export function canManageModuleAccess(role: Role) {
  return role === "owner" || role === "broker";
}

function isAccessLevel(value: unknown): value is AccessLevel {
  return value === "none" || value === "view" || value === "edit" || value === "full";
}

/**
 * Cap a requested level so personal grants never exceed the role matrix ceiling.
 * Roles with `none` can only be unlocked to `view` (same as the legacy boolean true).
 */
export function clampAccessToRoleCeiling(
  roleLevel: AccessLevel,
  requested: AccessLevel,
): AccessLevel {
  if (requested === "none") return "none";
  if (roleLevel === "none") return "view";
  return accessRank(requested) <= accessRank(roleLevel) ? requested : roleLevel;
}

/** Levels an owner/broker may assign for this seat + module. */
export function allowedAccessLevels(role: Role, module: ModuleId): AccessLevel[] {
  const ceiling = getRoleAccess(role, module);
  return ACCESS_LEVELS.filter((level) => {
    if (level === "none") return true;
    if (ceiling === "none") return level === "view";
    return accessRank(level) <= accessRank(ceiling);
  });
}

export function readModuleGrants(value: unknown): ModuleGrants | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const grants: ModuleGrants = {};
  for (const id of MODULE_IDS) {
    const raw = source[id];
    if (raw === true || raw === false) grants[id] = raw;
    else if (isAccessLevel(raw)) grants[id] = raw;
  }
  return Object.keys(grants).length ? grants : undefined;
}

/** Normalize a grant into an access level for UI selects. */
export function grantToAccessLevel(
  role: Role,
  module: ModuleId,
  grant: ModuleGrantValue | undefined,
): AccessLevel {
  const base = getRoleAccess(role, module);
  if (grant === undefined) return base;
  if (grant === false) return "none";
  if (grant === true) return base === "none" ? "view" : base;
  return clampAccessToRoleCeiling(base, grant);
}

/**
 * Store only differences from the role default.
 * Passing the role's own level clears the override for that module.
 * Requested levels are clamped to the role ceiling.
 */
export function nextModuleGrants(
  role: Role,
  current: ModuleGrants | undefined,
  module: ModuleId,
  levelOrEnabled: AccessLevel | boolean,
): ModuleGrants | undefined {
  const roleLevel = getRoleAccess(role, module);
  const rawLevel: AccessLevel =
    typeof levelOrEnabled === "boolean"
      ? levelOrEnabled
        ? roleLevel === "none"
          ? "view"
          : roleLevel
        : "none"
      : levelOrEnabled;
  const nextLevel = clampAccessToRoleCeiling(roleLevel, rawLevel);

  const next: ModuleGrants = { ...current };
  if (nextLevel === roleLevel) delete next[module];
  else if (nextLevel === "none" && roleLevel !== "none") next[module] = false;
  else if (nextLevel !== "none" && roleLevel === "none" && nextLevel === "view") next[module] = true;
  else next[module] = nextLevel;

  return Object.keys(next).length ? grantsOrUndefined(next) : undefined;
}

function grantsOrUndefined(grants: ModuleGrants): ModuleGrants | undefined {
  return Object.keys(grants).length ? grants : undefined;
}

function actorRole(actor: AccessActor): Role {
  return typeof actor === "string" ? actor : actor.role;
}

function actorGrants(actor: AccessActor): ModuleGrants | undefined {
  return typeof actor === "string" ? undefined : actor.moduleAccess || undefined;
}

export function resolveAccess(
  actor: AccessActor,
  plan: PlanId,
  module: ModuleId,
): AccessLevel {
  if (!planIncludesModule(plan, module)) return "none";
  const role = actorRole(actor);
  const base = getRoleAccess(role, module);
  if (role === "owner") return base;
  const override = actorGrants(actor)?.[module];
  if (override === undefined) return base;
  if (override === false) return "none";
  if (override === true) return base === "none" ? "view" : base;
  return clampAccessToRoleCeiling(base, override);
}

export function hasModuleAccess(
  actor: AccessActor,
  plan: PlanId,
  module: ModuleId,
  required: AccessLevel = "view",
): boolean {
  return canAccess(resolveAccess(actor, plan, module), required);
}

export function hasFeature(
  plan: PlanId,
  feature: keyof (typeof PLAN_FEATURE_FLAGS)["solo"],
): boolean {
  const value = PLAN_FEATURE_FLAGS[plan]?.[feature];
  return Boolean(value);
}

export function checkSeatLimit(
  currentMemberCount: number,
  plan: PlanId,
): { allowed: boolean; maxSeats: number | null } {
  const maxSeats = PLAN_FEATURE_FLAGS[plan]?.maxSeats ?? null;
  if (maxSeats === null) return { allowed: true, maxSeats: null };
  return { allowed: currentMemberCount < maxSeats, maxSeats };
}

export function checkPortalLimit(
  currentPortalCount: number,
  plan: PlanId,
): { allowed: boolean; maxFeeds: number | null } {
  const portalFeeds = PLAN_FEATURE_FLAGS[plan]?.portalFeeds ?? null;
  if (portalFeeds === null) return { allowed: true, maxFeeds: null };
  return { allowed: currentPortalCount < portalFeeds, maxFeeds: portalFeeds };
}

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  none: "No access",
  view: "View",
  edit: "Edit",
  full: "Full",
};
