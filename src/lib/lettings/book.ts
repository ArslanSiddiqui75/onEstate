import { gbp, marketPosition, rentIncreaseNote, escapeHtml, formatDay, formatWhen } from "@/lib/lettings/format";
import { nextReference, triageReport } from "@/lib/lettings/triage";
import type {
  ComplianceItem,
  ComplianceKind,
  Inspection,
  InspectionKind,
  Jurisdiction,
  LettingsBook,
  LettingsInbox,
  Property,
  Repair,
  RepairChannel,
  RepairStatus,
  RentStatus,
  RightToRent,
  TenancyRoom,
  TenancyStage,
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

const STAGE_INDEX: Record<RepairStatus, number> = {
  reported: 0,
  acknowledged: 1,
  booked: 2,
  fixed: 3,
  tenant_confirmed: 4,
};

export function newLettingsId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;
}

function room(
  id: string,
  name: string,
  tenantName: string,
  rentPcm: number,
  marketRentPcm: number,
  rentStatus: RentStatus,
  depositScheme: string,
  paidAt?: string,
  rightToRent: RightToRent = "clear",
): TenancyRoom {
  return {
    id,
    name,
    tenantName,
    rentPcm,
    marketRentPcm,
    rentStatus,
    depositProtected: true,
    depositScheme,
    paidAt,
    rightToRent,
  };
}

