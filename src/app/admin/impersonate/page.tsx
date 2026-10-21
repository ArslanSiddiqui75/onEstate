"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAdminSession } from "@/lib/admin/session";
import { ImpersonateButton } from "@/components/admin/impersonate-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, TableShell, EmptyRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/rbac/matrix";

export default function AdminImpersonatePage() {
  const { registry, canImpersonate } = useAdminSession();
  const [query, setQuery] = useState("");

  const users = useMemo(() => {
    const flat = registry.tenants.flatMap((tenant) =>
      tenant.members
        .filter((member) => member.status === "active")
        .map((member) => ({
          ...member,
          orgId: tenant.id,
          orgName: tenant.name,
        })),
    );
    const q = query.trim().toLowerCase();
    return flat.filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.orgName.toLowerCase().includes(q)
      );
    });
  }, [registry.tenants, query]);

  if (!canImpersonate) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Billing operators cannot impersonate tenants.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Open a brokerage workspace as an active member. A banner stays on until
        you end the session. Time-boxed to 30 minutes and audited.
      </p>
      <Input
        placeholder="Search name, email, organization…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <TableShell>
        <Table>
          <THead>
            <TR>
              <TH>User</TH>
              <TH>Organization</TH>
              <TH>Role</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {users.map((user) => (
              <TR key={`${user.orgId}_${user.id}`}>
                <TD>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-[var(--muted)]">{user.email}</p>
                </TD>
                <TD>
                  <Link href={`/admin/organizations/${user.orgId}`} className="hover:underline">
                    {user.orgName}
                  </Link>
                </TD>
                <TD>
                  <Badge>{ROLE_LABELS[user.role]}</Badge>
                </TD>
                <TD>
                  <ImpersonateButton userId={user.id} />
                </TD>
              </TR>
            ))}
            {users.length === 0 ? (
              <EmptyRow colSpan={4}>No active members to open.</EmptyRow>
            ) : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
