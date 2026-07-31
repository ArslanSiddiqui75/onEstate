"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useAdminSession } from "@/lib/admin/session";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TBody, TD, TH, THead, TR, TableShell, EmptyRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/rbac/matrix";

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
      })),
    );
    const q = query.trim().toLowerCase();
    return flat
      .filter((u) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.orgName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.email.localeCompare(b.email));
  }, [registry.tenants, query]);

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <Input
          className="pl-9"
          placeholder="Search name, email, organization…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <TableShell>
        <Table>
          <THead>
            <TR>
              <TH>User</TH>
              <TH>Organization</TH>
              <TH>Role</TH>
              <TH>Member status</TH>
              <TH>Tenant status</TH>
              <TH>Last seen</TH>
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
                <TD>{ROLE_LABELS[user.role]}</TD>
                <TD>
                  <Badge
                    tone={
                      user.status === "active"
                        ? "success"
                        : user.status === "invited"
                          ? "accent"
                          : "neutral"
                    }
                    className="capitalize"
                  >
                    {user.status}
                  </Badge>
                </TD>
                <TD>
                  <Badge className="capitalize">{user.orgStatus.replace("_", " ")}</Badge>
                </TD>
                <TD className="text-xs text-[var(--muted)]">
                  {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString() : "—"}
                </TD>
              </TR>
            ))}
            {users.length === 0 ? (
              <EmptyRow colSpan={6}>No users in the platform registry yet.</EmptyRow>
            ) : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
