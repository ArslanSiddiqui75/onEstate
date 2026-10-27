"use client";

import { MenuSelect } from "@/components/ui/select";

import { useState } from "react";
import Link from "next/link";
import { useAppSession } from "@/lib/app/session";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { canInvite } from "@/lib/rbac/invites";
import { InviteModal } from "@/components/team/invite-modal";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import type { Role } from "@/types";

const ASSIGNABLE: Role[] = ["broker", "team_lead", "agent", "assistant", "accountant"];

const selectClass =
  "h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm sm:w-44";

export default function TeamSettingsPage() {
  const {
    user,
    org,
    members,
    inviteMember,
    updateMemberRole,
    removeMember,
  } = useAppSession();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (!user || !org) return null;

  const isOwner = user.role === "owner";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-[var(--muted)]">
          {members.length} {members.length === 1 ? "person" : "people"} in {org.name}. The owner changes roles and removes people.
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
              onInvite={inviteMember}
            />
          ) : null}
        </div>
      </div>

      <Card className="divide-y divide-[var(--border)] overflow-hidden p-0">
        {members.map((member) => {
          const manageable = isOwner && member.id !== user.id && member.role !== "owner";
          return (
            <div key={member.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={member.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {member.name}
                    {member.id === user.id ? <span className="text-[var(--muted)]"> · You</span> : null}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">{member.email || "Invite pending"}</p>
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
                        .then(() => toast.success(`${member.name} is now ${ROLE_LABELS[role]}`))
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Could not change that role"));
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
                            .catch((err) => toast.error(err instanceof Error ? err.message : "Could not remove that person"));
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
          );
        })}
        {members.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">No one is on the team yet.</p>
        ) : null}
      </Card>
    </div>
  );
}