export function seedBook(): LettingsBook {
  return {
    version: 1,
    properties: [
      {
        id: "p_oak",
        address: "12 Oak Road",
        city: "Bristol",
        postcode: "BS1 4DJ",
        jurisdiction: "england",
        hmo: false,
        tenancyStage: "active",
        reportToken: "oak-road",
        rooms: [
          room("r_oak2", "Flat 2", "Priya Shah", 1250, 1420, "received", "TDS", "2026-10-02"),
        ],
      },
      {
        id: "p_quay",
        address: "4 Quay Street",
        city: "Bristol",
        postcode: "BS1 5AH",
        jurisdiction: "england",
        hmo: false,
        tenancyStage: "let_agreed",
        reportToken: "quay-street",
        rooms: [
          room("r_quay1", "Flat 1", "Lena Brooks", 1100, 1100, "received", "DPS", "2026-10-01"),
        ],
      },
      {
        id: "p_leith",
        address: "18 Leith Walk",
        city: "Edinburgh",
        postcode: "EH6 8SA",
        jurisdiction: "scotland",
        hmo: false,
        tenancyStage: "move_in",
        reportToken: "leith-walk",
        rooms: [
          room(
            "r_leith",
            "Whole let",
            "Daniel Adeyemi",
            1650,
            1700,
            "received",
            "SafeDeposits Scotland",
            "2026-10-03",
          ),
        ],
      },
      {
        id: "p_station",
        address: "21 Station Road",
        city: "Cardiff",
        postcode: "CF10 1EP",
        jurisdiction: "wales",
        hmo: false,
        tenancyStage: "marketing",
        reportToken: "station-road",
        rooms: [
          room("r_station3", "Flat 3", "Mei Chen", 1400, 1350, "received", "MyDeposits", "2026-10-02"),
        ],
      },
      {
        id: "p_harbour",
        address: "8 Harbour Lane",
        city: "Bristol",
        postcode: "BS8 1TH",
        jurisdiction: "england",
        hmo: true,
        tenancyStage: "active",
        reportToken: "harbour-lane",
        rooms: [
          room("r_h1", "Room 1", "Samira Ali", 725, 740, "received", "TDS", "2026-10-01"),
          room("r_h2", "Room 2", "Owen Price", 680, 700, "received", "TDS", "2026-10-01"),
          room("r_h3", "Room 3", "Hannah Cole", 650, 690, "received", "TDS", "2026-10-04"),
          room("r_h4", "Room 4", "Jordan Hale", 450, 620, "late", "TDS", undefined, "pending"),
          room("r_h5", "Room 5", "Chris Ward", 995, 1000, "received", "TDS", "2026-10-01"),
        ],
      },
    ],
    repairs: [
      {
        id: "rep_tap",
        reference: "R-2026-0139",
        propertyId: "p_oak",
        roomId: "r_oak2",
        title: "The kitchen tap keeps dripping",
        body: "The kitchen tap keeps dripping. It's worse overnight.",
        category: "plumbing",
        urgency: "routine",
        emergency: null,
        status: "booked",
        replyBy: "2026-10-21T09:14:00.000Z",
        fixBy: "2026-11-01T09:14:00.000Z",
        createdAt: "2026-10-18T09:14:00.000Z",
        channel: "text",
        tradesperson: "M. Patel Plumbing",
        appointmentAt: "2026-10-22T10:00:00.000Z",
        photos: [],
        events: [
          {
            id: "evt_tap_1",
            at: "2026-10-18T09:14:00.000Z",
            kind: "reported",
            label: "Reported",
            detail: "Text from Priya Shah",
          },
          {
            id: "evt_tap_2",
            at: "2026-10-18T11:02:00.000Z",
            kind: "acknowledged",
            label: "Acknowledged",
            detail: "Office replied the same morning.",
          },
          {
            id: "evt_tap_3",
            at: "2026-10-18T15:40:00.000Z",
            kind: "booked",
            label: "Tradesperson booked",
            detail: "M. Patel Plumbing, 22 Oct at 10:00.",
          },
        ],
      },
      {
        id: "rep_gas",
        reference: "R-2026-0142",
        propertyId: "p_harbour",
        roomId: "r_h2",
        title: "I can smell gas in the hallway outside room 2",
        body: "I can smell gas in the hallway outside room 2.",
        category: "heating",
        urgency: "emergency",
        emergency: "gas",
        status: "acknowledged",
        replyBy: "2026-10-21T09:05:00.000Z",
        fixBy: "2026-10-22T08:05:00.000Z",
        createdAt: "2026-10-21T08:05:00.000Z",
        channel: "whatsapp",
        photos: [],
        events: [
          {
            id: "evt_gas_1",
            at: "2026-10-21T08:05:00.000Z",
            kind: "reported",
            label: "Reported",
            detail: "WhatsApp from Owen Price",
          },
          {
            id: "evt_gas_2",
            at: "2026-10-21T08:06:00.000Z",
            kind: "emergency_routed",
            label: "Emergency route",
            detail: "Gas. Tenant shown 0800 111 999.",
          },
          {
            id: "evt_gas_3",
            at: "2026-10-21T08:22:00.000Z",
            kind: "acknowledged",
            label: "Acknowledged",
            detail: "Office called Owen and a gas engineer.",
          },
        ],
      },
      {
        id: "rep_boiler",
        reference: "R-2026-0128",
        propertyId: "p_leith",
        roomId: "r_leith",
        title: "Boiler pressure keeps dropping",
        body: "The boiler pressure keeps dropping and we have no heating in the morning.",
        category: "heating",
        urgency: "urgent",
        emergency: null,
        status: "fixed",
        replyBy: "2026-10-12T08:00:00.000Z",
        fixBy: "2026-10-16T08:00:00.000Z",
        createdAt: "2026-10-11T08:00:00.000Z",
        channel: "link",
        tradesperson: "Forth Heating",
        appointmentAt: "2026-10-14T09:30:00.000Z",
        photos: [{ id: "img_boiler", name: "boiler-gauge.jpg", at: "2026-10-14T11:00:00.000Z" }],
        events: [
          {
            id: "evt_b1",
            at: "2026-10-11T08:00:00.000Z",
            kind: "reported",
            label: "Reported",
            detail: "Link from Daniel Adeyemi",
          },
          {
            id: "evt_b2",
            at: "2026-10-11T10:12:00.000Z",
            kind: "acknowledged",
            label: "Acknowledged",
            detail: "Booked in the same day.",
          },
          {
            id: "evt_b3",
            at: "2026-10-11T10:20:00.000Z",
            kind: "booked",
            label: "Tradesperson booked",
            detail: "Forth Heating, 14 Oct at 09:30.",
          },
          {
            id: "evt_b4",
            at: "2026-10-14T11:05:00.000Z",
            kind: "fixed",
            label: "Fixed",
            detail: "Pressure vessel topped up. Photo on the file.",
          },
        ],
      },
    ],
    compliance: [
      {
        id: "c_oak_gas",
        propertyId: "p_oak",
        kind: "gas_safety",
        title: "Gas safety",
        dueAt: "2026-11-12",
        status: "due",
        detail: "Annual gas safety record for England. Give Priya a copy within 28 days of the check.",
      },
      {
        id: "c_oak_eicr",
        propertyId: "p_oak",
        kind: "eicr",
        title: "EICR",
        dueAt: "2028-04-01",
        status: "proof_held",
        detail: "Electrical installation condition report. England expects a let to hold one at least every five years.",
        proofName: "EICR-12-Oak-Road-2023.pdf",
        proofAt: "2023-04-02",
      },
      {
        id: "c_oak_epc",
        propertyId: "p_oak",
        kind: "epc",
        title: "EPC",
        dueAt: "2031-06-01",
        status: "proof_held",
        detail: "Energy performance certificate, valid for ten years, in place before the let was marketed.",
        proofName: "EPC-12-Oak-Road.pdf",
        proofAt: "2021-06-01",
      },
      {
        id: "c_oak_deposit",
        propertyId: "p_oak",
        kind: "deposit",
        title: "Deposit",
        dueAt: "2026-03-14",
        status: "proof_held",
        detail: "Protected with TDS within 30 days. Prescribed information served.",
        proofName: "TDS-Priya-Shah.pdf",
        proofAt: "2026-03-10",
      },
      {
        id: "c_oak_alarms",
        propertyId: "p_oak",
        kind: "alarms",
        title: "Smoke and CO alarms",
        dueAt: "2027-03-01",
        status: "ok",
        detail: "Smoke alarm on each storey and a carbon monoxide alarm in the room with the boiler.",
      },
      {
        id: "c_h_licence",
        propertyId: "p_harbour",
        kind: "hmo_licence",
        title: "HMO licence",
        dueAt: "2026-11-30",
        status: "due",
        detail: "Mandatory HMO licence for 8 Harbour Lane. Five rooms let on separate tenancies.",
      },
      {
        id: "c_h_gas",
        propertyId: "p_harbour",
        kind: "gas_safety",
        title: "Gas safety",
        dueAt: "2027-02-18",
        status: "proof_held",
        detail: "Annual gas safety record. Copy given to each room.",
        proofName: "CP12-Harbour-Lane-2026.pdf",
        proofAt: "2026-02-18",
      },
      {
        id: "c_h_inspect",
        propertyId: "p_harbour",
        kind: "inspection",
        title: "Mid-term inspection",
        dueAt: "2026-11-18",
        status: "due",
        detail: "Common parts and Room 1. Booked with Samira Ali.",
      },
      {
        id: "c_leith_gas",
        propertyId: "p_leith",
        kind: "gas_safety",
        title: "Gas safety",
        dueAt: "2026-11-04",
        status: "due",
        detail: "Annual gas safety record. In Scotland this also sits under the Repairing Standard.",
      },
      {
        id: "c_leith_eicr",
        propertyId: "p_leith",
        kind: "eicr",
        title: "EICR",
        dueAt: "2026-12-01",
        status: "due",
        detail: "Electrical inspection for the private residential tenancy.",
      },
      {
        id: "c_leith_deposit",
        propertyId: "p_leith",
        kind: "deposit",
        title: "Deposit",
        dueAt: "2025-08-20",
        status: "proof_held",
        detail: "Lodged with SafeDeposits Scotland.",
        proofName: "SDS-Daniel-Adeyemi.pdf",
        proofAt: "2025-08-12",
      },
      {
        id: "c_st_gas",
        propertyId: "p_station",
        kind: "gas_safety",
        title: "Gas safety",
        dueAt: "2027-01-09",
        status: "ok",
        detail: "Annual gas safety record for the occupation contract.",
      },
      {
        id: "c_st_epc",
        propertyId: "p_station",
        kind: "epc",
        title: "EPC",
        dueAt: "2026-11-20",
        status: "due",
        detail: "EPC expires this month. Renew before the next marketing of the let.",
      },
      {
        id: "c_st_deposit",
        propertyId: "p_station",
        kind: "deposit",
        title: "Deposit",
        dueAt: "2026-01-20",
        status: "proof_held",
        detail: "Protected and the occupation-contract information served.",
        proofName: "MyDeposits-Mei-Chen.pdf",
        proofAt: "2026-01-15",
      },
      {
        id: "c_quay_gas",
        propertyId: "p_quay",
        kind: "gas_safety",
        title: "Gas safety",
        dueAt: "2026-09-01",
        status: "overdue",
        detail: "The annual record is past its date. Book the engineer and give Lena the copy within 28 days.",
      },
    ],
    inspections: [
      {
        id: "ins_oak_in",
        propertyId: "p_oak",
        roomId: "r_oak2",
        kind: "check_in",
        at: "2026-03-01",
        notes: "Clean and as photographed. Meter readings on the inventory.",
        rooms: [
          { name: "Kitchen", condition: "Good. Tap washer noted as slightly stiff." },
          { name: "Bathroom", condition: "Good." },
          { name: "Bedroom", condition: "Good. Scuff on the door, agreed." },
        ],
        signedOffBy: "Priya Shah",
        signedOffAt: "2026-03-01T18:12:00.000Z",
      },
      {
        id: "ins_harbour_mid",
        propertyId: "p_harbour",
        kind: "mid_term",
        at: "2026-11-18",
        notes: "Common parts and Room 1. Fire doors and alarm test to be checked.",
        rooms: [
          { name: "Common parts", condition: "To be completed on the visit." },
          { name: "Room 1", condition: "To be completed on the visit." },
        ],
      },
    ],
    contractors: [
      {
        id: "con_patel",
        name: "M. Patel Plumbing",
        trade: "Plumbing",
        insuranceExpires: "2027-06-01",
        phone: "0117 496 0120",
      },
      {
        id: "con_quick",
        name: "QuickFix Electrics",
        trade: "Electrical",
        insuranceExpires: "2026-01-01",
        phone: "0117 496 0188",
      },
    ],
    keys: [
      {
        id: "key_oak",
        propertyId: "p_oak",
        label: "Front door, two keys",
        heldBy: "Office",
        updatedAt: "2026-10-02T09:00:00.000Z",
      },
      {
        id: "key_harbour",
        propertyId: "p_harbour",
        label: "HMO entrance and Room 2",
        heldBy: "M. Patel Plumbing",
        updatedAt: "2026-10-18T15:40:00.000Z",
      },
    ],
  };
}

