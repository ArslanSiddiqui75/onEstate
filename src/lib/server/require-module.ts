import { NextResponse } from "next/server";
import { hasModuleAccess } from "@/lib/access";
import type { AccessLevel, ModuleId, PlanId, Role } from "@/types";
import type { RequestProfile } from "@/lib/server/request-profile";

const ROLES: Role[] = [
  "owner",
  "broker",
  "team_lead",
  "agent",
  "assistant",
  "accountant",
];
const PLANS: PlanId[] = ["solo", "team", "enterprise"];

function asRole(value: string): Role | null {
  return ROLES.includes(value as Role) ? (value as Role) : null;
}

function asPlan(value: string | undefined): PlanId {
  return PLANS.includes(value as PlanId) ? (value as PlanId) : "solo";
}

export function profileCanAccess(
  profile: Pick<RequestProfile, "role" | "plan" | "moduleAccess">,
  module: ModuleId,
  required: AccessLevel,
): boolean {
  const role = asRole(profile.role);
  if (!role) return false;
  return hasModuleAccess(
    { role, moduleAccess: profile.moduleAccess },
    asPlan(profile.plan),
    module,
    required,
  );
}

/** Admin-suspended, cancelled and unpaid workspaces keep billing access only. */
const BLOCKED_WORKSPACE_STATUSES = new Set(["paused", "canceled", "unpaid", "incomplete_expired"]);

export function workspaceBlocked(profile: Pick<RequestProfile, "subscriptionStatus">): boolean {
  return Boolean(profile.subscriptionStatus && BLOCKED_WORKSPACE_STATUSES.has(profile.subscriptionStatus));
}

export function forbiddenIfNoModule(
  profile: RequestProfile,
  module: ModuleId,
  required: AccessLevel,
): NextResponse | null {
  if (module !== "billing" && workspaceBlocked(profile)) {
    return NextResponse.json(
      { error: "This workspace is paused. Update billing or contact support to continue." },
      { status: 402 },
    );
  }
  if (profileCanAccess(profile, module, required)) return null;
  return NextResponse.json(
    { error: "You do not have access to this action" },
    { status: 403 },
  );
}

/**
 * Changing a plan or opening the card portal moves money, so a `billing: true`
 * override on another role is not enough: only the owner or accountant may act.
 */
export function forbiddenUnlessBillingAdmin(profile: RequestProfile): NextResponse | null {
  const denied = forbiddenIfNoModule(profile, "billing", "view");
  if (denied) return denied;
  if (profile.role === "owner" || profile.role === "accountant") return null;
  return NextResponse.json(
    { error: "Only the owner or accountant can change billing." },
    { status: 403 },
  );
}

export function forbiddenIfNoAnyModule(
  profile: RequestProfile,
  checks: Array<[ModuleId, AccessLevel]>,
): NextResponse | null {
  if (workspaceBlocked(profile) && !checks.some(([module]) => module === "billing")) {
    return NextResponse.json(
      { error: "This workspace is paused. Update billing or contact support to continue." },
      { status: 402 },
    );
  }
  if (checks.some(([module, required]) => profileCanAccess(profile, module, required))) {
    return null;
  }
  return NextResponse.json(
    { error: "You do not have access to this action" },
    { status: 403 },
  );
}
