"use client";

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

export default function AppSettingsMembersPage() {
  const { user, org, members, inviteMember } = useAppSession();
  if (!user || !org) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Team members</h2>
          <p className="text-sm text-[var(--muted)]">
            {members.length} seat{members.length === 1 ? "" : "s"} in {org.name}.
            Team objects are out of scope — this is a flat workspace roster.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <Card className="divide-y divide-[var(--border)] p-0 overflow-hidden">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={member.name} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-medium">{member.name}</p>
                <p className="truncate text-xs text-[var(--muted)]">{member.email}</p>
              </div>
            </div>
            <Badge>{ROLE_LABELS[member.role]}</Badge>
          </div>
        ))}
        {members.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            No members yet.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
