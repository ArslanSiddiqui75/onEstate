"use client";

import { MenuSelect } from "@/components/ui/select";

import { Suspense } from "react";
import { useAppSession } from "@/lib/app/session";
import { hasModuleAccess } from "@/lib/access";
import { ClientLinks } from "@/components/agency/client-links";
import { useAgencyBook } from "@/components/agency/use-agency-book";
import { LockedModule } from "@/components/ui/locked-module";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { addAppointment, createAppointment, setAppointmentStatus } from "@/lib/agency/book";
import type { Appointment } from "@/lib/agency/types";
import { formatWhen } from "@/lib/lettings/format";
import { useModuleSection } from "@/lib/nav/module-section";
import { SectionPills } from "@/components/ui/section-pills";
import { copyToClipboard } from "@/lib/utils";

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function dayLabel(iso: string, us: boolean) {
  return new Intl.DateTimeFormat(us ? "en-US" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export default function DiaryPage() {
  return (
    <Suspense fallback={null}>
      <DiaryDesk />
    </Suspense>
  );
}

function DiaryDesk() {
  const { user, org, market } = useAppSession();
  const { book, commit } = useAgencyBook(org?.id ?? "workspace");
  const [section, setSection] = useModuleSection("section", ["board", "links"] as const, "board");

  if (!user || !org) return null;
  const us = market === "us";
  const bookName = us ? "calendar" : "diary";
  if (!hasModuleAccess(user, org.plan, "crm", "view")) {
    return (
      <LockedModule
        title={us ? "Calendar locked" : "Diary locked"}
        reason={`The ${bookName} follows CRM access.`}
        role={user.role}
        moduleAccess={user.moduleAccess}
        plan={org.plan}
      />
    );
  }

  const canEdit = hasModuleAccess(user, org.plan, "crm", "edit");
  const viewingWord = us ? "showing" : "viewing";
  const sorted = [...book.appointments].sort((a, b) => a.at.localeCompare(b.at));
  const days = [...new Set(sorted.map((item) => dayKey(item.at)))];

  const bookLabel = us ? "Calendar" : "Diary";

  return (
    <div className="space-y-5">
      <SectionPills
        label={bookLabel}
        value={section}
        onChange={setSection}
        items={[
          { id: "board", label: bookLabel },
          { id: "links", label: "Client links" },
        ]}
      />
      {section === "links" ? (
        <ClientLinks book={book} commit={commit} canEdit={canEdit} us={us} />
      ) : (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-[var(--muted)]">
          {us ? "Showings" : "Viewings"} and valuations for the office. A client can request a slot from the public link, and confirming it keeps it on this board.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            const url = `${window.location.origin}/book/${book.bookingToken}`;
            void copyToClipboard(url).then((ok) =>
              ok ? toast.success("Booking link copied") : toast.info(`Copy this link: ${url}`),
            );
          }}
        >
          Copy booking link
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <div className="space-y-4">
          {days.map((day) => (
            <Card key={day}>
              <h2 className="font-semibold">{dayLabel(`${day}T12:00:00.000Z`, us)}</h2>
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

        {canEdit ? (
        <div className="space-y-4">
            <Card>
              <h2 className="font-semibold">Add to the {bookName}</h2>
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
                    toast.success(us ? "Added to the calendar" : "Added to the diary");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not add that.");
                  }
                }}
              >
                <Input name="clientName" placeholder="Client" aria-label="Client" required />
                <Input name="address" placeholder="Address" aria-label="Address" required />
                <Input name="at" type="datetime-local" aria-label="Time" required />
                <MenuSelect name="kind" aria-label="Kind" className="h-11 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm" defaultValue="viewing">
                  <option value="viewing">{market === "us" ? "Showing" : "Viewing"}</option>
                  <option value="valuation">Valuation</option>
                </MenuSelect>
                <Input name="notes" placeholder="Note" aria-label="Note" />
                <Button type="submit">Add</Button>
              </form>
            </Card>
        </div>
        ) : null}
      </div>
    </div>
      )}
    </div>
  );
}
