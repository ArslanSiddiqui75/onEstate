"use client";

import { useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { useAgencyBook } from "@/components/agency/use-agency-book";
import { LockedModule } from "@/components/ui/locked-module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  addAppointment,
  createAppointment,
  issuePortal,
  setAppointmentStatus,
} from "@/lib/agency/book";
import type { Appointment, PortalRole } from "@/lib/agency/types";
import { PORTAL_ROLE_LABELS } from "@/lib/agency/types";
import { formatWhen } from "@/lib/lettings/format";

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function dayLabel(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export default function DiaryPage() {
  const { user, org, market } = useAppSession();
  const { book, commit } = useAgencyBook(org?.id ?? "workspace");
  const [busy, setBusy] = useState(false);

  if (!user || !org) return null;
  if (!hasModuleAccess(user.role, org.plan, "crm", "view")) {
    return (
      <LockedModule
        title="Diary locked"
        reason="The diary follows CRM access."
        role={user.role}
        plan={org.plan}
      />
    );
  }

  const canEdit = hasModuleAccess(user.role, org.plan, "crm", "edit");
  const viewingWord = market === "us" ? "showing" : "viewing";
  const sorted = [...book.appointments].sort((a, b) => a.at.localeCompare(b.at));
  const days = [...new Set(sorted.map((item) => dayKey(item.at)))];

  async function publishPortal(portal: { token: string; role: PortalRole; name: string; address: string; listingId?: string; leadId?: string; lettingsToken?: string }) {
    const res = await fetch("/api/agency", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "register", ...portal }),
    });
    if (!res.ok) throw new Error("The public link could not be published.");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-[var(--muted)]">
          Viewings and valuations for the office. A client can request a slot from the public link, and confirming it keeps it on this board.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            const url = `${window.location.origin}/book/${book.bookingToken}`;
            void navigator.clipboard.writeText(url).then(() => toast.success("Booking link copied"));
          }}
        >
          Copy booking link
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <div className="space-y-4">
          {days.map((day) => (
            <Card key={day}>
              <h2 className="font-semibold">{dayLabel(`${day}T12:00:00.000Z`)}</h2>
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {sorted
                  .filter((item) => dayKey(item.at) === day)
                  .map((item) => (
                    <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-medium">
                          {formatWhen(item.at)} · {item.kind === "valuation" ? "Valuation" : viewingWord[0].toUpperCase() + viewingWord.slice(1)}
                        </p>
                        <p className="text-sm text-[var(--muted)]">
                          {item.clientName} · {item.address}
                        </p>
                        {item.notes ? <p className="mt-1 text-xs text-[var(--muted)]">{item.notes}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.status === "confirmed" ? "success" : item.status === "cancelled" ? "neutral" : "warning"}>
                          {item.status}
                        </Badge>
                        {canEdit && item.status === "requested" ? (
                          <Button size="sm" onClick={() => commit(setAppointmentStatus(book, item.id, "confirmed"))}>
                            Confirm
                          </Button>
                        ) : null}
                        {canEdit && item.status !== "cancelled" && item.status !== "done" ? (
                          <Button size="sm" variant="ghost" onClick={() => commit(setAppointmentStatus(book, item.id, "done"))}>
                            Done
                          </Button>
                        ) : null}
                        {canEdit && item.status !== "cancelled" ? (
                          <Button size="sm" variant="ghost" onClick={() => commit(setAppointmentStatus(book, item.id, "cancelled"))}>
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          {canEdit ? (
            <Card>
              <h2 className="font-semibold">Add to the diary</h2>
              <form
                className="mt-3 grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  try {
                    const appointment: Appointment = createAppointment({
                      bookToken: book.bookingToken,
                      kind: String(data.get("kind")) === "valuation" ? "valuation" : "viewing",
                      at: String(data.get("at") || ""),
                      clientName: String(data.get("clientName") || ""),
                      address: String(data.get("address") || ""),
                      notes: String(data.get("notes") || ""),
                    });
                    commit(addAppointment(book, appointment));
                    event.currentTarget.reset();
                    toast.success("Added to the diary");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not add that.");
                  }
                }}
              >
                <Input name="clientName" placeholder="Client" aria-label="Client" required />
                <Input name="address" placeholder="Address" aria-label="Address" required />
                <Input name="at" type="datetime-local" aria-label="Time" required />
                <select name="kind" aria-label="Kind" className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm" defaultValue="viewing">
                  <option value="viewing">{market === "us" ? "Showing" : "Viewing"}</option>
                  <option value="valuation">Valuation</option>
                </select>
                <Input name="notes" placeholder="Note" aria-label="Note" />
                <Button type="submit">Add</Button>
              </form>
            </Card>
          ) : null}

          <Card>
            <h2 className="font-semibold">Client links</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {book.portals.map((portal) => (
                <li key={portal.token} className="flex items-center justify-between gap-2">
                  <span>
                    {PORTAL_ROLE_LABELS[portal.role]} · {portal.name}
                    <span className="block text-xs text-[var(--muted)]">{portal.address}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const url = `${window.location.origin}/portal/${portal.token}`;
                      void navigator.clipboard.writeText(url).then(() => toast.success("Client link copied"));
                    }}
                  >
                    Copy
                  </Button>
                </li>
              ))}
            </ul>
            {canEdit ? (
              <form
                className="mt-4 grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  void (async () => {
                    setBusy(true);
                    try {
                      const issued = issuePortal(book, {
                        role: String(data.get("role")) as PortalRole,
                        name: String(data.get("name") || ""),
                        address: String(data.get("address") || ""),
                        lettingsToken: String(data.get("lettingsToken") || ""),
                      });
                      commit(issued.book);
                      await publishPortal(issued.portal);
                      form.reset();
                      toast.success("Client link ready");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not create that link.");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                <Input name="name" placeholder="Client name" aria-label="Client name" required />
                <Input name="address" placeholder="Address" aria-label="Address" required />
                <select name="role" aria-label="Role" className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm" defaultValue="vendor">
                  <option value="vendor">{market === "us" ? "Seller" : "Vendor"}</option>
                  <option value="buyer">Buyer</option>
                  <option value="landlord">Landlord</option>
                  <option value="tenant">{market === "us" ? "Resident" : "Tenant"}</option>
                </select>
                <Input name="lettingsToken" placeholder="Repair token, if a let" aria-label="Repair token" />
                <Button type="submit" variant="secondary" disabled={busy}>
                  Create client link
                </Button>
              </form>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
