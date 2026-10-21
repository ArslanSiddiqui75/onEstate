"use client";

import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatWhen } from "@/lib/lettings/format";
import { emergencyGuidance, triageReport } from "@/lib/lettings/triage";
import {
  confirmPublicRepair,
  lookupReportLink,
  signPublicInspection,
  submitPublicReport,
} from "@/lib/lettings/store";
import type { Inspection, Property, Repair, RepairChannel } from "@/lib/lettings/types";
import { CHANNEL_LABELS, INSPECTION_LABELS, TRADE_LABELS, URGENCY_LABELS } from "@/lib/lettings/types";

const selectClass =
  "h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm";

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

export function ReportDesk({
  token,
  via,
  seedProperty,
  initialRepair = null,
}: {
  token: string;
  via: RepairChannel;
  seedProperty: Property | null;
  initialRepair?: Repair | null;
}) {
  const [property, setProperty] = useState<Property | null>(seedProperty);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [missing, setMissing] = useState(seedProperty === null);
  const [channel, setChannel] = useState<RepairChannel>(via);
  const [roomId, setRoomId] = useState(seedProperty?.rooms[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repair, setRepair] = useState<Repair | null>(initialRepair);
  const [confirmRef, setConfirmRef] = useState("");
  const [confirmNote, setConfirmNote] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const linked = lookupReportLink(token);
      if (!linked) {
        setMissing(seedProperty === null);
        return;
      }
      setProperty(linked.property);
      setInspections(linked.inspections);
      setRoomId((current) => current || linked.property.rooms[0]?.id || "");
      setMissing(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [token, seedProperty]);

  const preview = useMemo(() => (body.trim().length >= 8 ? triageReport(body.trim()) : null), [body]);
  const tenancy = property?.rooms.find((item) => item.id === roomId) ?? property?.rooms[0];

  async function onReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const room = tenancy?.id || roomId;
    try {
      const photo = await readPhoto((event.currentTarget.elements.namedItem("photo") as HTMLInputElement)?.files?.[0]);
      try {
        const res = await fetch("/api/lettings/report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token,
            roomId: room,
            body,
            channel,
            photoName: photo?.name,
            photoData: photo?.dataUrl,
          }),
        });
        const json = (await res.json()) as { repair?: Repair; error?: string };
        if (!res.ok || !json.repair) throw new Error(json.error || "Could not send that report.");
        setRepair(json.repair);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (/sentence|recognised|room|photo/i.test(message)) throw err;
        const result = submitPublicReport(token, { roomId: room, body, channel, photo });
        setRepair(result.repair);
        setProperty(result.property);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that report.");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmNote(null);
    setError(null);
    const tenantName = tenancy?.tenantName || "Tenant";
    try {
      const res = await fetch("/api/lettings/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "confirm", token, reference: confirmRef, tenantName }),
      });
      if (!res.ok) {
        confirmPublicRepair(token, confirmRef, tenantName);
      }
      setConfirmNote(`${confirmRef.trim().toUpperCase()} is with the office. It attaches once the repair is marked fixed.`);
      setConfirmRef("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm that repair.");
    }
  }

  async function sign(inspection: Inspection) {
    setError(null);
    setConfirmNote(null);
    const tenantName = tenancy?.tenantName || "Tenant";
    try {
      const res = await fetch("/api/lettings/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sign", token, inspectionId: inspection.id, tenantName }),
      });
      if (!res.ok) signPublicInspection(token, inspection.id, tenantName);
      setInspections((current) =>
        current.map((item) =>
          item.id === inspection.id ? { ...item, signedOffBy: tenantName, signedOffAt: new Date().toISOString() } : item,
        ),
      );
      setConfirmNote("Inspection signed. The office has your name on the report.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign that inspection.");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-lg">
        <BrandMark className="text-2xl text-[var(--foreground)]" accentClassName="text-[var(--accent)]" />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Repair report</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight">Tell us what’s wrong.</h1>
        {property ? (
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            {property.address}
            {tenancy ? `, ${tenancy.name}` : ""}. You don’t need an account. Write it the way you would text the office.
          </p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            This page is for a tenant report. No login.
          </p>
        )}

        {missing ? (
          <div className="mt-8 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-6" role="status">
            <h2 className="font-semibold">This repair link isn’t recognised</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Ask the office for the link or QR code for your address. If you smell gas, leave the building and call 0800 111 999.
            </p>
          </div>
        ) : null}

        {repair ? (
          <section className="mt-8 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]" role="status">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Reference</p>
            <p className="mt-1 font-display text-4xl tracking-tight">{repair.reference}</p>
            <p className="mt-3 font-medium">{repair.title}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={repair.urgency === "emergency" ? "danger" : repair.urgency === "urgent" ? "warning" : "neutral"}>
                {URGENCY_LABELS[repair.urgency]}
              </Badge>
              <Badge tone="accent">{TRADE_LABELS[repair.category]}</Badge>
              <Badge>{CHANNEL_LABELS[repair.channel]}</Badge>
            </div>
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
            {repair.emergency ? (
              <div className="mt-4 rounded-2xl border border-[var(--danger)] bg-[var(--danger-soft)] p-4" role="alert">
                <p className="font-semibold">{emergencyGuidance(repair.emergency).title}</p>
                <p className="mt-1 text-sm">{emergencyGuidance(repair.emergency).body}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--muted)]">
                The office has this on the repair timeline. Keep the reference if you need to confirm the fix later.
              </p>
            )}
            <Button
              className="mt-5"
              variant="secondary"
              onClick={() => {
                setRepair(null);
                setBody("");
              }}
            >
              Report something else
            </Button>
          </section>
        ) : property ? (
          <form
            className="mt-8 space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6"
            method="post"
            action="/api/lettings/report"
            onSubmit={onReport}
          >
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="action" value="report" />
            {property.rooms.length === 1 ? <input type="hidden" name="roomId" value={property.rooms[0].id} /> : null}
            {property.rooms.length > 1 ? (
              <label className="block text-sm font-medium">
                Which room?
                <select className={`${selectClass} mt-1.5`} name="roomId" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
                  {property.rooms.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.tenantName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block text-sm font-medium">
              What’s wrong?
              <Textarea
                className="mt-1.5"
                name="body"
                required
                minLength={8}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="The kitchen tap keeps dripping."
              />
            </label>
            {preview ? (
              <div className="rounded-2xl bg-[var(--surface-muted)] p-4 text-sm">
                <p className="font-medium">{preview.title}</p>
                <p className="mt-1 text-[var(--muted)]">
                  {TRADE_LABELS[preview.category]} · {URGENCY_LABELS[preview.urgency]} · reply by {formatWhen(preview.replyBy)}
                </p>
                {preview.guidance ? (
                  <p className="mt-2 font-medium text-[var(--danger)]" role="alert">
                    {preview.guidance.body}
                  </p>
                ) : null}
              </div>
            ) : null}
            <fieldset>
              <legend className="text-sm font-medium">How are you sending this?</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(Object.keys(CHANNEL_LABELS) as RepairChannel[]).map((item) => (
                  <label key={item} className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                    <input type="radio" name="channel" checked={channel === item} onChange={() => setChannel(item)} />
                    {CHANNEL_LABELS[item]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm font-medium">
              Photo, if you have one
              <input className="mt-1.5 block w-full text-sm" type="file" name="photo" accept="image/*" />
            </label>
            {error ? <p className="text-sm font-medium text-[var(--danger)]" role="alert">{error}</p> : null}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Sending…" : "Send report"}
            </Button>
          </form>
        ) : null}

        {property && !repair ? (
          <div className="mt-6 space-y-4">
            <form className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5" method="post" action="/api/lettings/report" onSubmit={onConfirm}>
              <h2 className="font-semibold">Confirm a finished repair</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Once the office has marked it fixed, add the reference to sign it off.</p>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="action" value="confirm" />
              <input type="hidden" name="tenantName" value={tenancy?.tenantName || "Tenant"} />
              <Input className="mt-3" name="reference" value={confirmRef} onChange={(event) => setConfirmRef(event.target.value)} placeholder="R-2026-0128" aria-label="Repair reference" />
              <Button type="submit" variant="secondary" className="mt-3">
                Confirm the fix
              </Button>
            </form>
            {inspections.filter((item) => !item.signedOffAt).length > 0 ? (
              <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5">
                <h2 className="font-semibold">Inspection to sign</h2>
                <ul className="mt-3 space-y-3">
                  {inspections
                    .filter((item) => !item.signedOffAt)
                    .map((inspection) => (
                      <li key={inspection.id} className="rounded-2xl bg-[var(--surface-muted)] p-3">
                        <p className="font-medium">
                          {INSPECTION_LABELS[inspection.kind]} · {inspection.at}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{inspection.notes}</p>
                        <form method="post" action="/api/lettings/report" onSubmit={(event) => { event.preventDefault(); void sign(inspection); }}>
                          <input type="hidden" name="token" value={token} />
                          <input type="hidden" name="action" value="sign" />
                          <input type="hidden" name="inspectionId" value={inspection.id} />
                          <input type="hidden" name="tenantName" value={tenancy?.tenantName || "Tenant"} />
                          <Button type="submit" size="sm" className="mt-3" variant="secondary">
                            Sign as {tenancy?.tenantName || "tenant"}
                          </Button>
                        </form>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}
            {confirmNote ? <p className="text-sm font-medium" role="status">{confirmNote}</p> : null}
            {error && repair === null ? null : null}
          </div>
        ) : null}
        {error && repair ? <p className="mt-4 text-sm font-medium text-[var(--danger)]" role="alert">{error}</p> : null}
      </div>
    </main>
  );
}
