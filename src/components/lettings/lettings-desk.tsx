"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { QrImage } from "@/components/lettings/qr-image";
import {
  acknowledgeRepair,
  addCompliance,
  addContractor,
  addInspection,
  addKey,
  addProperty,
  addRepair,
  addRoom,
  applyInbox,
  attachProof,
  bookTradesperson,
  buildDisputePack,
  createRepair,
  insuranceExpired,
  markFixed,
  moveKey,
  placeLabel,
  propertyById,
  roomById,
  seedBook,
  setRentStatus,
  setRightToRent,
  setTenancyStage,
  tryConfirmRepair,
} from "@/lib/lettings/book";
import { clockLabel, formatDay, formatWhen, gbp, marketPosition, rentIncreaseNote } from "@/lib/lettings/format";
import { emergencyGuidance } from "@/lib/lettings/triage";
import { loadBook, saveBook } from "@/lib/lettings/store";
import type {
  ComplianceKind,
  InspectionKind,
  Jurisdiction,
  LettingsBook,
  LettingsInbox,
  Repair,
  RepairChannel,
  RentStatus,
  RightToRent,
  TenancyStage,
} from "@/lib/lettings/types";
import {
  CHANNEL_LABELS,
  COMPLIANCE_LABELS,
  INSPECTION_LABELS,
  JURISDICTION_LABELS,
  REPAIR_STAGES,
  URGENCY_LABELS,
} from "@/lib/lettings/types";
import { cn } from "@/lib/utils";

const selectClass =
  "h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm";

const STAGES: { id: TenancyStage; label: string }[] = [
  { id: "marketing", label: "Marketing" },
  { id: "let_agreed", label: "Let agreed" },
  { id: "move_in", label: "Move-in" },
  { id: "active", label: "Active" },
  { id: "move_out", label: "Move-out" },
];

const RENT_STATUS: { id: RentStatus; label: string }[] = [
  { id: "received", label: "Received" },
  { id: "due", label: "Due" },
  { id: "late", label: "Late" },
];

type Section = "repairs" | "rent" | "properties";

function useLettingsBook(orgId: string) {
  const [book, setBook] = useState<LettingsBook>(() => seedBook());
  useEffect(() => {
    let cancel = false;
    const refresh = () => {
      void (async () => {
        let next = loadBook(orgId);
        try {
          const res = await fetch("/api/lettings/inbox");
          if (res.ok) {
            const json = (await res.json()) as Partial<LettingsInbox>;
            const merged = applyInbox(next, {
              repairs: json.repairs ?? [],
              confirmations: json.confirmations ?? [],
              inspectionSigns: json.inspectionSigns ?? [],
            });
            if (merged.book !== next) {
              saveBook(orgId, merged.book);
              next = merged.book;
            }
          }
        } catch {
          // The desk still has this browser's copy.
        }
        if (!cancel) setBook(next);
      })();
    };
    const id = window.setTimeout(refresh, 0);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      cancel = true;
      window.clearTimeout(id);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [orgId]);
  return {
    book,
    commit(next: LettingsBook) {
      saveBook(orgId, next);
      setBook(next);
    },
  };
}

function fail(err: unknown) {
  toast.error(err instanceof Error ? err.message : "Could not save that.");
}

async function readPhoto(file: File | undefined) {
  if (!file || file.size === 0) return undefined;
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo.");
  if (file.size > 120_000) return { name: file.name };
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.readAsDataURL(file);
  });
  return { name: file.name, dataUrl };
}

function urgencyTone(repair: Repair) {
  if (repair.urgency === "emergency") return "danger" as const;
  if (repair.urgency === "urgent") return "warning" as const;
  return "neutral" as const;
}

function stageLabel(status: Repair["status"]) {
  return REPAIR_STAGES.find((stage) => stage.id === status)?.label ?? status;
}

function repairWhen(repair: Repair) {
  if (repair.status === "tenant_confirmed") return "Signed off";
  if (repair.status === "fixed") return "Waiting for the tenant";
  if (repair.status === "booked" && repair.appointmentAt) return formatWhen(repair.appointmentAt);
  return `Reply ${clockLabel(repair.replyBy)}`;
}

function rentPhrase(rentPcm: number, marketRentPcm: number) {
  const gap = marketPosition(rentPcm, marketRentPcm);
  if (marketRentPcm <= 0) return `${gbp(rentPcm)} pcm`;
  if (gap.direction === "level") return `${gbp(rentPcm)} pcm · in line with ${gbp(marketRentPcm)}`;
  return `${gbp(rentPcm)} pcm · ${gap.pct}% ${gap.direction} ${gbp(marketRentPcm)}`;
}

