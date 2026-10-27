import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BOOKING_SLOTS, seedAgencyBook } from "@/lib/agency/book";
import { PORTAL_ROLE_LABELS } from "@/lib/agency/types";
import { readAgencyInbox, serverPortal } from "@/lib/agency/server-inbox";
import { seedBook, seedPropertyByToken } from "@/lib/lettings/book";
import { formatWhen, gbp } from "@/lib/lettings/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const portal = serverPortal(token);
  const who = portal ? PORTAL_ROLE_LABELS[portal.role] : "Client";
  return {
    title: portal ? `${who} · ${portal.address}` : "Client link",
    description: "A private link for this instruction. No account needed.",
  };
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; error?: string; ref?: string }>;
}) {
  const { token } = await params;
  const { done, error, ref } = await searchParams;
  const inbox = readAgencyInbox();
  const base = serverPortal(token);
  const approval = [...inbox.approvals].reverse().find((item) => item.token === token);
  const portal = base
    ? {
        ...base,
        approvedAt: approval?.at || base.approvedAt,
        feedback: approval?.feedback?.trim() || base.feedback,
      }
    : null;
  const property = portal?.lettingsToken ? seedPropertyByToken(portal.lettingsToken) : null;
  const repairs = property
    ? seedBook().repairs.filter((item) => item.propertyId === property.id && item.status !== "tenant_confirmed")
    : [];
  const offers = portal
    ? [...seedAgencyBook().offers, ...inbox.offers].filter((item) => item.address === portal.address)
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-10">
      <Link href="/" className="text-lg">
        <BrandMark />
      </Link>
      {!portal ? (
        <>
          <h1 className="mt-8 font-display text-4xl tracking-tight">This link is not recognised</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">Ask the office for a fresh client link.</p>
        </>
      ) : (
        <>
          <p className="eyebrow mt-8">{PORTAL_ROLE_LABELS[portal.role]}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight">{portal.address}</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">For {portal.name}. No account needed.</p>

          {error === "invalid" ? (
            <p className="mt-6 rounded-[1.25rem] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium" role="status">
              Check the details and send that again.
            </p>
          ) : null}
          {done === "approved" || portal.approvedAt ? (
            <p className="mt-6 rounded-[1.25rem] bg-[var(--success-soft)] px-4 py-3 text-sm font-medium" role="status">
              {portal.role === "landlord" ? "Repair approval received." : "Listing approval received."}
              {portal.approvedAt ? ` ${formatWhen(portal.approvedAt)}.` : ""}
            </p>
          ) : null}
          {done === "offer" ? (
            <p className="mt-6 rounded-[1.25rem] bg-[var(--success-soft)] px-4 py-3 text-sm font-medium" role="status">
              Offer received{ref ? ` · ${ref}` : ""}. The office will see it on the deal.
            </p>
          ) : null}

          {portal.feedback ? (
            <section className="mt-6 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
              <p className="text-sm font-semibold">From the office</p>
              <p className="mt-2 text-sm leading-relaxed">{portal.feedback}</p>
            </section>
          ) : null}

          {portal.role === "vendor" ? (
            <form method="post" action="/api/agency" className="mt-6 space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
              <input type="hidden" name="action" value="approve" />
              <input type="hidden" name="token" value={token} />
              <p className="text-sm font-semibold">Approve the listing</p>
              <p className="text-sm text-[var(--muted)]">The office is ready to market {portal.address}. Add a note if you want a change first.</p>
              <label className="block text-sm font-medium">
                Note
                <Input className="mt-1.5" name="feedback" />
              </label>
              <Button type="submit" className="rounded-full">
                Approve the listing
              </Button>
            </form>
          ) : null}

          {portal.role === "buyer" ? (
            <div className="mt-6 space-y-4">
              <form method="post" action="/api/agency" className="space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
                <input type="hidden" name="action" value="book" />
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="kind" value="viewing" />
                <input type="hidden" name="address" value={portal.address} />
                <p className="text-sm font-semibold">Book a viewing</p>
                <label className="block text-sm font-medium">
                  Your name
                  <Input className="mt-1.5" name="clientName" required minLength={2} defaultValue={portal.name} />
                </label>
                <fieldset>
                  <legend className="text-sm font-medium">Time</legend>
                  <div className="mt-2 grid gap-2">
                    {BOOKING_SLOTS.map((slot) => (
                      <label key={slot.value} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                        <input type="radio" name="at" value={slot.value} required className="accent-[var(--accent)]" />
                        {slot.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Button type="submit" className="rounded-full">
                  Request a viewing
                </Button>
              </form>
              <form method="post" action="/api/agency" className="space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
                <input type="hidden" name="action" value="offer" />
                <input type="hidden" name="token" value={token} />
                <p className="text-sm font-semibold">Submit an offer</p>
                <label className="block text-sm font-medium">
                  Buyer
                  <Input className="mt-1.5" name="buyerName" required defaultValue={portal.name} />
                </label>
                <label className="block text-sm font-medium">
                  Amount (£)
                  <Input className="mt-1.5" name="amount" type="number" min={1} required />
                </label>
                <label className="block text-sm font-medium">
                  Conditions
                  <Input className="mt-1.5" name="notes" placeholder="Subject to survey" />
                </label>
                <Button type="submit" variant="secondary" className="rounded-full">
                  Send the offer
                </Button>
              </form>
              {offers.length ? (
                <ul className="space-y-2 text-sm">
                  {offers.map((offer) => (
                    <li key={offer.id} className="rounded-xl border border-[var(--border)] px-3 py-2">
                      {offer.buyerName} · {gbp(offer.amount)} · {offer.status}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {portal.role === "landlord" && property ? (
            <section className="mt-6 space-y-4">
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
                <p className="text-sm font-semibold">Rent</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {property.rooms.map((room) => (
                    <li key={room.id} className="flex items-center justify-between gap-3">
                      <span>
                        {room.name} · {room.tenantName}
                      </span>
                      <span className="font-medium">
                        {gbp(room.rentPcm)} · {room.rentStatus}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {repairs.length ? (
                <ul className="space-y-2 text-sm">
                  {repairs.map((repair) => (
                    <li key={repair.id} className="rounded-xl border border-[var(--border)] px-3 py-2">
                      {repair.reference} · {repair.title} · {repair.status.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--muted)]">No open repairs on this let.</p>
              )}
              <form method="post" action="/api/agency" className="space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
                <input type="hidden" name="action" value="approve" />
                <input type="hidden" name="token" value={token} />
                <p className="text-sm font-semibold">Approve the repair</p>
                <label className="block text-sm font-medium">
                  Note
                  <Input className="mt-1.5" name="feedback" placeholder="Go ahead" />
                </label>
                <Button type="submit" className="rounded-full">
                  Approve
                </Button>
              </form>
            </section>
          ) : null}

          {portal.role === "tenant" ? (
            <section className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5">
              <p className="text-sm font-semibold">Report a repair</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Photos and a description go straight to the office. If you smell gas, leave and call 0800 111 999.
              </p>
              {portal.lettingsToken ? (
                <Button asChild className="mt-4 rounded-full">
                  <Link href={`/report/${portal.lettingsToken}`}>Open the repair form</Link>
                </Button>
              ) : (
                <p className="mt-3 text-sm">The office has not attached a repair link yet.</p>
              )}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