export function insuranceExpired(contractor: { insuranceExpires: string }, at = new Date()) {
  const expiry = new Date(`${contractor.insuranceExpires}T23:59:59.000Z`);
  return expiry.getTime() < at.getTime();
}

export function withLettingsDefaults(book: LettingsBook): LettingsBook {
  const seed = seedBook();
  return {
    ...book,
    contractors: book.contractors?.length ? book.contractors : seed.contractors,
    keys: book.keys?.length ? book.keys : seed.keys,
    properties: book.properties.map((property) => {
      const seeded = seed.properties.find((item) => item.id === property.id);
      return {
        ...property,
        tenancyStage: property.tenancyStage ?? seeded?.tenancyStage ?? "active",
        rooms: property.rooms.map((item) => {
          const seededRoom = seeded?.rooms.find((room) => room.id === item.id);
          return { ...item, rightToRent: item.rightToRent ?? seededRoom?.rightToRent ?? "pending" };
        }),
      };
    }),
  };
}

export function setRightToRent(book: LettingsBook, propertyId: string, roomId: string, rightToRent: RightToRent): LettingsBook {
  return {
    ...book,
    properties: book.properties.map((property) =>
      property.id !== propertyId
        ? property
        : { ...property, rooms: property.rooms.map((room) => (room.id === roomId ? { ...room, rightToRent } : room)) },
    ),
  };
}

