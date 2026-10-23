import { ROLE_LABELS } from "@/lib/rbac/matrix";
import type { Role } from "@/types";
import type { TenantMemberSnapshot } from "@/lib/admin/types";

export const MEMBER_ACTIONS = ["change_role", "disable", "enable", "remove"] as const;

export type MemberAction = (typeof MEMBER_ACTIONS)[number];

export const MEMBER_ROLES = [
  "owner",
  "broker",
  "team_lead",
  "agent",
  "assistant",
  "accountant",
] as const satisfies readonly Role[];

export interface MemberActionOption {
  action: MemberAction;
  label: string;
  description: string;
  destructive?: boolean;
  role?: Role;
}

function signingInOwners(members: TenantMemberSnapshot[]) {
  return members.filter((member) => member.role === "owner" && member.status !== "disabled");
}

export function memberActions(
  members: TenantMemberSnapshot[],
  memberId: string,
): MemberActionOption[] {
  const member = members.find((row) => row.id === memberId);
  if (!member) return [];
  const onlyOwner =
    member.role === "owner" &&
    member.status !== "disabled" &&
    signingInOwners(members).length <= 1;
  const options: MemberActionOption[] = [];

  if (member.status === "disabled") {
    options.push({
      action: "enable",
      label: "Enable",
      description: "Let this user sign in again.",
    });
  } else if (!onlyOwner) {
    options.push({
      action: "disable",
      label: "Disable",
      description: "Block sign-in. They stay on the organization.",
      destructive: true,
    });
  }

  for (const role of MEMBER_ROLES) {
    if (role === member.role) continue;
    if (onlyOwner) continue;
    options.push({
      action: "change_role",
      role,
      label: ROLE_LABELS[role],
      description: `Set this user's role to ${ROLE_LABELS[role]}.`,
    });
  }

  if (!onlyOwner) {
    options.push({
      action: "remove",
      label: "Remove",
      description: "Take this user off the organization.",
      destructive: true,
    });
  }

  return options;
}

export function projectMemberAction(
  members: TenantMemberSnapshot[],
  memberId: string,
  action: MemberAction,
  role?: Role,
): { members: TenantMemberSnapshot[]; summary: string } {
  const member = members.find((row) => row.id === memberId);
  if (!member) throw new Error("User not found");
  const allowed = memberActions(members, memberId).some(
    (option) => option.action === action && (action !== "change_role" || option.role === role),
  );
  if (!allowed) throw new Error("That action is not available for this user.");

  if (action === "remove") {
    return {
      members: members.filter((row) => row.id !== memberId),
      summary: `Removed ${member.name} from the organization.`,
    };
  }

  const next = members.map((row) => ({ ...row }));
  const target = next.find((row) => row.id === memberId);
  if (!target) throw new Error("User not found");

  if (action === "change_role") {
    if (!role) throw new Error("Choose a role.");
    target.role = role;
    return { members: next, summary: `Changed ${member.name} to ${ROLE_LABELS[role]}.` };
  }
  if (action === "disable") {
    target.status = "disabled";
    return { members: next, summary: `Disabled ${member.name}. They cannot sign in.` };
  }
  target.status = "active";
  return { members: next, summary: `Enabled ${member.name}.` };
}
