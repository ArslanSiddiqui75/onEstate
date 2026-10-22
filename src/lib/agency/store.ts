import { addAppointment, addOffer, applyAgencyInbox, approvePortal, seedAgencyBook } from "@/lib/agency/book";
import type { AgencyBook, AgencyInbox, Appointment, ClientOffer } from "@/lib/agency/types";
import { emptyAgencyInbox } from "@/lib/agency/book";

const PREFIX = "certified_agency_v1:";
const INBOX_KEY = "certified_agency_inbox_v1";

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseBook(raw: string | null): AgencyBook | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as AgencyBook;
    if (value?.version !== 1 || !Array.isArray(value.appointments)) return null;
    return {
      ...seedAgencyBook(),
      ...value,
      portals: value.portals?.length ? value.portals : seedAgencyBook().portals,
    };
  } catch {
    return null;
  }
}

function readInbox(): AgencyInbox {
  const store = browserStorage();
  if (!store) return emptyAgencyInbox();
  try {
    const value = JSON.parse(store.getItem(INBOX_KEY) || "") as AgencyInbox;
    return {
      appointments: Array.isArray(value.appointments) ? value.appointments : [],
      offers: Array.isArray(value.offers) ? value.offers : [],
      approvals: Array.isArray(value.approvals) ? value.approvals : [],
      portals: Array.isArray(value.portals) ? value.portals : [],
    };
  } catch {
    return emptyAgencyInbox();
  }
}

function writeInbox(inbox: AgencyInbox) {
  browserStorage()?.setItem(INBOX_KEY, JSON.stringify(inbox));
}

export function loadAgencyBook(orgId: string): AgencyBook {
  const store = browserStorage();
  if (!store) return seedAgencyBook();
  const existing = parseBook(store.getItem(PREFIX + orgId));
  const merged = applyAgencyInbox(existing ?? seedAgencyBook(), readInbox());
  const serialized = JSON.stringify(merged.book);
  if (store.getItem(PREFIX + orgId) !== serialized) store.setItem(PREFIX + orgId, serialized);
  const rest = JSON.stringify(merged.rest);
  if (store.getItem(INBOX_KEY) !== rest) store.setItem(INBOX_KEY, rest);
  return merged.book;
}

export function saveAgencyBook(orgId: string, book: AgencyBook) {
  browserStorage()?.setItem(PREFIX + orgId, JSON.stringify(book));
}

export function submitLocalBooking(appointment: Appointment) {
  const inbox = readInbox();
  writeInbox({ ...inbox, appointments: [appointment, ...inbox.appointments] });
}

export function submitLocalOffer(offer: ClientOffer) {
  const inbox = readInbox();
  writeInbox({ ...inbox, offers: [offer, ...inbox.offers] });
}

export function submitLocalApproval(token: string, feedback?: string) {
  const inbox = readInbox();
  writeInbox({
    ...inbox,
    approvals: [...inbox.approvals, { token, at: new Date().toISOString(), feedback }],
  });
}

export function bookForToken(token: string): { orgId: string | null; book: AgencyBook } {
  const store = browserStorage();
  if (store) {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const book = parseBook(store.getItem(key));
      if (!book) continue;
      if (book.bookingToken === token || book.appointments.some((item) => item.bookToken === token) || book.portals.some((item) => item.token === token)) {
        return { orgId: key.slice(PREFIX.length), book: loadAgencyBook(key.slice(PREFIX.length)) };
      }
    }
  }
  return { orgId: null, book: seedAgencyBook() };
}

export function saveBooking(token: string, appointment: Appointment) {
  const located = bookForToken(token);
  if (located.orgId) {
    saveAgencyBook(located.orgId, addAppointment(located.book, appointment));
    return;
  }
  submitLocalBooking(appointment);
}

export function saveOfferForToken(token: string, offer: ClientOffer) {
  const located = bookForToken(token);
  if (located.orgId) {
    saveAgencyBook(located.orgId, addOffer(located.book, offer));
    return;
  }
  submitLocalOffer(offer);
}

export function saveApproval(token: string, feedback?: string) {
  const located = bookForToken(token);
  const at = new Date().toISOString();
  if (located.orgId) {
    saveAgencyBook(located.orgId, approvePortal(located.book, token, feedback, at));
    return;
  }
  submitLocalApproval(token, feedback);
}
