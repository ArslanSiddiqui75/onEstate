import type {
  AgencyBook,
  AgencyInbox,
  Appointment,
  AppointmentKind,
  ClientOffer,
  FeeRequest,
  PortalRecord,
  ReferralNote,
} from "@/lib/agency/types";

export function newAgencyId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function secretLinkToken(prefix: string) {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const body = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${prefix}-${body}`;
}

export function seedAgencyBook(): AgencyBook {
  return {
    version: 1,
    bookingToken: "harbour",
    appointments: [
      {
        id: "apt_elm",
        kind: "viewing",
        status: "confirmed",
        at: "2026-10-22T14:00:00.000Z",
        clientName: "Sam Okonkwo",
        email: "sam@example.com",
        address: "14 Elm Grove",
        bookToken: "elm-grove",
        notes: "Second viewing. Vendor is in.",
      },
      {
        id: "apt_quay",
        kind: "valuation",
        status: "requested",
        at: "2026-10-23T10:30:00.000Z",
        clientName: "Helen Croft",
        email: "helen@example.com",
        address: "Flat 2, Quay Walk",
        bookToken: "harbour",
        notes: "Wants a figure before instructing.",
      },
    ],
    offers: [
      {
        id: "off_harbour",
        address: "8 Harbour Street",
        buyerName: "Sam Okonkwo",
        amount: 425000,
        currency: "GBP",
        status: "submitted",
        at: "2026-10-21T16:10:00.000Z",
        notes: "Subject to survey.",
      },
    ],
    portals: [
      {
        token: "vendor-elm",
        role: "vendor",
        name: "Alex Harbour",
        address: "14 Elm Grove",
        feedback: "Two viewings booked. One couple asked about the garden.",
      },
      {
        token: "buyer-elm",
        role: "buyer",
        name: "Sam Okonkwo",
        address: "14 Elm Grove",
      },
      {
        token: "landlord-oak",
        role: "landlord",
        name: "Helen Croft",
        address: "12 Oak Road",
        lettingsToken: "oak-road",
      },
      {
        token: "tenant-oak",
        role: "tenant",
        name: "Priya Shah",
        address: "12 Oak Road, Flat 2",
        lettingsToken: "oak-road",
      },
    ],
    fees: [
      {
        id: "fee_elm",
        address: "14 Elm Grove",
        label: "Sales fee",
        amount: 4500,
        currency: "GBP",
        status: "requested",
        at: "2026-10-18T09:00:00.000Z",
      },
    ],
    referrals: [
      {
        id: "ref_elm",
        address: "14 Elm Grove",
        introducer: "Harbour Introductions",
        status: "agreed",
        fee: 750,
        currency: "GBP",
      },
    ],
  };
}

export function emptyAgencyInbox(): AgencyInbox {
  return { appointments: [], offers: [], approvals: [], portals: [] };
}

const SLOT_TIMES = [
  { hour: 10, minute: 0 },
  { hour: 13, minute: 0 },
  { hour: 16, minute: 0 },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Upcoming request slots: three per weekday for the next five weekdays,
 * starting at least a day out so the office has time to confirm.
 */
export function bookingSlots(from: Date = new Date()): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let weekdays = 0;
  while (weekdays < 5) {
    day.setDate(day.getDate() + 1);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    weekdays += 1;
    for (const { hour, minute } of SLOT_TIMES) {
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
      const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
      const label = `${at.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}, ${at
        .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })
        .replace(" ", "")}`;
      out.push({ value: `${date}T${pad(hour)}:${pad(minute)}`, label });
    }
  }
  return out;
}

export const BOOKING_ADDRESSES = ["14 Elm Grove", "Flat 2, Quay Walk", "8 Harbour Street"] as const;

export function portalByToken(book: AgencyBook, token: string): PortalRecord | null {
  return book.portals.find((item) => item.token === token) ?? null;
}

export function seedPortal(token: string): PortalRecord | null {
  return portalByToken(seedAgencyBook(), token);
}

export function knownBookingToken(token: string) {
  const book = seedAgencyBook();
  if (book.bookingToken === token) return true;
  return book.appointments.some((item) => item.bookToken === token) || token === "elm-grove";
}

export function addAppointment(book: AgencyBook, appointment: Appointment): AgencyBook {
  if (book.appointments.some((item) => item.id === appointment.id)) return book;
  return { ...book, appointments: [appointment, ...book.appointments] };
}

export function setAppointmentStatus(
  book: AgencyBook,
  id: string,
  status: Appointment["status"],
): AgencyBook {
  return {
    ...book,
    appointments: book.appointments.map((item) => (item.id === id ? { ...item, status } : item)),
  };
}

export function createAppointment(input: {
  bookToken: string;
  kind: AppointmentKind;
  at: string;
  clientName: string;
  email?: string;
  phone?: string;
  address: string;
  notes?: string;
}): Appointment {
  const clientName = input.clientName.trim();
  if (clientName.length < 2) throw new Error("Add your name.");
  if (!input.address.trim()) throw new Error("Choose the property.");
  if (!input.at) throw new Error("Choose a time.");
  const when = new Date(input.at);
  if (Number.isNaN(when.getTime())) throw new Error("Choose a time.");
  if (when.getTime() < Date.now()) throw new Error("Choose a time in the future.");
  if (clientName.length > 120 || input.address.length > 200 || (input.notes?.length ?? 0) > 1000) {
    throw new Error("That request is too long.");
  }
  const email = input.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Check your email address.");
  return {
    id: newAgencyId("apt"),
    kind: input.kind,
    status: "requested",
    at: new Date(input.at).toISOString(),
    clientName,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    address: input.address.trim(),
    bookToken: input.bookToken,
    notes: input.notes?.trim() || undefined,
  };
}

export function addOffer(book: AgencyBook, offer: ClientOffer): AgencyBook {
  if (book.offers.some((item) => item.id === offer.id)) return book;
  return { ...book, offers: [offer, ...book.offers] };
}

export function createOffer(input: {
  address: string;
  buyerName: string;
  amount: number;
  currency?: "GBP" | "USD";
  notes?: string;
  listingId?: string;
}): ClientOffer {
  if (!input.buyerName.trim()) throw new Error("Add the buyer’s name.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Add the offer amount.");
  return {
    id: newAgencyId("off"),
    address: input.address.trim(),
    buyerName: input.buyerName.trim(),
    amount: input.amount,
    currency: input.currency || "GBP",
    status: "submitted",
    at: new Date().toISOString(),
    notes: input.notes?.trim() || undefined,
    listingId: input.listingId,
  };
}

export function setOfferStatus(book: AgencyBook, id: string, status: ClientOffer["status"]): AgencyBook {
  return {
    ...book,
    offers: book.offers.map((item) => (item.id === id ? { ...item, status } : item)),
  };
}

export function approvePortal(book: AgencyBook, token: string, feedback: string | undefined, at: string): AgencyBook {
  let found = false;
  const portals = book.portals.map((item) => {
    if (item.token !== token) return item;
    found = true;
    return { ...item, approvedAt: at, feedback: feedback?.trim() || item.feedback };
  });
  if (!found) return book;
  return { ...book, portals };
}

export function addFee(book: AgencyBook, fee: FeeRequest): AgencyBook {
  return { ...book, fees: [fee, ...book.fees] };
}

export function setFeeStatus(book: AgencyBook, id: string, status: FeeRequest["status"]): AgencyBook {
  return { ...book, fees: book.fees.map((item) => (item.id === id ? { ...item, status } : item)) };
}

export function addReferral(book: AgencyBook, referral: ReferralNote): AgencyBook {
  return { ...book, referrals: [referral, ...book.referrals] };
}

export function issuePortal(
  book: AgencyBook,
  input: {
    role: PortalRecord["role"];
    name: string;
    address: string;
    listingId?: string;
    leadId?: string;
    lettingsToken?: string;
  },
): { book: AgencyBook; portal: PortalRecord } {
  const name = input.name.trim();
  const address = input.address.trim();
  if (name.length < 2) throw new Error("Add the client’s name.");
  if (!address) throw new Error("Add the address.");
  const existing = input.leadId
    ? book.portals.find((item) => item.role === input.role && item.leadId === input.leadId)
    : undefined;
  if (existing) return { book, portal: existing };
  const portal: PortalRecord = {
    token: secretLinkToken(input.role),
    role: input.role,
    name,
    address,
    listingId: input.listingId || undefined,
    leadId: input.leadId || undefined,
    lettingsToken: input.lettingsToken?.trim() || undefined,
  };
  return { book: { ...book, portals: [portal, ...book.portals] }, portal };
}

export function createFee(input: {
  dealId?: string;
  address: string;
  label: string;
  amount: number;
  currency: "GBP" | "USD";
}): FeeRequest {
  if (!input.label.trim()) throw new Error("Name the fee.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Add the fee amount.");
  return {
    id: newAgencyId("fee"),
    dealId: input.dealId,
    address: input.address.trim(),
    label: input.label.trim(),
    amount: input.amount,
    currency: input.currency,
    status: "requested",
    at: new Date().toISOString(),
  };
}

export function createReferral(input: {
  dealId?: string;
  address: string;
  introducer: string;
  fee: number;
  currency: "GBP" | "USD";
}): ReferralNote {
  if (input.introducer.trim().length < 2) throw new Error("Name the introducer.");
  if (!Number.isFinite(input.fee) || input.fee < 0) throw new Error("Add the referral fee.");
  return {
    id: newAgencyId("ref"),
    dealId: input.dealId,
    address: input.address.trim(),
    introducer: input.introducer.trim(),
    status: "introduced",
    fee: input.fee,
    currency: input.currency,
  };
}

export function applyAgencyInbox(book: AgencyBook, inbox: AgencyInbox) {
  const rest = emptyAgencyInbox();
  let next = book;
  for (const portal of inbox.portals ?? []) {
    if (next.portals.some((item) => item.token === portal.token)) continue;
    next = { ...next, portals: [portal, ...next.portals] };
  }
  for (const appointment of inbox.appointments) {
    const updated = addAppointment(next, appointment);
    if (updated === next) continue;
    next = updated;
  }
  for (const offer of inbox.offers) {
    const updated = addOffer(next, offer);
    if (updated === next) continue;
    next = updated;
  }
  for (const approval of inbox.approvals) {
    const updated = approvePortal(next, approval.token, approval.feedback, approval.at);
    if (updated === next) {
      const portal = next.portals.find((item) => item.token === approval.token);
      if (portal && !portal.approvedAt) rest.approvals.push(approval);
    } else {
      next = updated;
    }
  }
  return { book: next, rest };
}

export function draftListing(input: {
  title: string;
  address: string;
  city: string;
  beds: number;
  baths: number;
  price: number;
  market: "uk" | "us";
  tenure?: string;
}) {
  const money = new Intl.NumberFormat(input.market === "uk" ? "en-GB" : "en-US", {
    style: "currency",
    currency: input.market === "uk" ? "GBP" : "USD",
    maximumFractionDigits: 0,
  }).format(input.price);
  const home = input.market === "uk" ? "home" : "home";
  const hold = input.tenure ? ` ${input.tenure}` : "";
  return `${input.title} at ${input.address}, ${input.city}. A ${input.beds}-bedroom, ${input.baths}-bath${hold} ${home}, guided at ${money}. Arrange a ${input.market === "uk" ? "viewing" : "showing"} with the office.`;
}

export function draftSaleSummary(input: {
  listingTitle: string;
  stage: string;
  parties: string[];
  checklist: { label: string; done: boolean }[];
  notes?: string;
  value: number;
  currency: "GBP" | "USD";
}) {
  const money = new Intl.NumberFormat(input.currency === "GBP" ? "en-GB" : "en-US", {
    style: "currency",
    currency: input.currency,
    maximumFractionDigits: 0,
  }).format(input.value);
  const open = input.checklist.filter((item) => !item.done).map((item) => item.label);
  const done = input.checklist.filter((item) => item.done).length;
  const next = open.length ? `Next: ${open.slice(0, 3).join(", ")}.` : "Checklist is complete.";
  return `${input.listingTitle} is at ${input.stage}. Price on the file: ${money}. Parties: ${input.parties.join(", ") || "not named"}. ${done} of ${input.checklist.length} steps done. ${next}${input.notes ? ` Note: ${input.notes}` : ""}`;
}
