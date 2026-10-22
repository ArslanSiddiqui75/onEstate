"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs, TabsBar, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { QrImage } from "@/components/lettings/qr-image";
import {
  acknowledgeRepair,
  addCompliance,
  addInspection,
  addProperty,
  addRepair,
  addRoom,
  applyInbox,
  attachProof,
  bookTradesperson,
  buildDisputePack,
  complianceReminders,
  createRepair,
  markFixed,
  placeLabel,
  propertyById,
  rentSummary,
  roomById,
  seedBook,
  setRentStatus,
  stageIndex,
  tryConfirmRepair,
} from "@/lib/lettings/book";
import { clockLabel, formatDay, formatMonth, formatWhen, gbp, marketPosition, rentIncreaseNote } from "@/lib/lettings/format";
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
} from "@/lib/lettings/types";
import {
  CHANNEL_LABELS,
  COMPLIANCE_LABELS,
  INSPECTION_LABELS,
  JURISDICTION_LABELS,
  REPAIR_STAGES,
  TRADE_LABELS,
  URGENCY_LABELS,
} from "@/lib/lettings/types";
import { Clock3, Download, PoundSterling, ShieldCheck, Wrench } from "lucide-react";

const selectClass =
  "h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm";

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

export function LettingsDesk({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { book, commit } = useLettingsBook(orgId);
  const summary = rentSummary(book);
  const reminders = complianceReminders(book);
  const openRepairs = book.repairs.filter((repair) => repair.status !== "tenant_confirmed").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Received" value={gbp(summary.received)} icon={PoundSterling} tone="success" sub="this month" />
        <StatCard label="Late" value={gbp(summary.late)} icon={Clock3} tone="danger" sub="still unpaid" />
        <StatCard label="Due" value={gbp(summary.booked)} icon={PoundSterling} tone="neutral" sub="booked this month" />
        <StatCard label="Collected" value={`${summary.collectedPct}%`} icon={ShieldCheck} tone="accent" sub={`${openRepairs} open repairs`} />
      </div>

      {reminders.length > 0 ? (
        <Card className="border-[var(--warning)] bg-[var(--warning-soft)]">
          <p className="text-sm font-semibold">Coming up on the compliance calendar</p>
          <ul className="mt-2 space-y-1 text-sm">
            {reminders.slice(0, 4).map((item) => {
              const property = propertyById(book, item.propertyId);
              return (
                <li key={item.id}>
                  {item.title} at {property?.address} · {formatDay(item.dueAt)}
                  {item.status === "overdue" ? " · overdue" : ""}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Tabs defaultValue="repairs">
        <TabsBar>
          <TabsList aria-label="Landlord desk">
            <TabsTrigger value="repairs">Repairs</TabsTrigger>
            <TabsTrigger value="rent">Rent</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="inspections">Inspections</TabsTrigger>
            <TabsTrigger value="pack">Dispute pack</TabsTrigger>
          </TabsList>
        </TabsBar>
        <TabsContent value="repairs">
          <RepairsTab book={book} commit={commit} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="rent">
          <RentTab book={book} commit={commit} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="compliance">
          <ComplianceTab book={book} commit={commit} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="inspections">
          <InspectionsTab book={book} commit={commit} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="pack">
          <PackTab book={book} />
        </TabsContent>
      </Tabs>

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
            Reset the sample book
          </Button>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">You can read the desk. Changing it needs CRM edit access.</p>
      )}
    </div>
  );
}

function RepairsTab({
  book,
  commit,
  canEdit,
}: {
  book: LettingsBook;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
}) {
  const [origin, setOrigin] = useState("");
  const [token, setToken] = useState(book.properties[0]?.reportToken ?? "");
  const [repairId, setRepairId] = useState(book.repairs[0]?.id ?? "");
  const [logProperty, setLogProperty] = useState(book.properties[0]?.id ?? "");
  const [logRoom, setLogRoom] = useState(book.properties[0]?.rooms[0]?.id ?? "");
  const [logChannel, setLogChannel] = useState<RepairChannel>("whatsapp");
  const [logBody, setLogBody] = useState("");
  const property = book.properties.find((item) => item.reportToken === token) ?? book.properties[0];
  const selected = book.repairs.find((item) => item.id === repairId) ?? book.repairs[0] ?? null;
  const url = property ? `${origin}/report/${property.reportToken}` : "";
  const ranked = useMemo(
    () =>
      [...book.repairs].sort((a, b) => {
        const weight = { emergency: 0, urgent: 1, routine: 2 };
        return weight[a.urgency] - weight[b.urgency] || b.createdAt.localeCompare(a.createdAt);
      }),
    [book.repairs],
  );

  useEffect(() => {
    const id = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(id);
  }, []);

  const logTenancies = propertyById(book, logProperty)?.rooms ?? [];

  return (
    <div className="space-y-5">
      {property ? (
        <Card>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Tenant report link</h2>
              <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
                No login. They open the link, scan the QR code, or send the same words by text or WhatsApp. The desk files a reference, a trade, and the reply-by and fix-by clocks.
              </p>
              <label className="mt-4 block text-sm font-medium">
                Property
                <select className={`${selectClass} mt-1.5`} value={property.reportToken} onChange={(event) => setToken(event.target.value)}>
                  {book.properties.map((item) => (
                    <option key={item.id} value={item.reportToken}>
                      {item.address} {item.hmo ? "· HMO" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm font-medium">
                Link
                <Input className="mt-1.5" readOnly value={url || `/report/${property.reportToken}`} aria-label="Tenant report link" />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const link = url || `/report/${property.reportToken}`;
                    void navigator.clipboard?.writeText(link).then(
                      () => toast.success("Link copied"),
                      () => toast.info("Select the link and copy it."),
                    );
                  }}
                >
                  Copy link
                </Button>
                <Button asChild variant="outline">
                  <a href={url || `/report/${property.reportToken}`} target="_blank" rel="noreferrer">
                    Open report page
                  </a>
                </Button>
              </div>
            </div>
            {origin ? <QrImage value={`${url}?via=qr`} label={`QR code for ${property.address}`} /> : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-semibold">Log a text or WhatsApp</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Paste what the tenant sent. The same rules file the trade and the clocks.</p>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canEdit) return;
            try {
              const repair = createRepair(book, {
                propertyId: logProperty,
                roomId: logRoom,
                body: logBody,
                channel: logChannel,
              });
              commit(addRepair(book, repair));
              setRepairId(repair.id);
              setLogBody("");
              toast.success(`${repair.reference} filed`);
            } catch (err) {
              fail(err);
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              className={selectClass}
              value={logProperty}
              aria-label="Property for the message"
              onChange={(event) => {
                const next = event.target.value;
                setLogProperty(next);
                setLogRoom(propertyById(book, next)?.rooms[0]?.id ?? "");
              }}
            >
              {book.properties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.address}
                </option>
              ))}
            </select>
            <select className={selectClass} value={logRoom} aria-label="Room" onChange={(event) => setLogRoom(event.target.value)}>
              {logTenancies.map((tenancy) => (
                <option key={tenancy.id} value={tenancy.id}>
                  {tenancy.name} · {tenancy.tenantName}
                </option>
              ))}
            </select>
            <select className={selectClass} value={logChannel} aria-label="Channel" onChange={(event) => setLogChannel(event.target.value as RepairChannel)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="text">Text</option>
              <option value="link">Link</option>
              <option value="qr">QR code</option>
            </select>
          </div>
          <Textarea value={logBody} onChange={(event) => setLogBody(event.target.value)} placeholder="The kitchen tap keeps dripping." required minLength={8} />
          <Button type="submit" disabled={!canEdit}>
            File the report
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-2">
          {ranked.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--muted)]">No repairs yet. A tenant report, or a pasted text, will land here.</p>
            </Card>
          ) : (
            ranked.map((repair) => (
              <button
                key={repair.id}
                type="button"
                onClick={() => setRepairId(repair.id)}
                className={`w-full rounded-[1.25rem] border p-4 text-left transition ${
                  selected?.id === repair.id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{repair.reference}</span>
                  <Badge tone={urgencyTone(repair)}>{URGENCY_LABELS[repair.urgency]}</Badge>
                  <Badge>{TRADE_LABELS[repair.category]}</Badge>
                </div>
                <p className="mt-1 text-sm">{repair.title}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {placeLabel(book, repair.propertyId, repair.roomId)} · {CHANNEL_LABELS[repair.channel]} · reply {clockLabel(repair.replyBy)}
                </p>
              </button>
            ))
          )}
        </div>
        {selected ? <RepairDetail book={book} repair={selected} commit={commit} canEdit={canEdit} /> : null}
      </div>
    </div>
  );
}

function RepairDetail({
  book,
  repair,
  commit,
  canEdit,
}: {
  book: LettingsBook;
  repair: Repair;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
}) {
  const property = propertyById(book, repair.propertyId);
  const tenancy = property ? roomById(property, repair.roomId) : null;
  const reached = stageIndex(repair.status);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{repair.reference}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{repair.title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {property?.address}
            {tenancy ? ` · ${tenancy.name} · ${tenancy.tenantName}` : ""}
          </p>
        </div>
        <Wrench className="h-5 w-5 text-[var(--accent)]" aria-hidden />
      </div>
      <p className="mt-3 text-sm leading-relaxed">{repair.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone={urgencyTone(repair)}>{URGENCY_LABELS[repair.urgency]}</Badge>
        <Badge tone="accent">{TRADE_LABELS[repair.category]}</Badge>
        <Badge>{CHANNEL_LABELS[repair.channel]}</Badge>
      </div>
      {repair.emergency ? (
        <div className="mt-3 rounded-2xl bg-[var(--danger-soft)] p-3 text-sm" role="status">
          <p className="font-semibold">{emergencyGuidance(repair.emergency).title}</p>
          <p className="mt-1">{emergencyGuidance(repair.emergency).body}</p>
        </div>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[var(--muted)]">Reply by</dt>
          <dd className="font-medium">
            {formatWhen(repair.replyBy)} · {clockLabel(repair.replyBy)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Fix by</dt>
          <dd className="font-medium">
            {formatWhen(repair.fixBy)} · {clockLabel(repair.fixBy)}
          </dd>
        </div>
      </dl>
      <ol className="mt-5 grid gap-2 sm:grid-cols-5">
        {REPAIR_STAGES.map((stage, index) => (
          <li
            key={stage.id}
            className={`rounded-xl px-2 py-2 text-center text-xs font-semibold ${
              index <= reached ? "bg-[var(--accent-soft)] text-[var(--foreground)]" : "bg-[var(--surface-muted)] text-[var(--muted)]"
            }`}
          >
            {stage.label}
          </li>
        ))}
      </ol>
      <ul className="mt-4 space-y-2 border-l border-[var(--border)] pl-4">
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
      {repair.photos.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-3">
          {repair.photos.map((photo) => (
            <li key={photo.id} className="text-xs text-[var(--muted)]">
              {photo.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.dataUrl} alt={photo.name} className="h-20 w-20 rounded-xl object-cover" />
              ) : (
                <span className="inline-flex rounded-xl bg-[var(--surface-muted)] px-3 py-2">{photo.name}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {canEdit && repair.status === "reported" ? (
        <Button
          className="mt-4"
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

      {canEdit && repair.status !== "fixed" && repair.status !== "tenant_confirmed" ? (
        <form
          className="mt-4 grid gap-2 sm:grid-cols-2"
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
              event.currentTarget.reset();
              toast.success("Visit booked");
            } catch (err) {
              fail(err);
            }
          }}
        >
          <Input name="tradesperson" placeholder="Tradesperson" aria-label="Tradesperson" required />
          <Input name="when" type="datetime-local" aria-label="Appointment" required />
          <Input name="note" placeholder="Note" aria-label="Booking note" className="sm:col-span-2" />
          <Button type="submit" variant="secondary" className="sm:col-span-2">
            Book the tradesperson
          </Button>
        </form>
      ) : null}

      {canEdit && repair.status !== "fixed" && repair.status !== "tenant_confirmed" ? (
        <form
          className="mt-3 grid gap-2"
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
          <Input name="note" placeholder="What was done" aria-label="Fix note" />
          <input name="photo" type="file" accept="image/*" aria-label="Photo of the repair" className="text-sm" />
          <Button type="submit" variant="secondary">
            Mark fixed
          </Button>
        </form>
      ) : null}

      {canEdit && repair.status === "fixed" ? (
        <Button
          className="mt-4"
          onClick={() => {
            commit(tryConfirmRepair(book, repair.reference, tenancy?.tenantName || "Tenant", new Date().toISOString()));
            toast.success("Tenant sign-off recorded");
          }}
        >
          Record tenant sign-off
        </Button>
      ) : null}
      {repair.tradesperson ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          {repair.tradesperson}
          {repair.appointmentAt ? ` · ${formatWhen(repair.appointmentAt)}` : ""}
        </p>
      ) : null}
    </Card>
  );
}

function RentTab({
  book,
  commit,
  canEdit,
}: {
  book: LettingsBook;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
}) {
  const first = book.properties[0];
  const [selected, setSelected] = useState(first ? `${first.id}:${first.rooms[0]?.id}` : "");
  const [propertyId, roomId] = selected.split(":");
  const property = propertyById(book, propertyId) ?? first;
  const tenancy = property?.rooms.find((item) => item.id === roomId) ?? property?.rooms[0];
  const position = tenancy ? marketPosition(tenancy.rentPcm, tenancy.marketRentPcm) : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-3">
          {book.properties.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{item.address}</h2>
                <Badge>{JURISDICTION_LABELS[item.jurisdiction]}</Badge>
                {item.hmo ? <Badge tone="accent">HMO · {item.rooms.length} rooms</Badge> : null}
              </div>
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {item.rooms.map((room) => {
                  const active = selected === `${item.id}:${room.id}`;
                  const gap = marketPosition(room.rentPcm, room.marketRentPcm);
                  return (
                    <li key={room.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <button type="button" className="min-w-0 text-left" onClick={() => setSelected(`${item.id}:${room.id}`)}>
                        <p className={`font-medium ${active ? "text-[var(--accent)]" : ""}`}>
                          {room.name} · {room.tenantName}
                        </p>
                        <p className="text-sm text-[var(--muted)]">
                          {gbp(room.rentPcm)} pcm · market {gbp(room.marketRentPcm)} ·{" "}
                          {gap.direction === "level" ? "in line" : `${gap.pct}% ${gap.direction}`}
                        </p>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={room.rentStatus === "received" ? "success" : room.rentStatus === "late" ? "danger" : "warning"}>
                          {room.rentStatus}
                        </Badge>
                        {canEdit
                          ? (["received", "late", "due"] as RentStatus[]).map((status) => (
                              <Button
                                key={status}
                                size="sm"
                                variant={room.rentStatus === status ? "default" : "secondary"}
                                onClick={() => commit(setRentStatus(book, item.id, room.id, status))}
                              >
                                {status}
                              </Button>
                            ))
                          : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {canEdit ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Add a room</summary>
                <form
                  className="mt-3 grid gap-2 sm:grid-cols-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    try {
                      commit(
                        addRoom(book, item.id, {
                          name: String(data.get("name") || ""),
                          tenantName: String(data.get("tenant") || ""),
                          rentPcm: Number(data.get("rent")),
                          marketRentPcm: Number(data.get("market") || 0),
                        }),
                      );
                      event.currentTarget.reset();
                      toast.success("Room added");
                    } catch (err) {
                      fail(err);
                    }
                  }}
                >
                  <Input name="name" placeholder="Room" aria-label="Room name" required />
                  <Input name="tenant" placeholder="Tenant" aria-label="Tenant name" required />
                  <Input name="rent" type="number" min={1} placeholder="Rent pcm" aria-label="Rent" required />
                  <Input name="market" type="number" min={0} placeholder="Market pcm" aria-label="Market rent" />
                  <Button type="submit" variant="secondary" className="sm:col-span-4">
                    Add the room
                  </Button>
                </form>
              </details>
              ) : null}
            </Card>
          ))}
        </div>
        {property && tenancy && position ? (
          <Card>
            <h2 className="font-semibold">Market rent check</h2>
            <p className="mt-2 text-sm leading-relaxed">
              {property.address}, {tenancy.name} is{" "}
              {position.direction === "level"
                ? `in line with the ${gbp(tenancy.marketRentPcm)} held for similar lets in ${property.city}.`
                : `${position.pct}% ${position.direction} the ${gbp(tenancy.marketRentPcm)} held for similar lets in ${property.city}.`}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{rentIncreaseNote(property.jurisdiction)}</p>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Market rent is the figure you hold for similar local lets. It is not a live portal valuation. Making Tax Digital and full accounts stay in your accounting software.
            </p>
          </Card>
        ) : null}
      </div>
      {canEdit ? <AddLet book={book} commit={commit} /> : null}
    </div>
  );
}

function AddLet({ book, commit }: { book: LettingsBook; commit: (next: LettingsBook) => void }) {
  return (
    <details className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4">
      <summary className="cursor-pointer font-semibold">Add a let</summary>
      <form
        className="mt-4 grid gap-2 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          try {
            const next = addProperty(book, {
              address: String(data.get("address") || ""),
              city: String(data.get("city") || ""),
              postcode: String(data.get("postcode") || ""),
              jurisdiction: String(data.get("jurisdiction") || "england") as Jurisdiction,
              hmo: data.get("hmo") === "on",
              roomName: String(data.get("room") || ""),
              tenantName: String(data.get("tenant") || ""),
              rentPcm: Number(data.get("rent")),
              marketRentPcm: Number(data.get("market") || 0),
            });
            commit(next);
            event.currentTarget.reset();
            toast.success("Let added. Its report link is on Repairs.");
          } catch (err) {
            fail(err);
          }
        }}
      >
        <Input name="address" placeholder="Address" aria-label="Address" required />
        <Input name="city" placeholder="City" aria-label="City" />
        <Input name="postcode" placeholder="Postcode" aria-label="Postcode" />
        <select name="jurisdiction" className={selectClass} aria-label="Nation" defaultValue="england">
          <option value="england">England</option>
          <option value="wales">Wales</option>
          <option value="scotland">Scotland</option>
        </select>
        <Input name="room" placeholder="Flat or room" aria-label="Room" />
        <Input name="tenant" placeholder="Tenant" aria-label="Tenant" required />
        <Input name="rent" type="number" min={1} placeholder="Rent pcm" aria-label="Rent per month" required />
        <Input name="market" type="number" min={0} placeholder="Market rent pcm" aria-label="Market rent" />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="hmo" />
          House in multiple occupation, let by the room
        </label>
        <Button type="submit" className="sm:col-span-2">
          Add the let
        </Button>
      </form>
    </details>
  );
}

function ComplianceTab({
  book,
  commit,
  canEdit,
}: {
  book: LettingsBook;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
}) {
  const groups = new Map<string, typeof book.compliance>();
  for (const item of [...book.compliance].sort((a, b) => a.dueAt.localeCompare(b.dueAt))) {
    const key = formatMonth(item.dueAt);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-[var(--muted)]">
        Gas safety, EICR, EPC, deposits, HMO licences, alarms, and inspections for England, Wales, and Scotland. Attach the certificate name when you have proof of service.
      </p>
      {[...groups.entries()].map(([month, items]) => (
        <section key={month} className="space-y-2">
          <h2 className="font-semibold">{month}</h2>
          {items.map((item) => {
            const property = propertyById(book, item.propertyId);
            return (
              <Card key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {item.title} · {property?.address}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {formatDay(item.dueAt)} · {property ? JURISDICTION_LABELS[property.jurisdiction] : ""}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{item.detail}</p>
                    {item.proofName ? (
                      <p className="mt-2 text-sm font-medium">Proof: {item.proofName}</p>
                    ) : null}
                  </div>
                  <Badge
                    tone={
                      item.status === "overdue" ? "danger" : item.status === "due" ? "warning" : "success"
                    }
                  >
                    {item.status === "proof_held" ? "Proof held" : item.status}
                  </Badge>
                </div>
                {canEdit ? (
                  <form
                    className="mt-3 flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      const file = data.get("file");
                      const named = file instanceof File && file.name ? file.name : String(data.get("proof") || "");
                      try {
                        commit(attachProof(book, item.id, named));
                        event.currentTarget.reset();
                        toast.success("Proof saved");
                      } catch (err) {
                        fail(err);
                      }
                    }}
                  >
                    <Input name="proof" placeholder="Certificate or scheme reference" aria-label="Proof name" />
                    <input name="file" type="file" aria-label="Proof file" className="text-sm" />
                    <Button type="submit" variant="secondary">
                      Save proof
                    </Button>
                  </form>
                ) : null}
              </Card>
            );
          })}
        </section>
      ))}
      {canEdit ? (
        <form
          className="grid gap-2 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              commit(
                addCompliance(book, {
                  propertyId: String(data.get("property") || ""),
                  kind: String(data.get("kind") || "gas_safety") as ComplianceKind,
                  dueAt: String(data.get("due") || ""),
                  detail: String(data.get("detail") || ""),
                }),
              );
              event.currentTarget.reset();
              toast.success("Date added");
            } catch (err) {
              fail(err);
            }
          }}
        >
          <select name="property" className={selectClass} aria-label="Property" defaultValue={book.properties[0]?.id}>
            {book.properties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.address}
              </option>
            ))}
          </select>
          <select name="kind" className={selectClass} aria-label="Certificate" defaultValue="gas_safety">
            {(Object.keys(COMPLIANCE_LABELS) as ComplianceKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {COMPLIANCE_LABELS[kind]}
              </option>
            ))}
          </select>
          <Input name="due" type="date" aria-label="Due date" required />
          <Input name="detail" placeholder="Note" aria-label="Note" />
          <Button type="submit" className="sm:col-span-2">
            Add to the calendar
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function InspectionsTab({
  book,
  commit,
  canEdit,
}: {
  book: LettingsBook;
  commit: (next: LettingsBook) => void;
  canEdit: boolean;
}) {
  const [propertyId, setPropertyId] = useState(book.properties[0]?.id ?? "");
  const property = propertyById(book, propertyId) ?? book.properties[0];

  return (
    <div className="space-y-4">
      {book.inspections.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">No inspection reports yet.</p>
        </Card>
      ) : (
        book.inspections.map((inspection) => {
          const home = propertyById(book, inspection.propertyId);
          return (
            <Card key={inspection.id}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">
                  {INSPECTION_LABELS[inspection.kind]} · {home?.address}
                </h2>
                <Badge tone={inspection.signedOffAt ? "success" : "warning"}>
                  {inspection.signedOffAt ? `Signed by ${inspection.signedOffBy}` : "Awaiting tenant sign-off"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{formatDay(inspection.at)}</p>
              <p className="mt-2 text-sm">{inspection.notes}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {inspection.rooms.map((note) => (
                  <li key={note.name}>
                    <span className="font-medium">{note.name}.</span> {note.condition}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}
      {canEdit && property ? (
        <form
          className="grid gap-2 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const rooms = property.rooms.map((tenancy) => ({
              name: tenancy.name,
              condition: String(data.get(`room-${tenancy.id}`) || ""),
            }));
            if (property.hmo) {
              rooms.unshift({ name: "Common parts", condition: String(data.get("common") || "") });
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
              event.currentTarget.reset();
              toast.success("Inspection saved");
            } catch (err) {
              fail(err);
            }
          }}
        >
          <h2 className="font-semibold">New inspection</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <select className={selectClass} value={propertyId} aria-label="Property" onChange={(event) => setPropertyId(event.target.value)}>
              {book.properties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.address}
                </option>
              ))}
            </select>
            <select name="kind" className={selectClass} aria-label="Inspection type" defaultValue="check_in">
              {(Object.keys(INSPECTION_LABELS) as InspectionKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {INSPECTION_LABELS[kind]}
                </option>
              ))}
            </select>
            <Input name="at" type="date" aria-label="Inspection date" required />
          </div>
          <Textarea name="notes" placeholder="Overall notes" aria-label="Notes" />
          {property.hmo ? <Input name="common" placeholder="Common parts" aria-label="Common parts" /> : null}
          {property.rooms.map((tenancy) => (
            <Input key={tenancy.id} name={`room-${tenancy.id}`} placeholder={`${tenancy.name} condition`} aria-label={`${tenancy.name} condition`} />
          ))}
          <Button type="submit">Save the report</Button>
        </form>
      ) : null}
    </div>
  );
}

function PackTab({ book }: { book: LettingsBook }) {
  const [propertyId, setPropertyId] = useState(book.properties[0]?.id ?? "");
  const property = propertyById(book, propertyId);
  const html = property ? buildDisputePack(book, property.id) : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block min-w-0 flex-1 text-sm font-medium">
          Property
          <select className={`${selectClass} mt-1.5`} value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
            {book.properties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.address}
                {item.hmo ? " · HMO" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (!property) return;
              const blob = new Blob([html], { type: "text/html" });
              const href = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = href;
              link.download = `dispute-pack-${property.reportToken}.html`;
              link.click();
              URL.revokeObjectURL(href);
              toast.success("Dispute pack downloaded");
            }}
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </Button>
          <Button
            type="button"
            onClick={() => {
              const popup = window.open("", "_blank");
              if (!popup) {
                toast.error("Allow pop-ups to print, or download the pack.");
                return;
              }
              popup.document.write(html);
              popup.document.close();
              popup.focus();
              popup.print();
            }}
          >
            Print
          </Button>
        </div>
      </div>
      <p className="text-sm text-[var(--muted)]">
        One pack for the tenancy, the rent position, every repair and its clocks, the certificates on file, and inspection sign-off.
      </p>
      {html ? (
        <iframe title="Dispute pack preview" className="h-[32rem] w-full rounded-[1.25rem] border border-[var(--border)] bg-white" srcDoc={html} />
      ) : null}
    </div>
  );
}
