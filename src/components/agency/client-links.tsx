"use client";

import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MenuSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { issuePortal } from "@/lib/agency/book";
import { copyClientPortal, openClientPortal, publishPortalRecord } from "@/lib/agency/publish-client";
import type { AgencyBook, PortalRecord, PortalRole } from "@/lib/agency/types";
import { PORTAL_ROLE_LABELS } from "@/lib/agency/types";

function roleLabel(role: PortalRole, us: boolean) {
  if (us && role === "vendor") return "Seller";
  if (us && role === "tenant") return "Resident";
  return PORTAL_ROLE_LABELS[role];
}

export function ClientLinks({
  book,
  commit,
  canEdit,
  us,
}: {
  book: AgencyBook;
  commit: (next: AgencyBook) => void;
  canEdit: boolean;
  us: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<PortalRole>("vendor");
  const letRole = role === "landlord" || role === "tenant";
  const portals = book.portals;

  async function copy(portal: PortalRecord) {
    try {
      const copied = await copyClientPortal(portal);
      if (copied) toast.success("Client link copied");
      else toast.error("Could not copy that link.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That link is not live yet.");
    }
  }

  async function open(portal: PortalRecord) {
    try {
      await openClientPortal(portal);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That link is not live yet.");
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="overflow-hidden p-0">
        <div className="flex items-end justify-between gap-3 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-semibold tracking-tight">Issued</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {portals.length === 0
                ? "Nobody has a page yet."
                : `${portals.length} ${portals.length === 1 ? "client" : "clients"}`}
            </p>
          </div>
        </div>
        {portals.length === 0 ? (
          <p className="border-t border-[var(--border)] px-5 py-8 text-sm text-[var(--muted)] sm:px-6">
            Create a link and send it to the {us ? "seller" : "vendor"}, buyer, landlord, or {us ? "resident" : "tenant"}. They open it without an account.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {portals.map((portal) => (
              <li key={portal.token} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{roleLabel(portal.role, us)}</Badge>
                    <p className="font-medium">{portal.name}</p>
                  </div>
                  <p className="mt-1.5 text-sm text-[var(--muted)]">{portal.address}</p>
                  {portal.lettingsToken ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">Repair page · {portal.lettingsToken}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => void open(portal)}>
                    <ExternalLink />
                    Open
                  </Button>
                  <Button type="button" size="sm" onClick={() => void copy(portal)}>
                    <Copy />
                    Copy
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canEdit ? (
        <Card>
          <h2 className="font-semibold tracking-tight">New client link</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            They get a private page for this address. Approvals, viewings, and offers come back to the office.
          </p>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              void (async () => {
                setBusy(true);
                try {
                  const issued = issuePortal(book, {
                    role,
                    name: String(data.get("name") || ""),
                    address: String(data.get("address") || ""),
                    lettingsToken: letRole ? String(data.get("lettingsToken") || "") : "",
                  });
                  await publishPortalRecord(issued.portal);
                  commit(issued.book);
                  form.reset();
                  setRole("vendor");
                  toast.success("Client link ready");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not create that link.");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <label className="block text-sm font-medium">
              Client name
              <Input className="mt-1.5" name="name" autoComplete="name" required />
            </label>
            <label className="block text-sm font-medium">
              Address
              <Input className="mt-1.5" name="address" required />
            </label>
            <label className="block text-sm font-medium">
              Role
              <MenuSelect
                name="role"
                aria-label="Role"
                className="mt-1.5"
                value={role}
                onChange={(event) => setRole(event.target.value as PortalRole)}
              >
                <option value="vendor">{us ? "Seller" : "Vendor"}</option>
                <option value="buyer">Buyer</option>
                <option value="landlord">Landlord</option>
                <option value="tenant">{us ? "Resident" : "Tenant"}</option>
              </MenuSelect>
            </label>
            {letRole ? (
              <label className="block text-sm font-medium">
                Repair link
                <Input className="mt-1.5" name="lettingsToken" placeholder="oak-road" aria-label="Repair link" />
                <span className="mt-1.5 block text-xs font-normal text-[var(--muted)]">
                  Optional. Paste the token from the repair page for this let.
                </span>
              </label>
            ) : null}
            <Button type="submit" disabled={busy}>
              Create client link
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