function propertySignal(book: LettingsBook, propertyId: string) {
  const certificates = book.compliance
    .filter((item) => item.propertyId === propertyId)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const overdue = certificates.find((item) => item.status === "overdue");
  if (overdue) return `${overdue.title} overdue`;
  const emergency = book.repairs.find(
    (repair) => repair.propertyId === propertyId && repair.urgency === "emergency" && repair.status !== "tenant_confirmed",
  );
  if (emergency) return "Emergency repair";
  const due = certificates.find((item) => item.status === "due");
  if (due) return `${due.title} · ${formatDay(due.dueAt)}`;
  const open = book.repairs.filter(
    (repair) => repair.propertyId === propertyId && repair.status !== "tenant_confirmed" && repair.status !== "fixed",
  ).length;
  if (open > 0) return open === 1 ? "1 open repair" : `${open} open repairs`;
  return "Up to date";
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value).then(
    () => toast.success("Link copied"),
    () => toast.info("Select the link and copy it."),
  );
}

function downloadPack(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
  toast.success("Dispute pack downloaded");
}

function printPack(html: string) {
  const popup = window.open("", "_blank");
  if (!popup) {
    toast.error("Allow pop-ups to print, or download the pack.");
    return;
  }
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Switch({ value, onChange }: { value: Section; onChange: (next: Section) => void }) {
  const items: { id: Section; label: string }[] = [
    { id: "repairs", label: "Repairs" },
    { id: "rent", label: "Rent" },
    { id: "properties", label: "Properties" },
  ];
  return (
    <div className="inline-flex max-w-full rounded-full border border-[var(--border)] bg-[var(--surface-muted)] p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-semibold",
            value === item.id
              ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[0_1px_2px_rgba(20,17,15,0.08)]"
              : "text-[var(--muted)]",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)]">{children}</div>;
}

export function LettingsDesk({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { book, commit } = useLettingsBook(orgId);
  const [section, setSection] = useState<Section>("repairs");
  const [addLet, setAddLet] = useState(false);

  return (
    <div className="space-y-5">
      <Switch value={section} onChange={setSection} />
      {section === "repairs" ? (
        <RepairsView book={book} commit={commit} canEdit={canEdit} onAddLet={() => setAddLet(true)} />
      ) : null}
      {section === "rent" ? <RentView book={book} commit={commit} canEdit={canEdit} onAddLet={() => setAddLet(true)} /> : null}
      {section === "properties" ? (
        <PropertiesView book={book} commit={commit} canEdit={canEdit} onAddLet={() => setAddLet(true)} />
      ) : null}
      {canEdit ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              commit(seedBook());
              toast.success("Sample book restored.");
            }}
          >
            Restore sample book
          </Button>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">You can read this desk. Changing it needs edit access.</p>
      )}
      {addLet ? <AddLetDialog book={book} commit={commit} onClose={() => setAddLet(false)} /> : null}
    </div>
  );
}

