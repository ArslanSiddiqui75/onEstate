export type Jurisdiction = "england" | "wales" | "scotland";

export type Trade =
  | "plumbing"
  | "heating"
  | "electrical"
  | "appliances"
  | "damp"
  | "locks"
  | "pests"
  | "other";

export type Urgency = "emergency" | "urgent" | "routine";

export type EmergencyKind = "gas" | "co" | "fire" | "flood" | "electrical";

export type RepairChannel = "link" | "qr" | "text" | "whatsapp";

export type RepairStatus =
  | "reported"
  | "acknowledged"
  | "booked"
  | "fixed"
  | "tenant_confirmed";

export type RepairEventKind =
  | "reported"
  | "acknowledged"
  | "booked"
  | "fixed"
  | "tenant_confirmed"
  | "photo"
  | "note"
  | "emergency_routed";

export type RentStatus = "received" | "late" | "due";

export type ComplianceKind =
  | "gas_safety"
  | "eicr"
  | "epc"
  | "deposit"
  | "hmo_licence"
  | "inspection"
  | "alarms";

export type ComplianceStatus = "ok" | "due" | "overdue" | "proof_held";

export type InspectionKind = "check_in" | "mid_term" | "check_out";

export type RightToRent = "clear" | "pending" | "expired";

export type TenancyStage = "marketing" | "let_agreed" | "move_in" | "active" | "move_out";

export interface TenancyRoom {
  id: string;
  name: string;
  tenantName: string;
  rentPcm: number;
  marketRentPcm: number;
  rentStatus: RentStatus;
  depositProtected: boolean;
  depositScheme?: string;
  paidAt?: string;
  rightToRent?: RightToRent;
}

export interface Property {
  id: string;
  address: string;
  city: string;
  postcode: string;
  jurisdiction: Jurisdiction;
  hmo: boolean;
  reportToken: string;
  tenancyStage?: TenancyStage;
  rooms: TenancyRoom[];
}

export interface Contractor {
  id: string;
  name: string;
  trade: string;
  insuranceExpires: string;
  phone?: string;
}

export interface KeyLog {
  id: string;
  propertyId: string;
  label: string;
  heldBy: string;
  updatedAt: string;
}

export interface RepairEvent {
  id: string;
  at: string;
  kind: RepairEventKind;
  label: string;
  detail?: string;
}

export interface RepairPhoto {
  id: string;
  name: string;
  dataUrl?: string;
  at: string;
}

export interface Repair {
  id: string;
  reference: string;
  propertyId: string;
  roomId: string;
  title: string;
  body: string;
  category: Trade;
  urgency: Urgency;
  emergency: EmergencyKind | null;
  status: RepairStatus;
  replyBy: string;
  fixBy: string;
  createdAt: string;
  channel: RepairChannel;
  events: RepairEvent[];
  photos: RepairPhoto[];
  tradesperson?: string;
  appointmentAt?: string;
}

export interface ComplianceItem {
  id: string;
  propertyId: string;
  kind: ComplianceKind;
  title: string;
  dueAt: string;
  status: ComplianceStatus;
  detail: string;
  proofName?: string;
  proofAt?: string;
}

export interface InspectionRoom {
  name: string;
  condition: string;
}

export interface Inspection {
  id: string;
  propertyId: string;
  roomId?: string;
  kind: InspectionKind;
  at: string;
  notes: string;
  rooms: InspectionRoom[];
  signedOffBy?: string;
  signedOffAt?: string;
}

export interface LettingsBook {
  version: 1;
  properties: Property[];
  repairs: Repair[];
  compliance: ComplianceItem[];
  inspections: Inspection[];
  contractors: Contractor[];
  keys: KeyLog[];
}

export interface LettingsInbox {
  repairs: Repair[];
  confirmations: { reference: string; at: string; tenantName: string }[];
  inspectionSigns: { inspectionId: string; at: string; tenantName: string }[];
}

export const REPAIR_STAGES: { id: RepairStatus; label: string }[] = [
  { id: "reported", label: "Reported" },
  { id: "acknowledged", label: "Acknowledged" },
  { id: "booked", label: "Tradesperson booked" },
  { id: "fixed", label: "Fixed" },
  { id: "tenant_confirmed", label: "Tenant confirmed" },
];

export const TRADE_LABELS: Record<Trade, string> = {
  plumbing: "Plumbing",
  heating: "Heating",
  electrical: "Electrical",
  appliances: "Appliances",
  damp: "Damp",
  locks: "Locks",
  pests: "Pests",
  other: "Other",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  emergency: "Emergency",
  urgent: "Urgent",
  routine: "Routine",
};

export const CHANNEL_LABELS: Record<RepairChannel, string> = {
  link: "Link",
  qr: "QR code",
  text: "Text",
  whatsapp: "WhatsApp",
};

export const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  england: "England",
  wales: "Wales",
  scotland: "Scotland",
};

export const COMPLIANCE_LABELS: Record<ComplianceKind, string> = {
  gas_safety: "Gas safety",
  eicr: "EICR",
  epc: "EPC",
  deposit: "Deposit",
  hmo_licence: "HMO licence",
  inspection: "Inspection",
  alarms: "Smoke and CO alarms",
};

export const INSPECTION_LABELS: Record<InspectionKind, string> = {
  check_in: "Check-in",
  mid_term: "Mid-term",
  check_out: "Check-out",
};