export function setTenancyStage(book: LettingsBook, propertyId: string, tenancyStage: TenancyStage): LettingsBook {
  return {
    ...book,
    properties: book.properties.map((property) => (property.id === propertyId ? { ...property, tenancyStage } : property)),
  };
}

export function addContractor(
  book: LettingsBook,
  input: { name: string; trade: string; insuranceExpires: string; phone?: string },
): LettingsBook {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Name the contractor.");
  if (!input.insuranceExpires) throw new Error("Add the insurance expiry.");
  return {
    ...book,
    contractors: [
      {
        id: newLettingsId("con"),
        name,
        trade: input.trade.trim() || "General",
        insuranceExpires: input.insuranceExpires,
        phone: input.phone?.trim() || undefined,
      },
      ...(book.contractors ?? []),
    ],
  };
}

export function addKey(book: LettingsBook, input: { propertyId: string; label: string; heldBy: string }): LettingsBook {
  if (!input.label.trim()) throw new Error("Describe the keys.");
  if (!input.heldBy.trim()) throw new Error("Say who holds them.");
  return {
    ...book,
    keys: [
      {
        id: newLettingsId("key"),
        propertyId: input.propertyId,
        label: input.label.trim(),
        heldBy: input.heldBy.trim(),
        updatedAt: new Date().toISOString(),
      },
      ...(book.keys ?? []),
    ],
  };
}

export function moveKey(book: LettingsBook, id: string, heldBy: string): LettingsBook {
  const holder = heldBy.trim();
  if (!holder) throw new Error("Say who holds the keys now.");
  return {
    ...book,
    keys: (book.keys ?? []).map((item) =>
      item.id === id ? { ...item, heldBy: holder, updatedAt: new Date().toISOString() } : item,
    ),
  };
}

export function seedPropertyByToken(token: string): Property | null {
  return seedBook().properties.find((property) => property.reportToken === token) ?? null;
}

export function emptyInbox(): LettingsInbox {
  return { repairs: [], confirmations: [], inspectionSigns: [] };
}

export interface RentSummary {
  received: number;
  late: number;
  due: number;
  booked: number;
  collectedPct: number;
}

export function rentSummary(book: LettingsBook): RentSummary {
  let received = 0;
  let late = 0;
  let due = 0;
  for (const property of book.properties) {
    for (const tenancy of property.rooms) {
      if (tenancy.rentStatus === "received") received += tenancy.rentPcm;
      else if (tenancy.rentStatus === "late") late += tenancy.rentPcm;
      else due += tenancy.rentPcm;
    }
  }
  const booked = received + late + due;
  return {
    received,
    late,
    due,
    booked,
    collectedPct: booked === 0 ? 0 : Math.round((received / booked) * 100),
  };
}

export function propertyById(book: LettingsBook, id: string) {
  return book.properties.find((property) => property.id === id) ?? null;
}

export function roomById(property: Property, roomId: string) {
  return property.rooms.find((tenancy) => tenancy.id === roomId) ?? null;
}

export function placeLabel(book: LettingsBook, propertyId: string, roomId: string) {
  const property = propertyById(book, propertyId);
  if (!property) return "Unknown let";
  const tenancy = roomById(property, roomId);
  return tenancy ? `${property.address}, ${tenancy.name}` : property.address;
}

export interface ReportInput {
  propertyId: string;
  roomId: string;
  body: string;
  channel: RepairChannel;
  photo?: { name: string; dataUrl?: string };
  now?: Date;
}

