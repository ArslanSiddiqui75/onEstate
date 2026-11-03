"use client";

import { MenuSelect } from "@/components/ui/select";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppSession } from "@/lib/app/session";
import { MODULE_LABELS, ROLE_LABELS } from "@/lib/rbac/matrix";
import { canInvite } from "@/lib/rbac/invites";
import {
  ACCESS_LEVEL_LABELS,
  allowedAccessLevels,
  canManageModuleAccess,
  grantToAccessLevel,
  hasModuleAccess,
  MODULE_IDS,
  nextModuleGrants,
} from "@/lib/access";
import { InviteModal } from "@/components/team/invite-modal";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import type { AccessLevel, ModuleId, Role } from "@/types";

const ASSIGNABLE: Role[] = ["broker", "team_lead", "agent", "assistant", "accountant"];

const selectClass =
  "h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm sm:w-44";

const levelSelectClass =
  "h-9 w-full min-w-[7.5rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs";

export default function TeamSettingsPage() {
  const {
    user,
    org,
    members,
    inviteMember,
    updateMemberRole,
    updateMemberAccess,
    removeMember,
  } = useAppSession();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [view, setView] = useState<"people" | "permissions">("people");

  const editableMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          member.id !== user?.id &&
          member.role !== "owner" &&
          !member.id.startsWith("invite_"),
      ),
    [members, user?.id],
  );

  if (!user || !org) return null;

  const isOwner = user.role === "owner";
  const canEditAccess = canManageModuleAccess(user.role);

  function setModuleLevel(
    memberId: string,
    role: Role,
    current: (typeof members)[number]["moduleAccess"],
    module: ModuleId,
    level: AccessLevel,
  ) {
    const next = nextModuleGrants(role, current, module, level);
    void updateMemberAccess(memberId, next)
      .then(() =>
        toast.success(
          `${MODULE_LABELS[module]} → ${ACCESS_LEVEL_LABELS[level]}`,
        ),
      )
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Could not change that access"),
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-[var(--muted)]">
          {members.length} {members.length === 1 ? "person" : "people"} in {org.name}.
          {isOwner
            ? " As owner you set roles and exact module permissions for every seat — including agency staff."
            : canEditAccess
              ? " Brokers can adjust module permissions for seats."
              : " Ask the owner if you need different module access."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href="/app/settings">Back to settings</Link>
          </Button>
          {canInvite(user.role) ? (
            <InviteModal
              plan={org.plan}
              currentMemberCount={members.length}
              callerRole={user.role}
              canOpenBilling={hasModuleAccess(user, org.plan, "billing", "view")}
              onInvite={inviteMember}
            />
          ) : null}
        </div>
      </div>

      <div className="segmented w-fit" role="tablist" aria-label="Team views">
        <button type="button" data-active={view === "people"} onClick={() => setView("people")}>
          People
        </button>
        <button
          type="button"
          data-active={view === "permissions"}
          onClick={() => setView("permissions")}
          disabled={!canEditAccess}
        >
          Permissions
        </button>
      </div>

      {view === "people" ? (
        <Card className="divide-y divide-[var(--border)] overflow-hidden p-0">
          {members.map((member) => {
            const manageable = isOwner && member.id !== user.id && member.role !== "owner";
            return (
              <div key={member.id} className="flex flex-col gap-3 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={member.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {member.name}
                        {member.id === user.id ? (
                          <span className="text-[var(--muted)]"> · You</span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {member.email || "Invite pending"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {manageable ? (
                      <MenuSelect
                        aria-label={`Role for ${member.name}`}
                        className={selectClass}
                        value={member.role}
                        onChange={(event) => {
                          const role = event.target.value as Role;
                          void updateMemberRole(member.id, role)
                            .then(() =>
                              toast.success(`${member.name} is now ${ROLE_LABELS[role]}`),
                            )
                            .catch((err) =>
                              toast.error(
                                err instanceof Error ? err.message : "Could not change that role",
                              ),
                            );
                        }}
                      >
                        {ASSIGNABLE.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </MenuSelect>
                    ) : (
                      <Badge>{ROLE_LABELS[member.role]}</Badge>
                    )}
                    {manageable ? (
                      confirmId === member.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              void removeMember(member.id)
                                .then(() => {
                                  setConfirmId(null);
                                  toast.success(`${member.name} removed`);
                                })
                                .catch((err) =>
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : "Could not remove that person",
                                  ),
                                );
                            }}
                          >
                            Remove
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(member.id)}>
                          Remove
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {members.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              No one is on the team yet.
            </p>
          ) : null}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="font-semibold">Module permissions</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Choose None, View, Edit, or Full for each person and module. Role defaults apply until
              you change a cell. Agency and brokerage seats use the same matrix.
            </p>
          </div>
          {editableMembers.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              Invite someone first, then set their module access here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-left">
                    <th className="sticky left-0 z-10 bg-[var(--surface-muted)] px-4 py-3 font-semibold">
                      Person
                    </th>
                    {MODULE_IDS.map((module) => (
                      <th key={module} className="px-3 py-3 font-semibold whitespace-nowrap">
                        {MODULE_LABELS[module]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editableMembers.map((member) => (
                    <tr key={member.id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-3">
                        <div className="flex min-w-[10rem] items-center gap-2">
                          <Avatar name={member.name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{member.name}</p>
                            <p className="truncate text-xs text-[var(--muted)]">
                              {ROLE_LABELS[member.role]}
                            </p>
                          </div>
                        </div>
                      </td>
                      {MODULE_IDS.map((module) => {
                        const level = grantToAccessLevel(
                          member.role,
                          module,
                          member.moduleAccess?.[module],
                        );
                        const planAllows = hasModuleAccess(
                          { role: "owner" },
                          org.plan,
                          module,
                          "view",
                        );
                        return (
                          <td key={module} className="px-3 py-2 align-middle">
                            <MenuSelect
                              aria-label={`${member.name} · ${MODULE_LABELS[module]}`}
                              className={levelSelectClass}
                              value={level}
                              disabled={!canEditAccess || !planAllows}
                              onChange={(event) =>
                                setModuleLevel(
                                  member.id,
                                  member.role,
                                  member.moduleAccess,
                                  module,
                                  event.target.value as AccessLevel,
                                )
                              }
                            >
                              {allowedAccessLevels(member.role, module).map((option) => (
                                <option key={option} value={option}>
                                  {ACCESS_LEVEL_LABELS[option]}
                                </option>
                              ))}
                            </MenuSelect>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--muted)]">
            Your owner seat always keeps full workspace control and is not editable here.
          </div>
        </Card>
      )}
    </div>
  );
}
