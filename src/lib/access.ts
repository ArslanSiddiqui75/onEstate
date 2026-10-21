import type { AccessLevel, ModuleId, PlanId, Role } from "@/types";
import { getRoleAccess, canAccess } from "@/lib/rbac/matrix";
import { planIncludesModule, PLAN_FEATURE_FLAGS } from "@/lib/plans/catalog";

export function resolveAccess(
  role: Role,
  plan: PlanId,
  module: ModuleId,
): AccessLevel {
  if (!planIncludesModule(plan, module)) return "none";
  return getRoleAccess(role, module);
}

export function hasModuleAccess(
  role: Role,
  plan: PlanId,
  module: ModuleId,
  required: AccessLevel = "view",
): boolean {
  return canAccess(resolveAccess(role, plan, module), required);
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