export function createRepair(book: LettingsBook, input: ReportInput): Repair {
  const property = propertyById(book, input.propertyId);
  const tenancy = property ? roomById(property, input.roomId) : null;
  if (!property || !tenancy) throw new Error("Choose a property and a room.");
  const body = input.body.trim();
  if (body.length < 8) throw new Error("Describe the problem in a sentence.");
  const now = input.now ?? new Date();
  const triage = triageReport(body, now);
  const createdAt = now.toISOString();
  const events: Repair["events"] = [
    {
      id: newLettingsId("evt"),
      at: createdAt,
      kind: "reported",
      label: "Reported",
      detail: `${CHANNEL_LABELS[input.channel]} from ${tenancy.tenantName}`,
    },
  ];
  if (triage.guidance) {
    events.push({
      id: newLettingsId("evt"),
      at: createdAt,
      kind: "emergency_routed",
      label: "Emergency route",
      detail: triage.guidance.title,
    });
  }
  const photos = input.photo
    ? [{ id: newLettingsId("img"), name: input.photo.name, dataUrl: input.photo.dataUrl, at: createdAt }]
    : [];
  if (input.photo) {
    events.push({
      id: newLettingsId("evt"),
      at: createdAt,
      kind: "photo",
      label: "Photo",
      detail: input.photo.name,
    });
  }
  return {
    id: newLettingsId("rep"),
    reference: nextReference(
      book.repairs.map((repair) => repair.reference),
      now,
    ),
    propertyId: property.id,
    roomId: tenancy.id,
    title: triage.title,
    body,
    category: triage.category,
    urgency: triage.urgency,
    emergency: triage.emergency,
    status: "reported",
    replyBy: triage.replyBy,
    fixBy: triage.fixBy,
    createdAt,
    channel: input.channel,
    events,
    photos,
  };
}

export function addRepair(book: LettingsBook, repair: Repair): LettingsBook {
  if (book.repairs.some((item) => item.id === repair.id || item.reference === repair.reference)) {
    return book;
  }
  return { ...book, repairs: [repair, ...book.repairs] };
}

function mapRepair(book: LettingsBook, id: string, update: (repair: Repair) => Repair): LettingsBook {
  let found = false;
  const repairs = book.repairs.map((repair) => {
    if (repair.id !== id) return repair;
    found = true;
    return update(repair);
  });
  if (!found) throw new Error("That repair is no longer on the desk.");
  return { ...book, repairs };
}

function pushEvent(repair: Repair, kind: Repair["events"][number]["kind"], label: string, detail: string, at: string): Repair {
  return {
    ...repair,
    events: [...repair.events, { id: newLettingsId("evt"), at, kind, label, detail }],
  };
}

export function acknowledgeRepair(book: LettingsBook, id: string, note: string, at = new Date().toISOString()) {
  return mapRepair(book, id, (repair) => {
    if (STAGE_INDEX[repair.status] >= STAGE_INDEX.acknowledged) return repair;
    return pushEvent(
      { ...repair, status: "acknowledged" },
      "acknowledged",
      "Acknowledged",
      note.trim() || "Office acknowledged the report.",
      at,
    );
  });
}

export function bookTradesperson(
  book: LettingsBook,
  id: string,
  input: { name: string; when: string; note?: string },
  at = new Date().toISOString(),
) {
  const name = input.name.trim();
  if (!name) throw new Error("Name the tradesperson.");
  if (!input.when) throw new Error("Choose a time.");
  const contractor = (book.contractors ?? []).find((item) => item.name.trim().toLowerCase() === name.toLowerCase());
  if (contractor && insuranceExpired(contractor, new Date(at))) {
    throw new Error(
      `${contractor.name} insurance expired ${formatDay(contractor.insuranceExpires)}. Update the register before booking this repair.`,
    );
  }
  return mapRepair(book, id, (repair) => {
    if (repair.status === "tenant_confirmed") {
      throw new Error("The tenant has already signed this off.");
    }
    let next = repair;
    if (STAGE_INDEX[next.status] < STAGE_INDEX.acknowledged) {
      next = pushEvent(next, "acknowledged", "Acknowledged", "Acknowledged when the visit was booked.", at);
    }
    next = pushEvent(
      {
        ...next,
        status: "booked",
        tradesperson: name,
        appointmentAt: new Date(input.when).toISOString(),
      },
      "booked",
      "Tradesperson booked",
      `${name}, ${formatWhen(new Date(input.when).toISOString())}.${input.note?.trim() ? ` ${input.note.trim()}` : ""}`,
      at,
    );
    return next;
  });
}

export function markFixed(
  book: LettingsBook,
  id: string,
  note: string,
  photo?: { name: string; dataUrl?: string },
  at = new Date().toISOString(),
) {
  return mapRepair(book, id, (repair) => {
    if (repair.status === "tenant_confirmed") {
      throw new Error("The tenant has already signed this off.");
    }
    if (repair.status === "fixed") return repair;
    let next = pushEvent(
      { ...repair, status: "fixed" },
      "fixed",
      "Fixed",
      note.trim() || "Marked fixed by the office.",
      at,
    );
    if (photo) {
      next = {
        ...next,
        photos: [...next.photos, { id: newLettingsId("img"), name: photo.name, dataUrl: photo.dataUrl, at }],
      };
      next = pushEvent(next, "photo", "Photo", photo.name, at);
    }
    return next;
  });
}

