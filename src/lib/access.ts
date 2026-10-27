import type { AccessLevel, ModuleGrants, ModuleId, PlanId, Role } from "@/types";
import { getRoleAccess, canAccess } from "@/lib/rbac/matrix";
import { planIncludesModule, PLAN_FEATURE_FLAGS } from "@/lib/plans/catalog";

export const MODULE_IDS: readonly ModuleId[] = [
  "crm",
  "listings",
  "transactions",
  "website",
  "social",
  "billing",
];

export type AccessActor = Role | { role: Role; moduleAccess?: ModuleGrants | null };

export function canManageModuleAccess(role: Role) {
  return role === "owner" || role === "broker";
}

export function readModuleGrants(value: unknown): ModuleGrants | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const grants: ModuleGrants = {};
  for (const id of MODULE_IDS) {
    if (source[id] === true || source[id] === false) grants[id] = source[id];
  }
  return Object.keys(grants).length ? grants : undefined;
}

/** Store only the differences from the role. Turning a module back matches the role. */
export function nextModuleGrants(
  role: Role,
  current: ModuleGrants | undefined,
  module: ModuleId,
  enabled: boolean,
): ModuleGrants | undefined {
  const roleAllows = getRoleAccess(role, module) !== "none";
  const next: ModuleGrants = { ...current };
  if (enabled === roleAllows) delete next[module];
  else next[module] = enabled;
  return Object.keys(next).length ? next : undefined;
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
  if (override === false) return "none";
  if (override === true) return base === "none" ? "view" : base;
  return base;
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
