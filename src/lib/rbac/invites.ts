import type { Role } from "@/types";

// Server-enforced invite matrix (QA audit P1-1):
// - Owner and Broker may invite any role except another Owner.
// - Team Lead may invite Agents and Assistants.
// - Agent, Assistant, and Accountant may not invite anyone.
const INVITE_MATRIX: Record<Role, Role[]> = {
  owner: ["broker", "team_lead", "agent", "assistant", "accountant"],
  broker: ["broker", "team_lead", "agent", "assistant", "accountant"],
  team_lead: ["agent", "assistant"],
  agent: [],
  assistant: [],
  accountant: [],
};

export function allowedInviteRoles(callerRole: Role): Role[] {
  return INVITE_MATRIX[callerRole] || [];
}

export function canInvite(callerRole: Role): boolean {
  return allowedInviteRoles(callerRole).length > 0;
}

export function canInviteRole(callerRole: Role, targetRole: Role): boolean {
  return allowedInviteRoles(callerRole).includes(targetRole);
}
