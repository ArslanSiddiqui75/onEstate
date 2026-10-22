import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRepair, seedBook } from "@/lib/lettings/book";
import type { LettingsInbox, Repair, RepairChannel } from "@/lib/lettings/types";

const filePath = path.join(process.cwd(), "data", "lettings-inbox.json");

let memory: LettingsInbox | null = null;

function empty(): LettingsInbox {
  return { repairs: [], confirmations: [], inspectionSigns: [] };
}

function readInbox(): LettingsInbox {
  if (memory) return memory;
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as LettingsInbox;
    memory = {
      repairs: Array.isArray(parsed.repairs) ? parsed.repairs : [],
      confirmations: Array.isArray(parsed.confirmations) ? parsed.confirmations : [],
      inspectionSigns: Array.isArray(parsed.inspectionSigns) ? parsed.inspectionSigns : [],
    };
  } catch {
    memory = empty();
  }
  return memory;
}

function writeInbox(inbox: LettingsInbox) {
  memory = inbox;
  try {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(inbox));
  } catch (err) {
    console.error("[lettings] could not persist the office inbox", err);
  }
}

export function readServerInbox(): LettingsInbox {
  return readInbox();
}

export function findServerRepair(reference: string): Repair | null {
  const key = reference.trim().toUpperCase();
  return readInbox().repairs.find((repair) => repair.reference.toUpperCase() === key) ?? null;
}

export function fileServerReport(input: {
  token: string;
  roomId?: string;
  body: string;
  channel: RepairChannel;
  photo?: { name: string; dataUrl?: string };
}): Repair {
  const inbox = readInbox();
  const seed = seedBook();
  const property = seed.properties.find((item) => item.reportToken === input.token);
  if (!property) throw new Error("This repair link is not recognised.");
  const room = property.rooms.find((item) => item.id === input.roomId) ?? property.rooms[0];
  if (!room) throw new Error("Choose a room.");
  const repair = createRepair({ ...seed, repairs: [...inbox.repairs, ...seed.repairs] }, {
    propertyId: property.id,
    roomId: room.id,
    body: input.body,
    channel: input.channel,
    photo: input.photo,
  });
  writeInbox({ ...inbox, repairs: [repair, ...inbox.repairs] });
  return repair;
}

export function fileServerConfirmation(input: { reference: string; tenantName: string }) {
  const reference = input.reference.trim();
  if (!reference) throw new Error("Add the repair reference.");
  const inbox = readInbox();
  writeInbox({
    ...inbox,
    confirmations: [
      ...inbox.confirmations,
      { reference, tenantName: input.tenantName.trim() || "Tenant", at: new Date().toISOString() },
    ],
  });
}

export function fileServerInspectionSign(input: { inspectionId: string; tenantName: string }) {
  if (!input.inspectionId) throw new Error("That inspection is not on this link.");
  const inbox = readInbox();
  writeInbox({
    ...inbox,
    inspectionSigns: [
      ...inbox.inspectionSigns,
      {
        inspectionId: input.inspectionId,
        tenantName: input.tenantName.trim() || "Tenant",
        at: new Date().toISOString(),
      },
    ],
  });
}