export function tryConfirmRepair(book: LettingsBook, reference: string, tenantName: string, at: string) {
  const key = reference.trim().toUpperCase();
  const repair = book.repairs.find((item) => item.reference.toUpperCase() === key);
  if (!repair || repair.status !== "fixed") return book;
  return mapRepair(book, repair.id, (current) =>
    pushEvent(
      { ...current, status: "tenant_confirmed" },
      "tenant_confirmed",
      "Tenant confirmed",
      `${tenantName.trim() || "Tenant"} confirmed the repair.`,
      at,
    ),
  );
}

export function setRentStatus(
  book: LettingsBook,
  propertyId: string,
  roomId: string,
  status: RentStatus,
  at = new Date().toISOString(),
) {
  let found = false;
  const properties = book.properties.map((property) => {
    if (property.id !== propertyId) return property;
    return {
      ...property,
      rooms: property.rooms.map((tenancy) => {
        if (tenancy.id !== roomId) return tenancy;
        found = true;
        return {
          ...tenancy,
          rentStatus: status,
          paidAt: status === "received" ? at.slice(0, 10) : tenancy.paidAt,
        };
      }),
    };
  });
  if (!found) throw new Error("That tenancy is not on the book.");
  return { ...book, properties };
}

export function attachProof(book: LettingsBook, itemId: string, proofName: string, at = new Date().toISOString()) {
  const name = proofName.trim();
  if (!name) throw new Error("Name the certificate or the scheme reference.");
  let found = false;
  const compliance = book.compliance.map((item) => {
    if (item.id !== itemId) return item;
    found = true;
    return { ...item, status: "proof_held" as const, proofName: name, proofAt: at.slice(0, 10) };
  });
  if (!found) throw new Error("That compliance item is not on the calendar.");
  return { ...book, compliance };
}

export function addCompliance(
  book: LettingsBook,
  input: { propertyId: string; kind: ComplianceKind; dueAt: string; detail?: string },
) {
  if (!propertyById(book, input.propertyId)) throw new Error("Choose a property.");
  if (!input.dueAt) throw new Error("Choose a due date.");
  const item: ComplianceItem = {
    id: newLettingsId("cmp"),
    propertyId: input.propertyId,
    kind: input.kind,
    title: COMPLIANCE_LABELS[input.kind],
    dueAt: input.dueAt,
    status: "due",
    detail: input.detail?.trim() || COMPLIANCE_LABELS[input.kind],
  };
  return { ...book, compliance: [...book.compliance, item] };
}

export function addInspection(
  book: LettingsBook,
  input: {
    propertyId: string;
    roomId?: string;
    kind: InspectionKind;
    at: string;
    notes: string;
    rooms: { name: string; condition: string }[];
  },
) {
  const property = propertyById(book, input.propertyId);
  if (!property) throw new Error("Choose a property.");
  if (!input.at) throw new Error("Choose a date.");
  const inspection: Inspection = {
    id: newLettingsId("ins"),
    propertyId: property.id,
    roomId: input.roomId || undefined,
    kind: input.kind,
    at: input.at,
    notes: input.notes.trim(),
    rooms: input.rooms.filter((roomNote) => roomNote.name.trim()),
  };
  return { ...book, inspections: [inspection, ...book.inspections] };
}

export function trySignInspection(book: LettingsBook, inspectionId: string, tenantName: string, at: string) {
  let changed = false;
  const inspections = book.inspections.map((inspection) => {
    if (inspection.id !== inspectionId || inspection.signedOffAt) return inspection;
    changed = true;
    return { ...inspection, signedOffBy: tenantName.trim() || "Tenant", signedOffAt: at };
  });
  if (!changed) return book;
  return { ...book, inspections };
}

export function addProperty(
  book: LettingsBook,
  input: {
    address: string;
    city: string;
    postcode: string;
    jurisdiction: Jurisdiction;
    hmo: boolean;
    roomName: string;
    tenantName: string;
    rentPcm: number;
    marketRentPcm: number;
  },
) {
  const address = input.address.trim();
  const tenantName = input.tenantName.trim();
  if (address.length < 4) throw new Error("Add the address.");
  if (tenantName.length < 2) throw new Error("Add the tenant's name.");
  if (!Number.isFinite(input.rentPcm) || input.rentPcm <= 0) throw new Error("Add the monthly rent.");
  const base =
    address
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "let";
  // The token is the only thing protecting a public repair link, so an address
  // alone (which anyone can guess) is not enough.
  const taken = new Set(book.properties.map((property) => property.reportToken));
  const randomPart = () => {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
  };
  let reportToken = `${base}-${randomPart()}`;
  while (taken.has(reportToken)) reportToken = `${base}-${randomPart()}`;
  const property: Property = {
    id: newLettingsId("p"),
    address,
    city: input.city.trim() || "—",
    postcode: input.postcode.trim().toUpperCase(),
    jurisdiction: input.jurisdiction,
    hmo: input.hmo,
    reportToken,
    rooms: [
      room(
        newLettingsId("r"),
        input.roomName.trim() || (input.hmo ? "Room 1" : "Whole let"),
        tenantName,
        input.rentPcm,
        input.marketRentPcm > 0 ? input.marketRentPcm : input.rentPcm,
        "due",
        "",
      ),
    ],
  };
  property.rooms[0].depositProtected = false;
  return { ...book, properties: [...book.properties, property] };
}

