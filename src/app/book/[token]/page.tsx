import { MenuSelect } from "@/components/ui/select";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BOOKING_ADDRESSES, BOOKING_SLOTS } from "@/lib/agency/book";
import { readAgencyInbox, serverRecognisesToken } from "@/lib/agency/server-inbox";
import { defaultMarket, marketFromHost } from "@/lib/brand/host";
import { formatWhen } from "@/lib/lettings/format";
import type { Market } from "@/types";

function marketFromHeaders(headerList: Headers): Market {
  const explicit = headerList.get("x-onestreet-market");
  if (explicit === "uk" || explicit === "us") return explicit;
  return marketFromHost(headerList.get("x-forwarded-host") || headerList.get("host") || "") ?? defaultMarket();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    title: token === "elm-grove" ? "Book a viewing at 14 Elm Grove" : "Book a viewing or valuation",
    description: "Request a time with the office. No account needed.",
  };
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { token } = await params;
  const { sent, error } = await searchParams;
  const us = marketFromHeaders(await headers()) === "us";
  const recognised = serverRecognisesToken(token);
  const inbox = readAgencyInbox();
  const appointment = sent ? inbox.appointments.find((item) => item.id === sent) : null;
  const fixedAddress = token === "elm-grove" ? "14 Elm Grove" : null;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-10">
      <Link href="/" className="text-lg">
        <BrandMark />
      </Link>
      <p className="eyebrow mt-8">{us ? "Calendar" : "Diary"}</p>
      <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight">
        {fixedAddress ? `View ${fixedAddress}` : "Request a time"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        The office confirms the slot on the {us ? "calendar" : "diary"}. You don’t need an account.
      </p>

      {!recognised ? (
        <p className="mt-8 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 text-sm" role="status">
          This booking link is not recognised. Ask the office for a fresh one.
        </p>
      ) : null}

      {error === "invalid" ? (
        <p className="mt-6 rounded-[1.25rem] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium" role="status">
          Add your name, a property, and a time, then send it again.
        </p>
      ) : null}
      {error === "unavailable" ? (
        <p className="mt-6 rounded-[1.25rem] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium" role="status">
          The office can’t take this request from the link yet. Call them instead.
        </p>
      ) : null}

      {appointment ? (
        <section className="mt-6 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5" role="status">
          <p className="text-sm font-semibold">Request received</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {appointment.clientName} · {appointment.kind === "valuation" ? "Valuation" : "Viewing"} at {appointment.address}
          </p>
          <p className="mt-1 text-sm">{formatWhen(appointment.at)}</p>
          <p className="mt-3 text-sm text-[var(--muted)]">Reference {appointment.id}. The office will confirm it.</p>
        </section>
      ) : null}

      {recognised ? (
        <form method="post" action="/api/agency" className="mt-8 space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-card)]">
          <input type="hidden" name="action" value="book" />
          <input type="hidden" name="token" value={token} />
          {fixedAddress ? <input type="hidden" name="address" value={fixedAddress} /> : null}
          {fixedAddress ? <input type="hidden" name="kind" value="viewing" /> : null}
          <label className="block text-sm font-medium">
            Your name
            <Input className="mt-1.5" name="clientName" required minLength={2} autoComplete="name" />
          </label>
          <label className="block text-sm font-medium">
            Email
            <Input className="mt-1.5" name="email" type="email" autoComplete="email" />
          </label>
          <label className="block text-sm font-medium">
            Phone
            <Input className="mt-1.5" name="phone" type="tel" autoComplete="tel" />
          </label>
          {fixedAddress ? null : (
            <>
              <label className="block text-sm font-medium">
                What do you need
                <MenuSelect name="kind" className="mt-1.5 h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm" defaultValue="viewing">
                  <option value="viewing">Viewing</option>
                  <option value="valuation">Valuation</option>
                </MenuSelect>
              </label>
              <label className="block text-sm font-medium">
                Property
                <MenuSelect name="address" required className="mt-1.5 h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm" defaultValue={BOOKING_ADDRESSES[0]}>
                  {BOOKING_ADDRESSES.map((address) => (
                    <option key={address} value={address}>
                      {address}
                    </option>
                  ))}
                </MenuSelect>
              </label>
            </>
          )}
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
          <label className="block text-sm font-medium">
            Note
            <Input className="mt-1.5" name="notes" />
          </label>
          <Button type="submit" className="w-full rounded-full">
            Request this time
          </Button>
        </form>
      ) : null}
    </main>
  );
}
