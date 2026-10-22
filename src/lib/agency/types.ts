export type AppointmentKind = "viewing" | "valuation";
export type AppointmentStatus = "requested" | "confirmed" | "done" | "cancelled";

export interface Appointment {
  id: string;
  kind: AppointmentKind;
  status: AppointmentStatus;
  at: string;
  clientName: string;
  email?: string;
  phone?: string;
  address: string;
  listingId?: string;
  notes?: string;
  bookToken: string;
}

export interface ClientOffer {
  id: string;
  listingId?: string;
  address: string;
  buyerName: string;
  amount: number;
  currency: "GBP" | "USD";
  status: "submitted" | "accepted" | "declined";
  at: string;
  notes?: string;
}

export type PortalRole = "vendor" | "buyer" | "landlord" | "tenant";

export interface PortalRecord {
  token: string;
  role: PortalRole;
  name: string;
  address: string;
  listingId?: string;
  leadId?: string;
  lettingsToken?: string;
  approvedAt?: string;
  feedback?: string;
}

export interface FeeRequest {
  id: string;
  dealId?: string;
  address: string;
  label: string;
  amount: number;
  currency: "GBP" | "USD";
  status: "requested" | "received";
  at: string;
}

export interface ReferralNote {
  id: string;
  dealId?: string;
  address: string;
  introducer: string;
  status: "introduced" | "agreed" | "paid";
  fee: number;
  currency: "GBP" | "USD";
}

export interface AgencyBook {
  version: 1;
  bookingToken: string;
  appointments: Appointment[];
  offers: ClientOffer[];
  portals: PortalRecord[];
  fees: FeeRequest[];
  referrals: ReferralNote[];
}

export interface AgencyInbox {
  appointments: Appointment[];
  offers: ClientOffer[];
  approvals: { token: string; at: string; feedback?: string }[];
  portals: PortalRecord[];
}

export const PROGRESSION = ["Listed", "Viewing", "Offer", "Progressing", "Exchanged"] as const;

export const PORTAL_ROLE_LABELS: Record<PortalRole, string> = {
  vendor: "Vendor",
  buyer: "Buyer",
  landlord: "Landlord",
  tenant: "Tenant",
};