export function addRoom(
  book: LettingsBook,
  propertyId: string,
  input: { name: string; tenantName: string; rentPcm: number; marketRentPcm: number },
) {
  const name = input.name.trim();
  const tenantName = input.tenantName.trim();
  if (!name) throw new Error("Name the room.");
  if (tenantName.length < 2) throw new Error("Add the tenant's name.");
  if (!Number.isFinite(input.rentPcm) || input.rentPcm <= 0) throw new Error("Add the monthly rent.");
  let found = false;
  const properties = book.properties.map((property) => {
    if (property.id !== propertyId) return property;
    found = true;
    const tenancy = room(
      newLettingsId("r"),
      name,
      tenantName,
      input.rentPcm,
      input.marketRentPcm > 0 ? input.marketRentPcm : input.rentPcm,
      "due",
      property.rooms[0]?.depositScheme || "",
    );
    tenancy.depositProtected = false;
    return { ...property, hmo: true, rooms: [...property.rooms, tenancy] };
  });
  if (!found) throw new Error("That property is not on the book.");
  return { ...book, properties };
}

export function applyInbox(book: LettingsBook, inbox: LettingsInbox) {
  const rest = emptyInbox();
  let next = book;
  for (const repair of inbox.repairs) {
    if (!propertyById(next, repair.propertyId)) {
      rest.repairs.push(repair);
      continue;
    }
    const updated = addRepair(next, repair);
    if (updated === next) continue;
    next = updated;
  }
  for (const confirmation of inbox.confirmations) {
    const updated = tryConfirmRepair(next, confirmation.reference, confirmation.tenantName, confirmation.at);
    if (updated === next) {
      const repair = next.repairs.find(
        (item) => item.reference.toUpperCase() === confirmation.reference.trim().toUpperCase(),
      );
      if (repair && repair.status !== "tenant_confirmed") rest.confirmations.push(confirmation);
    } else {
      next = updated;
    }
  }
  for (const sign of inbox.inspectionSigns) {
    const updated = trySignInspection(next, sign.inspectionId, sign.tenantName, sign.at);
    if (updated === next) {
      const inspection = next.inspections.find((item) => item.id === sign.inspectionId);
      if (inspection && !inspection.signedOffAt) rest.inspectionSigns.push(sign);
    } else {
      next = updated;
    }
  }
  return { book: next, rest };
}

export function replyWasMet(repair: Repair) {
  const ack = repair.events.find((event) => event.kind === "acknowledged" || event.kind === "booked");
  if (!ack) return new Date(repair.replyBy).getTime() >= Date.now();
  return new Date(ack.at).getTime() <= new Date(repair.replyBy).getTime();
}

/** A certificate that has passed its date is overdue even if nobody updated the flag. */
export function complianceStatus(item: ComplianceItem, now = new Date()): ComplianceItem["status"] {
  if (item.status === "ok" || item.status === "due") {
    const due = new Date(`${item.dueAt.slice(0, 10)}T23:59:59`).getTime();
    if (Number.isFinite(due) && due < now.getTime()) return "overdue";
  }
  return item.status;
}

