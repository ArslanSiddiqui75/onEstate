"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { UserManageMenu } from "@/components/admin/user-manage";
import { Table, TBody, TD, TH, THead, TR, TableShell, EmptyRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/rbac/matrix";

function sentenceStatus(status: string) {
  const label = status.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function AdminUsersPage() {
  const { registry } = useAdminSession();
  const [query, setQuery] = useState("");

  const users = useMemo(() => {
    const flat = registry.tenants.flatMap((tenant) =>
      tenant.members.map((member) => ({
        ...member,
        orgId: tenant.id,
        orgName: tenant.name,
        orgStatus: tenant.lifecycleStatus,
        market: tenant.market,
        members: tenant.members,
      })),
    );
    const q = query.trim().toLowerCase();
    return flat
      .filter((user) => {
        if (!q) return true;
        return (
          user.name.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q) ||
          user.orgName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.email.localeCompare(b.email));
  }, [registry.tenants, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            className="pl-9"
            placeholder="Search name, email, organization…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="text-sm font-medium text-[var(--muted)]">
          {users.length} user{users.length === 1 ? "" : "s"}
        </p>
      </div>

      <TableShell>
        <Table className="table-filterable">
          <THead>
            <TR>
              <TH>User</TH>
              <TH>Organization</TH>
              <TH>Role</TH>
              <TH>Member status</TH>
              <TH>Tenant status</TH>
              <TH>Last seen</TH>
              <TH className="text-right">Manage</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((user) => (
              <TR key={`${user.orgId}_${user.id}_${user.email}`}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-[var(--muted)]">{user.email}</p>
                    </div>
                  </div>
                </TD>
                <TD>
                  <Link href={`/admin/organizations/${user.orgId}`} className="hover:underline">
                    {user.orgName}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">{user.market.toUpperCase()}</p>
                </TD>
                <TD data-user-role={`${user.orgId}:${user.id}`}>{ROLE_LABELS[user.role]}</TD>
                <TD>
                  <Badge
                    tone={
                      user.status === "active"
                        ? "success"
                        : user.status === "invited"
                          ? "accent"
                          : "neutral"
                    }
                    data-user-status={`${user.orgId}:${user.id}`}
                  >
                    {sentenceStatus(user.status)}
                  </Badge>
                </TD>
                <TD>
                  <Badge
                    tone={
                      user.orgStatus === "active"
                        ? "success"
                        : user.orgStatus === "past_due"
                          ? "danger"
                          : user.orgStatus === "suspended"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {sentenceStatus(user.orgStatus)}
                  </Badge>
                </TD>
                <TD className="text-xs text-[var(--muted)]">
                  {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString() : "—"}
                </TD>
                <TD className="text-right">
                  <UserManageMenu
                    orgId={user.orgId}
                    orgName={user.orgName}
                    member={user}
                    members={user.members}
                  />
                </TD>
              </TR>
            ))}
            {users.length === 0 ? (
              <EmptyRow colSpan={7}>No users in the platform registry yet.</EmptyRow>
            ) : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