function RepairsView({
  book,
  commit,
  canEdit,
  onAddLet,
}: {
  book: LettingsBook;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
  onAddLet: () => void;
}) {
  const [repairId, setRepairId] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const expired = (book.contractors ?? []).filter((contractor) => insuranceExpired(contractor));
  const ranked = useMemo(
    () =>
      [...book.repairs].sort((a, b) => {
        const weight = { emergency: 0, urgent: 1, routine: 2 };
        return weight[a.urgency] - weight[b.urgency] || b.createdAt.localeCompare(a.createdAt);
      }),
    [book.repairs],
  );
  const closed = ranked.filter((repair) => repair.status === "tenant_confirmed").length;
  const visible = ranked.filter((repair) => showClosed || repair.status !== "tenant_confirmed");
  const openCount = ranked.length - closed;
  const selected = book.repairs.find((repair) => repair.id === repairId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          {openCount === 0 ? "Nothing open." : openCount === 1 ? "1 open repair." : `${openCount} open repairs.`}
          {closed > 0 ? (
            <button type="button" className="ml-2 font-semibold text-[var(--accent)]" onClick={() => setShowClosed((value) => !value)}>
              {showClosed ? "Hide closed" : `Show ${closed} closed`}
            </button>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setLinkOpen(true)} disabled={book.properties.length === 0}>
            Tenant link
          </Button>
          <Button type="button" onClick={() => setLogOpen(true)} disabled={!canEdit || book.properties.length === 0}>
            Log a report
          </Button>
        </div>
      </div>
      {expired.length > 0 ? (
        <Alert tone="danger">
          {expired.map((contractor) => contractor.name).join(", ")} cannot be booked until their insurance is updated. Open
          Properties to fix the register.
        </Alert>
      ) : null}
      {book.properties.length === 0 ? (
        <EmptyState
          title="No lets yet"
          description="Add a property before a tenant can report a repair."
          action={
            canEdit ? (
              <Button type="button" onClick={onAddLet}>
                Add a let
              </Button>
            ) : null
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No open repairs"
          description="A tenant report, or a message you log, shows up here."
          action={
            canEdit ? (
              <Button type="button" onClick={() => setLogOpen(true)}>
                Log a report
              </Button>
            ) : null
          }
        />
      ) : (
        <Panel>
          <ul>
            {visible.map((repair) => (
              <li key={repair.id} className="border-b border-[var(--border)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setRepairId(repair.id)}
                  className="flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-[var(--surface-muted)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{repair.title}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {placeLabel(book, repair.propertyId, repair.roomId)} · {repair.reference}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                    <Badge tone={urgencyTone(repair)}>{URGENCY_LABELS[repair.urgency]}</Badge>
                    <span className="text-xs text-[var(--muted)]">{repairWhen(repair)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {selected ? (
        <RepairDialog
          book={book}
          repair={selected}
          commit={commit}
          canEdit={canEdit}
          onClose={() => setRepairId(null)}
        />
      ) : null}
      {logOpen ? (
        <LogReportDialog
          book={book}
          commit={commit}
          onClose={() => setLogOpen(false)}
          onFiled={(id) => {
            setLogOpen(false);
            setRepairId(id);
          }}
        />
      ) : null}
      {linkOpen ? <TenantLinkDialog book={book} onClose={() => setLinkOpen(false)} /> : null}
    </div>
  );
}

function RepairDialog({
  book,
  repair,
  commit,
  canEdit,
  onClose,
}: {
  book: LettingsBook;
  repair: Repair;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [more, setMore] = useState<"book" | "fix" | null>(null);
  const [history, setHistory] = useState(false);
  const property = propertyById(book, repair.propertyId);
  const tenancy = property ? roomById(property, repair.roomId) : null;
  const showBook =
    canEdit &&
    repair.status !== "fixed" &&
    repair.status !== "tenant_confirmed" &&
    repair.status !== "reported" &&
    (repair.status === "acknowledged" || more === "book") &&
    more !== "fix";
  const showFix =
    canEdit &&
    repair.status !== "fixed" &&
    repair.status !== "tenant_confirmed" &&
    repair.status !== "reported" &&
    (repair.status === "booked" || more === "fix") &&
    more !== "book";

  useEffect(() => {
    setMore(null);
    setHistory(false);
  }, [repair.id, repair.status]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{repair.title}</DialogTitle>
          <DialogDescription>
            {property?.address}
            {tenancy ? ` · ${tenancy.name} · ${tenancy.tenantName}` : ""} · {repair.reference}
          </DialogDescription>
        </DialogHeader>
        <p className="mt-4 text-sm leading-relaxed">{repair.body}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={urgencyTone(repair)}>{URGENCY_LABELS[repair.urgency]}</Badge>
          <Badge>{stageLabel(repair.status)}</Badge>
          <Badge>{CHANNEL_LABELS[repair.channel]}</Badge>
        </div>
        {repair.emergency ? (
          <div className="mt-4">
            <Alert tone="danger">
              <span className="font-semibold">{emergencyGuidance(repair.emergency).title}. </span>
              {emergencyGuidance(repair.emergency).body}
            </Alert>
          </div>
        ) : null}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Reply by</dt>
            <dd className="font-medium">{formatWhen(repair.replyBy)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Fix by</dt>
            <dd className="font-medium">{formatWhen(repair.fixBy)}</dd>
          </div>
        </dl>
        {repair.tradesperson ? (
          <p className="mt-3 text-sm">
            {repair.tradesperson}
            {repair.appointmentAt ? ` · ${formatWhen(repair.appointmentAt)}` : ""}
          </p>
        ) : null}
        {repair.photos.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {repair.photos.map((photo) => (
              <li key={photo.id}>
                {photo.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.dataUrl} alt={photo.name} className="h-16 w-16 rounded-xl object-cover" />
                ) : (
                  <span className="inline-flex rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--muted)]">
                    {photo.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {canEdit && repair.status === "reported" ? (
          <Button
            className="mt-4 w-full"
            onClick={() => {
              try {
                commit(acknowledgeRepair(book, repair.id, "Office acknowledged the report."));
                toast.success("Acknowledged");
              } catch (err) {
                fail(err);
              }
            }}
          >
            Acknowledge
          </Button>
        ) : null}

        {showBook ? (
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              try {
                commit(
                  bookTradesperson(book, repair.id, {
                    name: String(data.get("tradesperson") || ""),
                    when: String(data.get("when") || ""),
                    note: String(data.get("note") || ""),
                  }),
                );
                toast.success("Visit booked");
              } catch (err) {
                fail(err);
              }
            }}
          >
            <Field label="Tradesperson">
              <Input name="tradesperson" list={`contractor-names-${repair.id}`} required />
            </Field>
            <datalist id={`contractor-names-${repair.id}`}>
              {(book.contractors ?? []).map((contractor) => (
                <option key={contractor.id} value={contractor.name} />
              ))}
            </datalist>
            <Field label="When">
              <Input name="when" type="datetime-local" required />
            </Field>
            <Field label="Note">
              <Input name="note" />
            </Field>
            <Button type="submit">Book the visit</Button>
          </form>
        ) : null}

        {showFix ? (
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void (async () => {
                try {
                  const photo = await readPhoto((data.get("photo") as File | null) || undefined);
                  commit(markFixed(book, repair.id, String(data.get("note") || ""), photo));
                  toast.success("Marked fixed");
                } catch (err) {
                  fail(err);
                }
              })();
            }}
          >
            <Field label="What was done">
              <Input name="note" />
            </Field>
            <Field label="Photo">
              <input name="photo" type="file" accept="image/*" className="text-sm" />
            </Field>
            <Button type="submit" variant="secondary">
              Mark fixed
            </Button>
          </form>
        ) : null}

        {canEdit && repair.status === "fixed" ? (
          <Button
            className="mt-4 w-full"
            onClick={() => {
              commit(tryConfirmRepair(book, repair.reference, tenancy?.tenantName || "Tenant", new Date().toISOString()));
              toast.success("Tenant sign-off recorded");
            }}
          >
            Record tenant sign-off
          </Button>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {canEdit && repair.status === "acknowledged" && more !== "fix" ? (
            <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={() => setMore("fix")}>
              It is already fixed
            </button>
          ) : null}
          {canEdit && repair.status === "acknowledged" && more === "fix" ? (
            <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={() => setMore(null)}>
              Book a visit instead
            </button>
          ) : null}
          {canEdit && repair.status === "booked" && more !== "book" ? (
            <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={() => setMore("book")}>
              Change the visit
            </button>
          ) : null}
          {canEdit && repair.status === "booked" && more === "book" ? (
            <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={() => setMore(null)}>
              Mark it fixed instead
            </button>
          ) : null}
          <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={() => setHistory((value) => !value)}>
            {history ? "Hide history" : "Show history"}
          </button>
        </div>
        {history ? (
          <ul className="mt-3 space-y-2 border-l border-[var(--border)] pl-4">
            {repair.events.map((event) => (
              <li key={event.id} className="text-sm">
                <p className="font-medium">{event.label}</p>
                <p className="text-xs text-[var(--muted)]">
                  {formatWhen(event.at)}
                  {event.detail ? ` · ${event.detail}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LogReportDialog({
  book,
  commit,
  onClose,
  onFiled,
}: {
  book: LettingsBook;
  commit: (next: LettingsBook) => void;
  onClose: () => void;
  onFiled: (id: string) => void;
}) {
  const [propertyId, setPropertyId] = useState(book.properties[0]?.id ?? "");
  const [roomId, setRoomId] = useState(book.properties[0]?.rooms[0]?.id ?? "");
  const rooms = propertyById(book, propertyId)?.rooms ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log a report</DialogTitle>
          <DialogDescription>Paste what the tenant sent. The desk files the trade and the clocks.</DialogDescription>
        </DialogHeader>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              const repair = createRepair(book, {
                propertyId,
                roomId,
                body: String(data.get("body") || ""),
                channel: String(data.get("channel") || "whatsapp") as RepairChannel,
              });
              commit(addRepair(book, repair));
              toast.success(`${repair.reference} filed`);
              onFiled(repair.id);
            } catch (err) {
              fail(err);
            }
          }}
        >
          <Field label="Property">
            <select
              className={selectClass}
              value={propertyId}
              onChange={(event) => {
                const next = event.target.value;
                setPropertyId(next);
                setRoomId(propertyById(book, next)?.rooms[0]?.id ?? "");
              }}
            >
              {book.properties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.address}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Room">
            <select className={selectClass} value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} · {room.tenantName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="How it arrived">
            <select name="channel" className={selectClass} defaultValue="whatsapp">
              <option value="whatsapp">WhatsApp</option>
              <option value="text">Text</option>
              <option value="link">Link</option>
              <option value="qr">QR code</option>
            </select>
          </Field>
          <Field label="What they said">
            <Textarea name="body" required minLength={8} placeholder="The kitchen tap keeps dripping." />
          </Field>
          <Button type="submit">File the report</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TenantLinkDialog({ book, onClose }: { book: LettingsBook; onClose: () => void }) {
  const [token, setToken] = useState(book.properties[0]?.reportToken ?? "");
  const [origin, setOrigin] = useState("");
  const property = book.properties.find((item) => item.reportToken === token) ?? book.properties[0];
  const url = property ? `${origin}/report/${property.reportToken}` : "";

  useEffect(() => {
    const id = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!property) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tenant link</DialogTitle>
          <DialogDescription>No login. They open the link or scan the code, and the report lands on this desk.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-3">
          <Field label="Property">
            <select className={selectClass} value={property.reportToken} onChange={(event) => setToken(event.target.value)}>
              {book.properties.map((item) => (
                <option key={item.id} value={item.reportToken}>
                  {item.address}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Link">
            <Input readOnly value={url || `/report/${property.reportToken}`} aria-label="Tenant report link" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => copyText(url || `/report/${property.reportToken}`)}>
              Copy link
            </Button>
            <Button asChild variant="outline">
              <a href={url || `/report/${property.reportToken}`} target="_blank" rel="noreferrer">
                Open page
              </a>
            </Button>
          </div>
          {origin ? (
            <div className="pt-1">
              <QrImage value={`${url}?via=qr`} label={`QR code for ${property.address}`} />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RentView({
  book,
  commit,
  canEdit,
  onAddLet,
}: {
  book: LettingsBook;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
  onAddLet: () => void;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const rooms = book.properties.flatMap((property) => property.rooms.map((room) => ({ property, room })));
  const received = rooms.filter((item) => item.room.rentStatus === "received").reduce((sum, item) => sum + item.room.rentPcm, 0);
  const late = rooms.filter((item) => item.room.rentStatus === "late").reduce((sum, item) => sum + item.room.rentPcm, 0);
  const due = rooms.filter((item) => item.room.rentStatus === "due").reduce((sum, item) => sum + item.room.rentPcm, 0);
  const nations = [...new Set(book.properties.map((property) => property.jurisdiction))];

  if (rooms.length === 0) {
    return (
      <EmptyState
        title="No rent to collect"
        description="Add a let and the monthly rent shows up here."
        action={
          canEdit ? (
            <Button type="button" onClick={onAddLet}>
              Add a let
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          <span className="font-semibold text-[var(--foreground)]">{gbp(received)}</span> received
          <span className="px-1.5">·</span>
          <span className={late > 0 ? "font-semibold text-[var(--danger)]" : "font-semibold text-[var(--foreground)]"}>{gbp(late)}</span> late
          <span className="px-1.5">·</span>
          <span className="font-semibold text-[var(--foreground)]">{gbp(due)}</span> due
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => setRulesOpen(true)}>
            Increase rules
          </Button>
          {canEdit ? (
            <Button type="button" onClick={onAddLet}>
              Add a let
            </Button>
          ) : null}
        </div>
      </div>
      <Panel>
        {book.properties.map((property) => (
          <section key={property.id} className="border-b border-[var(--border)] last:border-b-0">
            <h2 className="px-4 pt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {property.address}
              {property.hmo ? " · rooms" : ""}
            </h2>
            <ul>
              {property.rooms.map((room) => (
                <li key={room.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{room.tenantName}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {room.name} · {rentPhrase(room.rentPcm, room.marketRentPcm)}
                    </p>
                  </div>
                  {canEdit ? (
                    <select
                      aria-label={`Rent for ${room.tenantName}`}
                      className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm sm:w-36"
                      value={room.rentStatus}
                      onChange={(event) => commit(setRentStatus(book, property.id, room.id, event.target.value as RentStatus))}
                    >
                      {RENT_STATUS.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge
                      tone={room.rentStatus === "received" ? "success" : room.rentStatus === "late" ? "danger" : "warning"}
                    >
                      {RENT_STATUS.find((status) => status.id === room.rentStatus)?.label}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Panel>
      {rulesOpen ? (
        <Dialog open onOpenChange={(open) => !open && setRulesOpen(false)}>
          <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Rent increases</DialogTitle>
              <DialogDescription>The form the office prepares. This is not legal advice.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              {nations.map((nation) => (
                <section key={nation}>
                  <h3 className="text-sm font-semibold">{JURISDICTION_LABELS[nation]}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{rentIncreaseNote(nation)}</p>
                </section>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function AddLetDialog({
  book,
  commit,
  onClose,
}: {
  book: LettingsBook;
  commit: (next: LettingsBook) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a let</DialogTitle>
          <DialogDescription>The tenant link is ready as soon as you save.</DialogDescription>
        </DialogHeader>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              commit(
                addProperty(book, {
                  address: String(data.get("address") || ""),
                  city: String(data.get("city") || ""),
                  postcode: String(data.get("postcode") || ""),
                  jurisdiction: String(data.get("jurisdiction") || "england") as Jurisdiction,
                  hmo: data.get("hmo") === "on",
                  roomName: String(data.get("room") || ""),
                  tenantName: String(data.get("tenant") || ""),
                  rentPcm: Number(data.get("rent")),
                  marketRentPcm: Number(data.get("market") || 0),
                }),
              );
              toast.success("Let added");
              onClose();
            } catch (err) {
              fail(err);
            }
          }}
        >
          <Field label="Address">
            <Input name="address" required />
          </Field>
          <Field label="City">
            <Input name="city" />
          </Field>
          <Field label="Postcode">
            <Input name="postcode" />
          </Field>
          <Field label="Nation">
            <select name="jurisdiction" className={selectClass} defaultValue="england">
              <option value="england">England</option>
              <option value="wales">Wales</option>
              <option value="scotland">Scotland</option>
            </select>
          </Field>
          <Field label="Flat or room">
            <Input name="room" />
          </Field>
          <Field label="Tenant">
            <Input name="tenant" required />
          </Field>
          <Field label="Rent pcm">
            <Input name="rent" type="number" min={1} required />
          </Field>
          <Field label="Similar lets pcm">
            <Input name="market" type="number" min={0} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="hmo" />
            Let by the room
          </label>
          <Button type="submit" className="sm:col-span-2">
            Save the let
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PropertiesView({
  book,
  commit,
  canEdit,
  onAddLet,
}: {
  book: LettingsBook;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
  onAddLet: () => void;
}) {
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [contractorsOpen, setContractorsOpen] = useState(false);
  const property = propertyById(book, propertyId ?? "") ?? null;

  if (book.properties.length === 0) {
    return (
      <EmptyState
        title="No properties yet"
        description="Each let keeps its tenants, certificates, inspections, and keys."
        action={
          canEdit ? (
            <Button type="button" onClick={onAddLet}>
              Add a let
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          {book.properties.length === 1 ? "1 let." : `${book.properties.length} lets.`} Open one for the file.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setContractorsOpen(true)}>
            Contractors
          </Button>
          {canEdit ? (
            <Button type="button" onClick={onAddLet}>
              Add a let
            </Button>
          ) : null}
        </div>
      </div>
      <Panel>
        <ul>
          {book.properties.map((item) => (
            <li key={item.id} className="border-b border-[var(--border)] last:border-b-0">
              <button
                type="button"
                onClick={() => setPropertyId(item.id)}
                className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-[var(--surface-muted)] sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <span className="block font-medium">{item.address}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {item.city} · {STAGES.find((stage) => stage.id === (item.tenancyStage || "active"))?.label}
                    {item.rooms.length === 1 ? ` · ${item.rooms[0]?.tenantName}` : ` · ${item.rooms.length} tenants`}
                  </span>
                </span>
                <span className="text-xs text-[var(--muted)] sm:text-right">{propertySignal(book, item.id)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      {property ? (
        <PropertyDialog
          key={property.id}
          book={book}
          propertyId={property.id}
          commit={commit}
          canEdit={canEdit}
          onClose={() => setPropertyId(null)}
        />
      ) : null}
      {contractorsOpen ? (
        <ContractorsDialog book={book} commit={commit} canEdit={canEdit} onClose={() => setContractorsOpen(false)} />
      ) : null}
    </div>
  );
}

function PropertyDialog({
  book,
  propertyId,
  commit,
  canEdit,
  onClose,
}: {
  book: LettingsBook;
  propertyId: string;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
  onClose: () => void;
}) {
  const property = propertyById(book, propertyId);
  const [adding, setAdding] = useState<"room" | "certificate" | "inspection" | "key" | null>(null);
  const [proofFor, setProofFor] = useState<string | null>(null);
  const [openInspection, setOpenInspection] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState<Record<string, string>>({});
  const [handover, setHandover] = useState<string | null>(null);
  if (!property) return null;
  const certificates = book.compliance
    .filter((item) => item.propertyId === property.id)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const inspections = book.inspections.filter((item) => item.propertyId === property.id);
  const keys = (book.keys ?? []).filter((item) => item.propertyId === property.id);
  const link = `/report/${property.reportToken}`;
  const pack = buildDisputePack(book, property.id);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(44rem,calc(100dvh-2rem))] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{property.address}</DialogTitle>
          <DialogDescription>
            {property.city}
            {property.postcode ? ` ${property.postcode}` : ""} · {JURISDICTION_LABELS[property.jurisdiction]}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {canEdit ? (
            <select
              aria-label="Tenancy stage"
              className="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm"
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
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => copyText(link)}>
              Copy tenant link
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => downloadPack(`dispute-pack-${property.reportToken}.html`, pack)}>
              Download pack
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => printPack(pack)}>
              Print
            </Button>
          </div>
        </div>

        <section className="mt-5 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Tenants</h3>
            {canEdit ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(adding === "room" ? null : "room")}>
                {adding === "room" ? "Close" : "Add a room"}
              </Button>
            ) : null}
          </div>
          <ul className="mt-2">
            {property.rooms.map((room) => (
              <li key={room.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{room.tenantName}</p>
                  <p className="text-xs text-[var(--muted)]">{room.name}</p>
                </div>
                {canEdit ? (
                  <label className="grid w-full gap-1 text-xs text-[var(--muted)] sm:flex sm:w-auto sm:items-center sm:gap-2">
                    <span className="whitespace-nowrap">Right to Rent</span>
                    <select
                      aria-label={`Right to Rent for ${room.tenantName}`}
                      className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm text-[var(--foreground)] sm:w-32"
                      value={room.rightToRent || "pending"}
                      onChange={(event) =>
                        commit(setRightToRent(book, property.id, room.id, event.target.value as RightToRent))
                      }
                    >
                      <option value="clear">Clear</option>
                      <option value="pending">Pending</option>
                      <option value="expired">Expired</option>
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
          {adding === "room" && canEdit ? (
            <form
              className="mt-2 grid gap-2 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                try {
                  commit(
                    addRoom(book, property.id, {
                      name: String(data.get("name") || ""),
                      tenantName: String(data.get("tenant") || ""),
                      rentPcm: Number(data.get("rent")),
                      marketRentPcm: Number(data.get("market") || 0),
                    }),
                  );
                  setAdding(null);
                  toast.success("Room added");
                } catch (err) {
                  fail(err);
                }
              }}
            >
              <Input name="name" placeholder="Room" aria-label="Room name" required />
              <Input name="tenant" placeholder="Tenant" aria-label="Tenant name" required />
              <Input name="rent" type="number" min={1} placeholder="Rent pcm" aria-label="Rent" required />
              <Input name="market" type="number" min={0} placeholder="Similar lets pcm" aria-label="Market rent" />
              <Button type="submit" variant="secondary" className="sm:col-span-2">
                Save room
              </Button>
            </form>
          ) : null}
        </section>

        <section className="mt-4 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Certificates</h3>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAdding(adding === "certificate" ? null : "certificate")}
              >
                {adding === "certificate" ? "Close" : "Add a date"}
              </Button>
            ) : null}
          </div>
          {certificates.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">Nothing on the calendar.</p> : null}
          <ul className="mt-1">
            {certificates.map((item) => (
              <li key={item.id} className="border-b border-[var(--border)] py-2 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatDay(item.dueAt)}
                      {item.proofName ? ` · ${item.proofName}` : ""}
                    </p>
                  </div>
                  <Badge tone={item.status === "overdue" ? "danger" : item.status === "due" ? "warning" : "success"}>
                    {item.status === "proof_held" ? "On file" : item.status === "ok" ? "In date" : item.status === "due" ? "Due" : "Overdue"}
                  </Badge>
                </div>
                {canEdit && !item.proofName ? (
                  proofFor === item.id ? (
                    <form
                      className="mt-2 flex flex-col gap-2 sm:flex-row"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        try {
                          commit(attachProof(book, item.id, String(data.get("proof") || "")));
                          setProofFor(null);
                          toast.success("Proof saved");
                        } catch (err) {
                          fail(err);
                        }
                      }}
                    >
                      <Input name="proof" placeholder="Certificate or scheme reference" aria-label="Proof name" required />
                      <Button type="submit" size="sm" variant="secondary">
                        Save
                      </Button>
                    </form>
                  ) : (
                    <button type="button" className="mt-1 text-xs font-semibold text-[var(--accent)]" onClick={() => setProofFor(item.id)}>
                      Add proof
                    </button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
          {adding === "certificate" && canEdit ? (
            <form
              className="mt-3 grid gap-2 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                try {
                  commit(
                    addCompliance(book, {
                      propertyId: property.id,
                      kind: String(data.get("kind") || "gas_safety") as ComplianceKind,
                      dueAt: String(data.get("due") || ""),
                      detail: String(data.get("detail") || ""),
                    }),
                  );
                  setAdding(null);
                  toast.success("Date added");
                } catch (err) {
                  fail(err);
                }
              }}
            >
              <select name="kind" className={selectClass} aria-label="Certificate" defaultValue="gas_safety">
                {(Object.keys(COMPLIANCE_LABELS) as ComplianceKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {COMPLIANCE_LABELS[kind]}
                  </option>
                ))}
              </select>
              <Input name="due" type="date" aria-label="Due date" required />
              <Input name="detail" placeholder="Note" aria-label="Note" className="sm:col-span-2" />
              <Button type="submit" variant="secondary" className="sm:col-span-2">
                Save date
              </Button>
            </form>
          ) : null}
        </section>

        <section className="mt-4 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Inspections</h3>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAdding(adding === "inspection" ? null : "inspection")}
              >
                {adding === "inspection" ? "Close" : "Add"}
              </Button>
            ) : null}
          </div>
          {inspections.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">No reports yet.</p> : null}
          <ul className="mt-1">
            {inspections.map((inspection) => (
              <li key={inspection.id} className="border-b border-[var(--border)] py-2 last:border-b-0">
                <button type="button" className="w-full text-left" onClick={() => setOpenInspection(openInspection === inspection.id ? null : inspection.id)}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">
                      {INSPECTION_LABELS[inspection.kind]} · {formatDay(inspection.at)}
                    </span>
                    <Badge tone={inspection.signedOffAt ? "success" : "warning"}>
                      {inspection.signedOffAt ? "Signed" : "Waiting"}
                    </Badge>
                  </span>
                </button>
                {openInspection === inspection.id ? (
                  <div className="mt-2 text-sm text-[var(--muted)]">
                    {inspection.notes ? <p>{inspection.notes}</p> : null}
                    <ul className="mt-1 space-y-1">
                      {inspection.rooms.map((note) => (
                        <li key={note.name}>
                          <span className="font-medium text-[var(--foreground)]">{note.name}.</span> {note.condition}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {adding === "inspection" && canEdit ? (
            <form
              className="mt-3 grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const rooms = property.rooms
                  .map((room) => ({ name: room.name, condition: String(data.get(`room-${room.id}`) || "").trim() }))
                  .filter((note) => note.condition);
                if (property.hmo && String(data.get("common") || "").trim()) {
                  rooms.unshift({ name: "Common parts", condition: String(data.get("common") || "").trim() });
                }
                try {
                  commit(
                    addInspection(book, {
                      propertyId: property.id,
                      kind: String(data.get("kind") || "mid_term") as InspectionKind,
                      at: String(data.get("at") || ""),
                      notes: String(data.get("notes") || ""),
                      rooms,
                    }),
                  );
                  setAdding(null);
                  toast.success("Inspection saved");
                } catch (err) {
                  fail(err);
                }
              }}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <select name="kind" className={selectClass} aria-label="Inspection type" defaultValue="check_in">
                  {(Object.keys(INSPECTION_LABELS) as InspectionKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {INSPECTION_LABELS[kind]}
                    </option>
                  ))}
                </select>
                <Input name="at" type="date" aria-label="Inspection date" required />
              </div>
              <Textarea name="notes" placeholder="What you saw" aria-label="Notes" />
              {property.hmo ? <Input name="common" placeholder="Common parts" aria-label="Common parts" /> : null}
              {property.rooms.map((room) => (
                <Input key={room.id} name={`room-${room.id}`} placeholder={`${room.name} condition`} aria-label={`${room.name} condition`} />
              ))}
              <Button type="submit" variant="secondary">
                Save inspection
              </Button>
            </form>
          ) : null}
        </section>

        <section className="mt-4 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Keys</h3>
            {canEdit ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(adding === "key" ? null : "key")}>
                {adding === "key" ? "Close" : "Add"}
              </Button>
            ) : null}
          </div>
          {keys.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">No keys logged.</p> : null}
          <ul className="mt-1">
            {keys.map((key) => (
              <li key={key.id} className="py-2">
                <p className="text-sm font-medium">{key.label}</p>
                <p className="text-xs text-[var(--muted)]">Held by {key.heldBy}</p>
                {canEdit && handover === key.id ? (
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      try {
                        commit(moveKey(book, key.id, keyDraft[key.id] || ""));
                        setKeyDraft((prev) => ({ ...prev, [key.id]: "" }));
                        setHandover(null);
                        toast.success("Key log updated");
                      } catch (err) {
                        fail(err);
                      }
                    }}
                  >
                    <Input
                      aria-label={`Who holds ${key.label}`}
                      value={keyDraft[key.id] ?? ""}
                      placeholder="Now held by"
                      onChange={(event) => setKeyDraft((prev) => ({ ...prev, [key.id]: event.target.value }))}
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      Log
                    </Button>
                  </form>
                ) : canEdit ? (
                  <button type="button" className="mt-1 text-xs font-semibold text-[var(--accent)]" onClick={() => setHandover(key.id)}>
                    Hand over
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {adding === "key" && canEdit ? (
            <form
              className="mt-2 grid gap-2 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                try {
                  commit(
                    addKey(book, {
                      propertyId: property.id,
                      label: String(data.get("label") || ""),
                      heldBy: String(data.get("heldBy") || ""),
                    }),
                  );
                  setAdding(null);
                  toast.success("Keys logged");
                } catch (err) {
                  fail(err);
                }
              }}
            >
              <Input name="label" placeholder="Which keys" aria-label="Which keys" required />
              <Input name="heldBy" placeholder="Held by" aria-label="Held by" required />
              <Button type="submit" variant="secondary" className="sm:col-span-2">
                Save keys
              </Button>
            </form>
          ) : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function ContractorsDialog({
  book,
  commit,
  canEdit,
  onClose,
}: {
  book: LettingsBook;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
  onClose: () => void;
}) {
  const contractors = book.contractors ?? [];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contractors</DialogTitle>
          <DialogDescription>A repair cannot be booked to someone whose insurance has expired.</DialogDescription>
        </DialogHeader>
        {contractors.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">No contractors yet.</p> : null}
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {contractors.map((contractor) => {
            const expired = insuranceExpired(contractor);
            return (
              <li key={contractor.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  {contractor.name}
                  <span className="block text-xs text-[var(--muted)]">
                    {contractor.trade} · insurance {formatDay(`${contractor.insuranceExpires}T12:00:00.000Z`)}
                  </span>
                </span>
                <Badge tone={expired ? "danger" : "success"}>{expired ? "Expired" : "Covered"}</Badge>
              </li>
            );
          })}
        </ul>
        {canEdit ? (
          <form
            className="mt-4 grid gap-2 sm:grid-cols-2"
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
                fail(err);
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
      </DialogContent>
    </Dialog>
  );
}