export function complianceReminders(book: LettingsBook, now = new Date()) {
  const horizon = now.getTime() + 45 * 86_400_000;
  return book.compliance
    .filter((item) => {
      const status = complianceStatus(item, now);
      if (status === "proof_held" || status === "ok") return false;
      const due = new Date(item.dueAt).getTime();
      return status === "overdue" || due <= horizon;
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function buildDisputePack(book: LettingsBook, propertyId: string, generatedAt = new Date()) {
  const property = propertyById(book, propertyId);
  if (!property) throw new Error("Choose a property.");
  const repairs = book.repairs.filter((repair) => repair.propertyId === property.id);
  const compliance = book.compliance.filter((item) => item.propertyId === property.id);
  const inspections = book.inspections.filter((item) => item.propertyId === property.id);
  const rent = property.rooms.reduce(
    (sum, tenancy) => {
      sum[tenancy.rentStatus] += tenancy.rentPcm;
      return sum;
    },
    { received: 0, late: 0, due: 0 } as Record<RentStatus, number>,
  );
  const tenancyRows = property.rooms
    .map((tenancy) => {
      const position = marketPosition(tenancy.rentPcm, tenancy.marketRentPcm);
      const gap =
        position.direction === "level"
          ? "in line with the market figure on file"
          : `${position.pct}% ${position.direction} the market figure on file`;
      return `<tr><td>${escapeHtml(tenancy.name)}</td><td>${escapeHtml(tenancy.tenantName)}</td><td>${gbp(tenancy.rentPcm)}</td><td>${gbp(tenancy.marketRentPcm)} · ${gap}</td><td>${escapeHtml(tenancy.rentStatus)}</td><td>${tenancy.depositProtected ? escapeHtml(tenancy.depositScheme || "Protected") : "Not marked protected"}</td></tr>`;
    })
    .join("");
  const repairBlocks = repairs
    .map((repair) => {
      const tenancy = roomById(property, repair.roomId);
      const timeline = repair.events
        .map(
          (event) =>
            `<li><strong>${escapeHtml(event.label)}</strong> · ${escapeHtml(formatWhen(event.at))}${event.detail ? ` — ${escapeHtml(event.detail)}` : ""}</li>`,
        )
        .join("");
      const photos = repair.photos.length
        ? `<p>Photos: ${repair.photos.map((photo) => escapeHtml(photo.name)).join(", ")}</p>`
        : "";
      return `<section><h3>${escapeHtml(repair.reference)} · ${escapeHtml(repair.title)}</h3><p>${escapeHtml(tenancy?.name || "")} · ${escapeHtml(tenancy?.tenantName || "")} · ${escapeHtml(TRADE_LABELS[repair.category])} · ${escapeHtml(URGENCY_LABELS[repair.urgency])} · via ${escapeHtml(CHANNEL_LABELS[repair.channel])}</p><p>${escapeHtml(repair.body)}</p><p>Reply by ${escapeHtml(formatWhen(repair.replyBy))}. Fix by ${escapeHtml(formatWhen(repair.fixBy))}. ${replyWasMet(repair) ? "Reply clock met." : "Reply clock missed."}</p>${photos}<ol>${timeline}</ol></section>`;
    })
    .join("");
  const complianceRows = compliance
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(formatDay(item.dueAt))}</td><td>${escapeHtml(complianceStatus(item).replace("_", " "))}</td><td>${escapeHtml(item.detail)}</td><td>${item.proofName ? escapeHtml(item.proofName) : "—"}</td></tr>`,
    )
    .join("");
  const inspectionBlocks = inspections
    .map((inspection) => {
      const rooms = inspection.rooms
        .map((note) => `<li>${escapeHtml(note.name)}: ${escapeHtml(note.condition)}</li>`)
        .join("");
      const sign = inspection.signedOffAt
        ? `Signed off by ${escapeHtml(inspection.signedOffBy || "tenant")} on ${escapeHtml(formatWhen(inspection.signedOffAt))}.`
        : "Not signed off by the tenant.";
      return `<section><h3>${escapeHtml(INSPECTION_LABELS[inspection.kind])} · ${escapeHtml(formatDay(inspection.at))}</h3><p>${escapeHtml(inspection.notes)}</p><ul>${rooms}</ul><p>${sign}</p></section>`;
    })
    .join("");

  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Dispute pack — ${escapeHtml(property.address)}</title><style>body{font-family:Georgia,serif;color:#1c1917;margin:2rem;line-height:1.45}h1,h2,h3{font-family:ui-sans-serif,system-ui,sans-serif}table{border-collapse:collapse;width:100%;margin:1rem 0}td,th{border:1px solid #d6d3d1;padding:0.4rem 0.5rem;text-align:left;vertical-align:top;font-size:0.92rem}th{background:#f5f5f4}.muted{color:#57534e;font-size:0.9rem}</style></head><body><h1>Dispute pack</h1><p class="muted">${escapeHtml(property.address)}, ${escapeHtml(property.city)} ${escapeHtml(property.postcode)} · ${escapeHtml(JURISDICTION_LABELS[property.jurisdiction])}${property.hmo ? " · HMO, room-level tenancies" : ""} · Generated ${escapeHtml(formatWhen(generatedAt.toISOString()))}</p><h2>Tenancies and rent</h2><p>Received ${gbp(rent.received)}. Late ${gbp(rent.late)}. Due ${gbp(rent.due)}.</p><table><thead><tr><th>Room</th><th>Tenant</th><th>Rent</th><th>Market check</th><th>Status</th><th>Deposit</th></tr></thead><tbody>${tenancyRows}</tbody></table><p>${escapeHtml(rentIncreaseNote(property.jurisdiction))}</p><p class="muted">Market rent is the figure held on file for similar local lets. It is not a live portal valuation.</p><h2>Repairs</h2>${repairBlocks || "<p>No repairs on file.</p>"}<h2>Compliance</h2><table><thead><tr><th>Item</th><th>Date</th><th>Status</th><th>Note</th><th>Proof</th></tr></thead><tbody>${complianceRows || "<tr><td colspan='5'>Nothing on the calendar.</td></tr>"}</tbody></table><h2>Inspections</h2>${inspectionBlocks || "<p>No inspection reports.</p>"}<p class="muted">This pack is the record held on the date above. It is not legal advice. Accounts and Making Tax Digital are not part of this desk.</p></body></html>`;
}

export function stageIndex(status: RepairStatus) {
  return STAGE_INDEX[status];
}

export { REPAIR_STAGES };
