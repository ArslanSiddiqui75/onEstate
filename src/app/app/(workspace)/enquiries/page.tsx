"use client";

import { useState } from "react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { LockedModule } from "@/components/ui/locked-module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { LeadType } from "@/types";

const SOURCES = ["Phone", "Website", "Portal", "Walk-in", "Referral"];

export default function EnquiriesPage() {
  const { user, org, leads, listings, market, addLead } = useAppSession();
  const [busy, setBusy] = useState(false);

  if (!user || !org) return null;
  if (!hasModuleAccess(user.role, org.plan, "crm", "view")) {
    return (
      <LockedModule
        title="Enquiries locked"
        reason="The enquiry centre follows CRM access."
        role={user.role}
        plan={org.plan}
      />
    );
  }

  const canEdit = hasModuleAccess(user.role, org.plan, "crm", "edit");
  const marketLeads = leads.filter((lead) => lead.market === market && !lead.archivedAt);
  const marketListings = listings.filter((listing) => listing.market === market && !listing.archivedAt);
  const open = marketLeads.filter((lead) => lead.stage !== "won" && lead.stage !== "lost");

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-[var(--muted)]">
        Every enquiry in one list. Saving one writes a CRM lead with the source, the property they asked about, and the next step.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Open</p>
          <p className="mt-1 text-2xl font-semibold">{open.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">All</p>
          <p className="mt-1 text-2xl font-semibold">{marketLeads.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">With a property</p>
          <p className="mt-1 text-2xl font-semibold">{marketLeads.filter((lead) => lead.listingId).length}</p>
        </Card>
      </div>

      {canEdit ? (
        <Card>
          <h2 className="font-semibold">New enquiry</h2>
          <form
            className="mt-3 grid gap-2 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              const email = String(data.get("email") || "").trim();
              const phone = String(data.get("phone") || "").trim();
              if (!email && !phone) {
                toast.error("Add an email or a phone number.");
                return;
              }
              void (async () => {
                setBusy(true);
                try {
                  const listingId = String(data.get("listingId") || "");
                  await addLead({
                    name: String(data.get("name") || ""),
                    email,
                    phone,
                    type: String(data.get("type") || "buyer") as LeadType,
                    stage: "new",
                    score: 0,
                    assignedTo: user.id,
                    market,
                    source: String(data.get("source") || "Phone"),
                    listingId: listingId || undefined,
                    nextAction: String(data.get("nextAction") || "") || undefined,
                    notes: String(data.get("interest") || "") || undefined,
                  });
                  form.reset();
                  toast.success("Enquiry saved to the CRM");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not save that enquiry.");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <Input name="name" placeholder="Name" aria-label="Name" required />
            <select name="type" aria-label="Type" className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm" defaultValue="buyer">
              <option value="buyer">Buyer</option>
              <option value="seller">{market === "us" ? "Seller" : "Vendor"}</option>
              <option value="landlord">Landlord</option>
              <option value="tenant">{market === "us" ? "Resident" : "Tenant"}</option>
            </select>
            <Input name="email" type="email" placeholder="Email" aria-label="Email" />
            <Input name="phone" placeholder="Phone" aria-label="Phone" />
            <select name="source" aria-label="Source" className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm" defaultValue="Phone">
              {SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <select name="listingId" aria-label="Property" className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm" defaultValue="">
              <option value="">Property interest</option>
              {marketListings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.title}
                </option>
              ))}
            </select>
            <Input name="interest" placeholder="What they asked about" aria-label="Property interest" className="sm:col-span-2" />
            <Input name="nextAction" placeholder="Next step" aria-label="Next step" className="sm:col-span-2" />
            <Button type="submit" disabled={busy} className="sm:col-span-2">
              Save enquiry
            </Button>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="pb-2 font-semibold">Enquiry</th>
              <th className="pb-2 font-semibold">Source</th>
              <th className="pb-2 font-semibold">Property</th>
              <th className="pb-2 font-semibold">Next step</th>
            </tr>
          </thead>
          <tbody>
            {marketLeads.map((lead) => {
              const listing = marketListings.find((item) => item.id === lead.listingId);
              return (
                <tr key={lead.id} className="border-t border-[var(--border)]">
                  <td className="py-3 pr-3">
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-xs capitalize text-[var(--muted)]">
                      {lead.type} · {lead.stage}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge>{lead.source || "Manual"}</Badge>
                  </td>
                  <td className="py-3 pr-3">{listing?.title || lead.notes || "—"}</td>
                  <td className="py-3">{lead.nextAction || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {marketLeads.length === 0 ? <p className="py-8 text-center text-sm text-[var(--muted)]">No enquiries yet.</p> : null}
      </Card>
    </div>
  );
}
