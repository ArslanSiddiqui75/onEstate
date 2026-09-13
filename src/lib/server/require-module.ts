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
  profile: Pick<RequestProfile, "role" | "plan">,
  module: ModuleId,
  required: AccessLevel,
): boolean {
  const role = asRole(profile.role);
  if (!role) return false;
  return hasModuleAccess(role, asPlan(profile.plan), module, required);
}

export function forbiddenIfNoModule(
  profile: RequestProfile,
  module: ModuleId,
  required: AccessLevel,
): NextResponse | null {
  if (profileCanAccess(profile, module, required)) return null;
  return NextResponse.json(
    { error: "You do not have access to this action" },
    { status: 403 },
  );
}

export function forbiddenIfNoAnyModule(
  profile: RequestProfile,
  checks: Array<[ModuleId, AccessLevel]>,
): NextResponse | null {
  if (checks.some(([module, required]) => profileCanAccess(profile, module, required))) {
    return null;
  }
  return NextResponse.json(
    { error: "You do not have access to this action" },
    { status: 403 },
  );
}
