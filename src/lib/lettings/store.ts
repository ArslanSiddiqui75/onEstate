import { addRepair, applyInbox, createRepair, emptyInbox, seedBook, tryConfirmRepair, trySignInspection, withLettingsDefaults } from "@/lib/lettings/book";
import type { Inspection, LettingsBook, LettingsInbox, Property, Repair, RepairChannel } from "@/lib/lettings/types";

const PREFIX = "certified_lettings_v1:";
const INBOX_KEY = "certified_lettings_inbox_v1";
const INDEX_KEY = "certified_lettings_index_v1";

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseBook(raw: string | null): LettingsBook | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LettingsBook;
    if (value?.version !== 1 || !Array.isArray(value.properties) || !Array.isArray(value.repairs)) {
      return null;
    }
    return withLettingsDefaults({
      ...value,
      contractors: Array.isArray(value.contractors) ? value.contractors : [],
      keys: Array.isArray(value.keys) ? value.keys : [],
    });
  } catch {
    return null;
  }
}

function readInbox(): LettingsInbox {
  const store = browserStorage();
  if (!store) return emptyInbox();
  try {
    const value = JSON.parse(store.getItem(INBOX_KEY) || "") as LettingsInbox;
    if (!value || !Array.isArray(value.repairs)) return emptyInbox();
    return {
      repairs: value.repairs,
      confirmations: Array.isArray(value.confirmations) ? value.confirmations : [],
      inspectionSigns: Array.isArray(value.inspectionSigns) ? value.inspectionSigns : [],
    };
  } catch {
    return emptyInbox();
  }
}

function writeInbox(inbox: LettingsInbox) {
  browserStorage()?.setItem(INBOX_KEY, JSON.stringify(inbox));
}

function readIndex(): Record<string, string> {
  const store = browserStorage();
  if (!store) return {};
  try {
    const value = JSON.parse(store.getItem(INDEX_KEY) || "") as Record<string, string>;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeIndex(orgId: string, book: LettingsBook) {
  const store = browserStorage();
  if (!store) return;
  const index = readIndex();
  for (const property of book.properties) index[property.reportToken] = orgId;
  store.setItem(INDEX_KEY, JSON.stringify(index));
}

export function loadBook(orgId: string): LettingsBook {
  const store = browserStorage();
  if (!store) return seedBook();
  const existing = parseBook(store.getItem(PREFIX + orgId));
  const merged = applyInbox(existing ?? seedBook(), readInbox());
  store.setItem(PREFIX + orgId, JSON.stringify(merged.book));
  writeInbox(merged.rest);
  writeIndex(orgId, merged.book);
  return merged.book;
}

export function saveBook(orgId: string, book: LettingsBook) {
  const store = browserStorage();
  if (!store) return;
  store.setItem(PREFIX + orgId, JSON.stringify(book));
  writeIndex(orgId, book);
}

function bookForToken(token: string): { orgId: string | null; book: LettingsBook; property: Property } | null {
  const store = browserStorage();
  const indexedOrg = readIndex()[token];
  if (indexedOrg) {
    const book = loadBook(indexedOrg);
    const property = book.properties.find((item) => item.reportToken === token);
    if (property) return { orgId: indexedOrg, book, property };
  }
  if (store) {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const book = parseBook(store.getItem(key));
      const property = book?.properties.find((item) => item.reportToken === token);
      if (book && property) return { orgId: key.slice(PREFIX.length), book, property };
    }
  }
  const seeded = seedBook();
  const property = seeded.properties.find((item) => item.reportToken === token);
  if (!property) return null;
  const merged = applyInbox(seeded, readInbox()).book;
  return {
    orgId: null,
    book: merged,
    property: merged.properties.find((item) => item.reportToken === token) ?? property,
  };
}

export interface PropertyLink {
  property: Property;
  inspections: Inspection[];
  savedToOffice: boolean;
}

export function lookupReportLink(token: string): PropertyLink | null {
  const located = bookForToken(token);
  if (!located) return null;
  return {
    property: located.property,
    inspections: located.book.inspections.filter((item) => item.propertyId === located.property.id),
    savedToOffice: located.orgId !== null,
  };
}

export interface PublicReportInput {
  roomId: string;
  body: string;
  channel: RepairChannel;
  photo?: { name: string; dataUrl?: string };
}

export function submitPublicReport(token: string, input: PublicReportInput): { repair: Repair; property: Property } {
  const located = bookForToken(token);
  if (!located) throw new Error("This repair link is not recognised.");
  const repair = createRepair(located.book, {
    propertyId: located.property.id,
    roomId: input.roomId,
    body: input.body,
    channel: input.channel,
    photo: input.photo,
  });
  if (located.orgId) {
    saveBook(located.orgId, addRepair(located.book, repair));
  } else {
    const inbox = readInbox();
    inbox.repairs.unshift(repair);
    writeInbox(inbox);
  }
  return { repair, property: located.property };
}

export function confirmPublicRepair(token: string, reference: string, tenantName: string) {
  const located = bookForToken(token);
  if (!located) throw new Error("This repair link is not recognised.");
  const at = new Date().toISOString();
  const next = tryConfirmRepair(located.book, reference, tenantName, at);
  if (next === located.book) {
    throw new Error("That reference can be confirmed once the office has marked it fixed.");
  }
  if (located.orgId) {
    saveBook(located.orgId, next);
    return;
  }
  const inbox = readInbox();
  inbox.confirmations.push({ reference: reference.trim(), at, tenantName });
  writeInbox(inbox);
}

export function signPublicInspection(token: string, inspectionId: string, tenantName: string) {
  const located = bookForToken(token);
  if (!located) throw new Error("This repair link is not recognised.");
  const at = new Date().toISOString();
  const next = trySignInspection(located.book, inspectionId, tenantName, at);
  if (next === located.book) throw new Error("That inspection is already signed, or it is not on this link.");
  if (located.orgId) {
    saveBook(located.orgId, next);
    return;
  }
  const inbox = readInbox();
  inbox.inspectionSigns.push({ inspectionId, at, tenantName });
  writeInbox(inbox);
}
