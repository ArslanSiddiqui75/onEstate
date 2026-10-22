"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { addContractor, addKey, insuranceExpired, moveKey, propertyById, setRightToRent, setTenancyStage } from "@/lib/lettings/book";
import { formatDay } from "@/lib/lettings/format";
import type { LettingsBook, RightToRent, TenancyStage } from "@/lib/lettings/types";

const STAGES: { id: TenancyStage; label: string }[] = [
  { id: "marketing", label: "Marketing" },
  { id: "let_agreed", label: "Let agreed" },
  { id: "move_in", label: "Move-in" },
  { id: "active", label: "Active" },
  { id: "move_out", label: "Move-out" },
];

const RENT_CHECKS: { id: RightToRent; label: string }[] = [
  { id: "clear", label: "Clear" },
  { id: "pending", label: "Pending" },
  { id: "expired", label: "Expired" },
];

const selectClass =
  "h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm";

export function PeopleTab({
  book,
  commit,
  canEdit,
}: {
  book: LettingsBook;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
}) {
  const [keyHolder, setKeyHolder] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      {book.properties.map((property) => (
        <Card key={property.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{property.address}</h3>
              <p className="text-xs text-[var(--muted)]">{property.city}</p>
            </div>
            {canEdit ? (
              <select
                aria-label={`Tenancy stage for ${property.address}`}
                className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm"
                value={property.tenancyStage || "active"}
                onChange={(event) => commit(setTenancyStage(book, property.id, event.target.value as TenancyStage))}
              >
                {STAGES.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </select>
            ) : (
              <Badge>{STAGES.find((stage) => stage.id === property.tenancyStage)?.label || "Active"}</Badge>
            )}
          </div>
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {property.rooms.map((room) => (
              <li key={room.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{room.tenantName}</p>
                  <p className="text-xs text-[var(--muted)]">{room.name}</p>
                </div>
                {canEdit ? (
                  <label className="text-xs font-medium text-[var(--muted)]">
                    Right to Rent
                    <select
                      aria-label={`Right to Rent for ${room.tenantName}`}
                      className={`${selectClass} mt-1 min-w-36`}
                      value={room.rightToRent || "pending"}
                      onChange={(event) =>
                        commit(setRightToRent(book, property.id, room.id, event.target.value as RightToRent))
                      }
                    >
                      {RENT_CHECKS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <Badge tone={room.rightToRent === "clear" ? "success" : room.rightToRent === "expired" ? "danger" : "warning"}>
                    Right to Rent {room.rightToRent || "pending"}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Card>
        <h3 className="font-semibold">Contractors</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">A repair cannot be booked to a contractor whose insurance has expired.</p>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {(book.contractors ?? []).map((contractor) => {
            const expired = insuranceExpired(contractor);
            return (
              <li key={contractor.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  {contractor.name}
                  <span className="block text-xs text-[var(--muted)]">
                    {contractor.trade} · insurance {formatDay(`${contractor.insuranceExpires}T12:00:00.000Z`)}
                  </span>
                </span>
                <Badge tone={expired ? "danger" : "success"}>{expired ? "Insurance expired" : "Covered"}</Badge>
              </li>
            );
          })}
        </ul>
        {canEdit ? (
          <form
            className="mt-3 grid gap-2 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              try {
                commit(
                  addContractor(book, {
                    name: String(data.get("name") || ""),
                    trade: String(data.get("trade") || ""),
                    insuranceExpires: String(data.get("insuranceExpires") || ""),
                    phone: String(data.get("phone") || ""),
                  }),
                );
                event.currentTarget.reset();
                toast.success("Contractor added");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not add that contractor.");
              }
            }}
          >
            <Input name="name" placeholder="Name" aria-label="Contractor name" required />
            <Input name="trade" placeholder="Trade" aria-label="Trade" />
            <Input name="insuranceExpires" type="date" aria-label="Insurance expiry" required />
            <Input name="phone" placeholder="Phone" aria-label="Phone" />
            <Button type="submit" variant="secondary" className="sm:col-span-2">
              Add contractor
            </Button>
          </form>
        ) : null}
      </Card>

      <Card>
        <h3 className="font-semibold">Keys</h3>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {(book.keys ?? []).map((key) => {
            const property = propertyById(book, key.propertyId);
            return (
              <li key={key.id} className="flex flex-wrap items-end justify-between gap-3 py-3 text-sm">
                <span>
                  {key.label}
                  <span className="block text-xs text-[var(--muted)]">
                    {property?.address} · held by {key.heldBy}
                  </span>
                </span>
                {canEdit ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      try {
                        commit(moveKey(book, key.id, keyHolder[key.id] || ""));
                        toast.success("Key log updated");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not update the key log.");
                      }
                    }}
                  >
                    <Input
                      aria-label={`Who holds ${key.label}`}
                      value={keyHolder[key.id] ?? ""}
                      placeholder="Now held by"
                      onChange={(event) => setKeyHolder((prev) => ({ ...prev, [key.id]: event.target.value }))}
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      Log
                    </Button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
        {canEdit ? (
          <form
            className="mt-3 grid gap-2 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              try {
                commit(
                  addKey(book, {
                    propertyId: String(data.get("propertyId") || ""),
                    label: String(data.get("label") || ""),
                    heldBy: String(data.get("heldBy") || ""),
                  }),
                );
                event.currentTarget.reset();
                toast.success("Keys logged");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not log those keys.");
              }
            }}
          >
            <select name="propertyId" aria-label="Property" className={selectClass} defaultValue={book.properties[0]?.id}>
              {book.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.address}
                </option>
              ))}
            </select>
            <Input name="label" placeholder="Which keys" aria-label="Which keys" required />
            <Input name="heldBy" placeholder="Held by" aria-label="Held by" required />
            <Button type="submit" variant="secondary" className="sm:col-span-3">
              Add keys
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
