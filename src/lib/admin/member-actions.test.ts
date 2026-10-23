import { describe, expect, it } from "vitest";
import { memberActions, projectMemberAction } from "@/lib/admin/member-actions";
import type { TenantMemberSnapshot } from "@/lib/admin/types";

function member(patch: Partial<TenantMemberSnapshot>): TenantMemberSnapshot {
  return {
    id: "agent",
    name: "Noah Reed",
    email: "agent@certified.local",
    role: "agent",
    status: "active",
    ...patch,
  };
}

const owner = member({ id: "owner", name: "Ava North", email: "owner@certified.local", role: "owner" });
const agent = member({});

describe("user management actions", () => {
  it("lets an operator change, disable, or remove a teammate", () => {
    const labels = memberActions([owner, agent], agent.id).map((option) => option.label);
    expect(labels).toEqual([
      "Disable",
      "Owner",
      "Broker",
      "Team Lead",
      "Assistant / ISA",
      "Accountant",
      "Remove",
    ]);
  });

  it("keeps the only owner in place", () => {
    expect(memberActions([owner], owner.id)).toEqual([]);
    expect(() => projectMemberAction([owner], owner.id, "disable")).toThrow(/not available/);
    expect(() => projectMemberAction([owner], owner.id, "remove")).toThrow(/not available/);
    expect(() => projectMemberAction([owner], owner.id, "change_role", "agent")).toThrow(/not available/);
  });

  it("changes a role, disables sign-in, and removes the user", () => {
    const changed = projectMemberAction([owner, agent], agent.id, "change_role", "broker");
    expect(changed.members.find((row) => row.id === "agent")?.role).toBe("broker");
    expect(changed.summary).toContain("Broker");

    const disabled = projectMemberAction(changed.members, agent.id, "disable");
    expect(disabled.members.find((row) => row.id === "agent")?.status).toBe("disabled");

    const enabled = projectMemberAction(disabled.members, agent.id, "enable");
    expect(enabled.members.find((row) => row.id === "agent")?.status).toBe("active");
    expect(memberActions(enabled.members, agent.id).some((option) => option.action === "enable")).toBe(false);

    const removed = projectMemberAction(enabled.members, agent.id, "remove");
    expect(removed.members.map((row) => row.id)).toEqual(["owner"]);
  });

  it("allows one of two owners to be demoted", () => {
    const second = member({ id: "owner-2", name: "Mia Patel", role: "owner" });
    const demoted = projectMemberAction([owner, second], second.id, "change_role", "team_lead");
    expect(demoted.members.find((row) => row.id === "owner-2")?.role).toBe("team_lead");
  });
});
