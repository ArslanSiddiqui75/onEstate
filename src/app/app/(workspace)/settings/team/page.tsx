"use client";

import { MenuSelect } from "@/components/ui/select";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppSession } from "@/lib/app/session";
import { ROLE_LABELS } from "@/lib/rbac/matrix";
import { canInvite } from "@/lib/rbac/invites";
import { loadGroups, saveGroups, type OfficeGroup } from "@/lib/team/groups";
import { InviteModal } from "@/components/team/invite-modal";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { Role } from "@/types";

const ASSIGNABLE: Role[] = ["broker", "team_lead", "agent", "assistant", "accountant"];
const MANAGERS = new Set(["owner", "broker", "team_lead"]);

const selectClass =
  "h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm sm:w-44";

export default function TeamSettingsPage() {
  const {
    user,
    org,
    members,
    persistence,
    getAuthToken,
    inviteMember,
    updateMemberRole,
    removeMember,
  } = useAppSession();
  const [groups, setGroups] = useState<OfficeGroup[]>([]);
  const [canManageGroups, setCanManageGroups] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const loadGroupsForOrg = useCallback(async () => {
    if (!org || !user) return;
    if (persistence !== "supabase") {
      setGroups(loadGroups(org.id));
      setCanManageGroups(MANAGERS.has(user.role));
      return;
    }
    const token = await getAuthToken();
    const res = await fetch("/api/teams", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const json = (await res.json()) as { teams?: OfficeGroup[]; canManage?: boolean };
    setGroups(json.teams || []);
    setCanManageGroups(Boolean(json.canManage));
  }, [getAuthToken, org, persistence, user]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadGroupsForOrg();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadGroupsForOrg]);

  if (!user || !org) return null;

  const isOwner = user.role === "owner";

  async function saveGroupChange(next: OfficeGroup[]) {
    if (!org) return;
    setGroups(next);
    if (persistence !== "supabase") saveGroups(org.id, next);
  }

  async function patchGroup(id: string, body: Record<string, string>) {
    if (persistence !== "supabase") {
      const next = groups.map((group) => {
        if (group.id !== id) return group;
        if (body.addMemberId && !group.memberIds.includes(body.addMemberId)) {
          return { ...group, memberIds: [...group.memberIds, body.addMemberId] };
        }
        if (body.removeMemberId) {
          return { ...group, memberIds: group.memberIds.filter((memberId) => memberId !== body.removeMemberId) };
        }
        return group;
      });
      await saveGroupChange(next);
      return;
    }
    const token = await getAuthToken();
    const res = await fetch(`/api/teams/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(json?.error || "Update failed");
    }
    await loadGroupsForOrg();
  }

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
                            .then(async () => {
                              setConfirmId(null);
                              await patchGroupCleanup(member.id);
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

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Groups</h2>
          <p className="text-sm text-[var(--muted)]">Optional office groups. The CRM stays shared across the workspace.</p>
        </div>
        {canManageGroups ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                setBusy(true);
                try {
                  const name = groupName.trim();
                  if (name.length < 2) throw new Error("Enter a group name");
                  if (persistence !== "supabase") {
                    await saveGroupChange([
                      ...groups,
                      { id: `group_${crypto.randomUUID()}`, name, memberIds: [] },
                    ]);
                  } else {
                    const token = await getAuthToken();
                    const res = await fetch("/api/teams", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({ name }),
                    });
                    if (!res.ok) {
                      const json = (await res.json().catch(() => null)) as { error?: string } | null;
                      throw new Error(json?.error || "Could not create the group");
                    }
                    await loadGroupsForOrg();
                  }
                  setGroupName("");
                  toast.success("Group created");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not create the group");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <Input
              className="sm:max-w-xs"
              placeholder="Group name"
              aria-label="Group name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Add group"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-[var(--muted)]">Only the owner, broker, or team lead can change groups.</p>
        )}
        {groups.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No groups yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.id} className="space-y-3 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{group.name}</h3>
                  <p className="text-xs text-[var(--muted)]">
                    {group.memberIds.length} {group.memberIds.length === 1 ? "person" : "people"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.memberIds.length === 0 ? <p className="text-sm text-[var(--muted)]">No one in this group.</p> : null}
                  {group.memberIds.map((id) => {
                    const member = members.find((item) => item.id === id);
                    return (
                      <Badge key={id}>
                        {member?.name || "Former member"}
                        {canManageGroups ? (
                          <button
                            type="button"
                            className="ml-1"
                            aria-label={`Remove ${member?.name || "member"} from ${group.name}`}
                            onClick={() =>
                              void patchGroup(group.id, { removeMemberId: id }).catch((err) =>
                                toast.error(err instanceof Error ? err.message : "Could not update the group"),
                              )
                            }
                          >
                            ×
                          </button>
                        ) : null}
                      </Badge>
                    );
                  })}
                </div>
                {canManageGroups ? (
                  <MenuSelect
                    aria-label={`Add someone to ${group.name}`}
                    className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm"
                    defaultValue=""
                    onChange={(event) => {
                      const id = event.target.value;
                      event.target.value = "";
                      if (!id) return;
                      void patchGroup(group.id, { addMemberId: id })
                        .then(() => toast.success("Added to the group"))
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Could not update the group"));
                    }}
                  >
                    <option value="">Add someone…</option>
                    {members
                      .filter((member) => !group.memberIds.includes(member.id))
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                  </MenuSelect>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  async function patchGroupCleanup(memberId: string) {
    const next = groups.map((group) => ({
      ...group,
      memberIds: group.memberIds.filter((id) => id !== memberId),
    }));
    if (persistence !== "supabase") {
      await saveGroupChange(next);
      return;
    }
    await Promise.all(
      groups
        .filter((group) => group.memberIds.includes(memberId))
        .map((group) => patchGroup(group.id, { removeMemberId: memberId })),
    );
  }
}
