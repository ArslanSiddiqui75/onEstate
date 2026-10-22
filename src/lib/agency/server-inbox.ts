import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createAppointment, createOffer, emptyAgencyInbox, knownBookingToken, seedPortal } from "@/lib/agency/book";
import type { AgencyInbox, Appointment, AppointmentKind, ClientOffer, PortalRecord, PortalRole } from "@/lib/agency/types";

const filePath = path.join(process.cwd(), "data", "agency-inbox.json");
let memory: AgencyInbox | null = null;

function readInbox(): AgencyInbox {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as AgencyInbox;
    memory = {
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
      offers: Array.isArray(parsed.offers) ? parsed.offers : [],
      approvals: Array.isArray(parsed.approvals) ? parsed.approvals : [],
      portals: Array.isArray(parsed.portals) ? parsed.portals : [],
    };
    return memory;
  } catch {
    return memory ?? emptyAgencyInbox();
  }
}

function writeInbox(inbox: AgencyInbox) {
  memory = inbox;
  try {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(inbox));
  } catch (err) {
    console.error("[agency] could not persist the office inbox", err);
  }
}

export function readAgencyInbox(): AgencyInbox {
  return readInbox();
}

const ROLES: PortalRole[] = ["vendor", "buyer", "landlord", "tenant"];

export function serverRecognisesToken(token: string) {
  if (knownBookingToken(token) || seedPortal(token)) return true;
  const inbox = readInbox();
  return inbox.portals.some((item) => item.token === token) || inbox.appointments.some((item) => item.bookToken === token);
}

export function serverPortal(token: string): PortalRecord | null {
  return seedPortal(token) ?? readInbox().portals.find((item) => item.token === token) ?? null;
}

export function fileServerPortal(input: {
  token: string;
  role: string;
  name: string;
  address: string;
  listingId?: string;
  leadId?: string;
  lettingsToken?: string;
}) {
  if (!ROLES.includes(input.role as PortalRole)) throw new Error("Choose a client role.");
  const name = input.name.trim();
  const address = input.address.trim();
  const token = input.token.trim();
  if (name.length < 2 || !address || token.length < 4) throw new Error("Add a name and address.");
  const portal: PortalRecord = {
    token,
    role: input.role as PortalRole,
    name,
    address,
    listingId: input.listingId?.trim() || undefined,
    leadId: input.leadId?.trim() || undefined,
    lettingsToken: input.lettingsToken?.trim() || undefined,
  };
  const inbox = readInbox();
  writeInbox({ ...inbox, portals: [portal, ...inbox.portals.filter((item) => item.token !== token)] });
  return portal;
}

export function fileServerBooking(input: {
  bookToken: string;
  kind: AppointmentKind;
  at: string;
  clientName: string;
  email?: string;
  phone?: string;
  address: string;
  notes?: string;
}): Appointment {
  if (!serverRecognisesToken(input.bookToken)) throw new Error("This booking link is not recognised.");
  const appointment = createAppointment(input);
  const inbox = readInbox();
  writeInbox({ ...inbox, appointments: [appointment, ...inbox.appointments] });
  return appointment;
}

export function fileServerOffer(input: {
  token: string;
  buyerName: string;
  amount: number;
  notes?: string;
}): ClientOffer {
  const portal = serverPortal(input.token);
  if (!portal) throw new Error("This client link is not recognised.");
  const offer = createOffer({
    address: portal.address,
    buyerName: input.buyerName,
    amount: input.amount,
    notes: input.notes,
  });
  const inbox = readInbox();
  writeInbox({ ...inbox, offers: [offer, ...inbox.offers] });
  return offer;
}

export function fileServerApproval(token: string, feedback?: string) {
  if (!serverPortal(token)) throw new Error("This client link is not recognised.");
  const inbox = readInbox();
  writeInbox({
    ...inbox,
    approvals: [...inbox.approvals, { token, at: new Date().toISOString(), feedback }],
  });
}
