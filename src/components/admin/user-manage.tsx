"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { memberActions, type MemberActionOption } from "@/lib/admin/member-actions";
import { openWorkspaceAs } from "@/components/admin/impersonate-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import type { TenantMemberSnapshot } from "@/lib/admin/types";

export function UserManageMenu({
  orgId,
  orgName,
  member,
  members,
}: {
  orgId: string;
  orgName: string;
  member: TenantMemberSnapshot;
  members: TenantMemberSnapshot[];
}) {
  const router = useRouter();
  const { canManageUsers, canImpersonate, manageMember } = useAdminSession();
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<MemberActionOption | null>(null);
  const options = memberActions(members, member.id);
  const roles = options.filter((option) => option.action === "change_role");
  const routine = options.filter((option) => option.action !== "change_role" && !option.destructive);
  const destructive = options.filter((option) => option.destructive);
  const canOpen = canImpersonate && member.status === "active";
  const key = `${orgId}:${member.id}`;

  async function run(option: MemberActionOption) {
    setPending(true);
    try {
      const message = await manageMember(orgId, member.id, option.action, option.role);
      toast.success(message);
      setConfirm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this user");
    } finally {
      setPending(false);
    }
  }

  async function openAs() {
    setPending(true);
    try {
      await openWorkspaceAs(member.id);
      router.push("/app");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open this workspace");
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="text-xs"
            disabled={!canManageUsers || pending}
            data-user-manage={key}
            aria-label={`Manage ${member.name}`}
          >
            {pending ? "Working…" : "Manage"}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72" data-user-menu="">
          <DropdownMenuLabel>
            <p className="font-semibold">{member.name}</p>
            <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">
              {member.email} · {orgName}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canOpen ? (
            <DropdownMenuItem disabled={pending} data-user-action="open" onSelect={() => void openAs()}>
              <span>
                <span className="block font-medium">Open as</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  Enter their workspace for 30 minutes. This is audited.
                </span>
              </span>
            </DropdownMenuItem>
          ) : null}
          {routine.map((option) => (
            <DropdownMenuItem
              key={option.action}
              disabled={pending}
              data-user-action={option.action}
              onSelect={() => void run(option)}
            >
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{option.description}</span>
              </span>
            </DropdownMenuItem>
          ))}
          {roles.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-user-action="change_role">Change role</DropdownMenuSubTrigger>
              <DropdownMenuSubContent data-user-roles="">
                {roles.map((option) => (
                  <DropdownMenuItem
                    key={option.role}
                    disabled={pending}
                    data-user-action="change_role"
                    data-role={option.role}
                    onSelect={() => void run(option)}
                  >
                    <span className="font-medium">{option.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          {options.length === 0 ? (
            <DropdownMenuItem disabled>
              This is the only owner. Add another owner before changing them.
            </DropdownMenuItem>
          ) : null}
          {destructive.length > 0 ? <DropdownMenuSeparator /> : null}
          {destructive.map((option) => (
            <DropdownMenuItem
              key={option.action}
              destructive
              disabled={pending}
              data-user-action={option.action}
              onSelect={() => setConfirm(option)}
            >
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="mt-0.5 block text-xs opacity-80">{option.description}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && !pending && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.label}</DialogTitle>
            <DialogDescription>
              {confirm?.description} This applies to {member.name} at {orgName}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirm(null)}>
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !confirm}
              data-user-confirm=""
              onClick={() => confirm && void run(confirm)}
            >
              {pending ? "Working…" : confirm?.label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
