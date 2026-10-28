import { createAppointment, createOffer, seedAgencyBook } from "@/lib/agency/book";
import type {
  AgencyBook,
  AgencyInbox,
  Appointment,
  AppointmentKind,
  ClientOffer,
  PortalRecord,
  PortalRole,
} from "@/lib/agency/types";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type ServiceClient = NonNullable<ReturnType<typeof createServiceSupabaseClient>>;

const ROLES: PortalRole[] = ["vendor", "buyer", "landlord", "tenant"];
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/;

function asBook(raw: unknown, bookingToken: string): AgencyBook {
  const base = seedAgencyBook();
  if (!raw || typeof raw !== "object") {
    return { ...base, bookingToken, appointments: [], offers: [], portals: [], fees: [], referrals: [] };
  }
  const value = raw as Partial<AgencyBook>;
  return {
    version: 1,
    bookingToken,
    appointments: Array.isArray(value.appointments) ? value.appointments : [],
    offers: Array.isArray(value.offers) ? value.offers : [],
    portals: Array.isArray(value.portals) ? value.portals : [],
    fees: Array.isArray(value.fees) ? value.fees : [],
    referrals: Array.isArray(value.referrals) ? value.referrals : [],
  };
}

function normalizeToken(token: string) {
  return token.trim().toLowerCase();
}

export function agencyHostedAvailable() {
  return Boolean(createServiceSupabaseClient());
}

async function syncLinkTokens(
  supabase: ServiceClient,
  orgId: string,
  book: AgencyBook,
) {
  await supabase.from("agency_link_tokens").delete().eq("org_id", orgId);
  const seen = new Set<string>();
  const rows: { token: string; org_id: string; kind: "booking" | "portal" }[] = [];
  const push = (token: string, kind: "booking" | "portal") => {
    const key = normalizeToken(token).toLowerCase();
    if (!TOKEN_RE.test(normalizeToken(token)) || seen.has(key)) return;
    seen.add(key);
    rows.push({ token: normalizeToken(token), org_id: orgId, kind });
  };
  push(book.bookingToken, "booking");
  for (const appointment of book.appointments) push(appointment.bookToken, "booking");
  for (const portal of book.portals) push(portal.token, "portal");
  if (rows.length) {
    const { error } = await supabase.from("agency_link_tokens").upsert(rows, {
      onConflict: "token",
    });
    if (error) throw error;
  }
}

export async function loadHostedAgencyBook(orgId: string): Promise<AgencyBook | null> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("agency_books")
    .select("booking_token, data")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const bookingToken = `book-${orgId.replace(/-/g, "").slice(0, 12)}`;
    const empty = asBook(null, bookingToken);
    await saveHostedAgencyBook(orgId, empty);
    return empty;
  }
  return asBook(data.data, String(data.booking_token));
}

export async function saveHostedAgencyBook(orgId: string, book: AgencyBook): Promise<AgencyBook> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) throw new Error("Hosted mode required");
  const bookingToken = normalizeToken(book.bookingToken || `book-${orgId.slice(0, 8)}`);
  if (!TOKEN_RE.test(bookingToken)) {
    throw new Error("Choose a booking link made of letters, numbers, dots, dashes or underscores.");
  }
  const next: AgencyBook = {
    version: 1,
    bookingToken,
    appointments: book.appointments || [],
    offers: book.offers || [],
    portals: book.portals || [],
    fees: book.fees || [],
    referrals: book.referrals || [],
  };
  const { error } = await supabase.from("agency_books").upsert(
    {
      org_id: orgId,
      booking_token: bookingToken,
      data: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );
  if (error) {
    if (error.code === "23505") {
      throw new Error("That booking link is already in use by another office.");
    }
    throw error;
  }
  await syncLinkTokens(supabase, orgId, next);
  return next;
}

async function orgIdForLinkToken(
  supabase: ServiceClient,
  token: string,
  kind?: "booking" | "portal",
): Promise<string | null> {
  const key = normalizeToken(token);
  let query = supabase.from("agency_link_tokens").select("org_id, kind").eq("token", key);
  if (kind) query = query.eq("kind", kind);
  const { data } = await query.maybeSingle();
  return data?.org_id ? String(data.org_id) : null;
}

export async function hostedRecognisesBookingToken(token: string): Promise<boolean> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return false;
  return Boolean(await orgIdForLinkToken(supabase, token, "booking"));
}

export async function hostedPortal(token: string): Promise<(PortalRecord & { orgId: string }) | null> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;
  const orgId = await orgIdForLinkToken(supabase, token, "portal");
  if (!orgId) return null;
  const book = await loadHostedAgencyBook(orgId);
  const portal = book?.portals.find((item) => item.token === normalizeToken(token));
  return portal ? { ...portal, orgId } : null;
}

export async function hostedInboxForOrg(orgId: string): Promise<AgencyInbox> {
  const book = await loadHostedAgencyBook(orgId);
  if (!book) {
    return { appointments: [], offers: [], approvals: [], portals: [] };
  }
  return {
    appointments: book.appointments,
    offers: book.offers,
    approvals: book.portals
      .filter((portal) => portal.approvedAt)
      .map((portal) => ({
        token: portal.token,
        at: portal.approvedAt!,
        feedback: portal.feedback,
      })),
    portals: book.portals,
  };
}

export async function hostedRegisterPortal(input: {
  orgId: string;
  token: string;
  role: string;
  name: string;
  address: string;
  listingId?: string;
  leadId?: string;
  lettingsToken?: string;
}): Promise<PortalRecord> {
  if (!ROLES.includes(input.role as PortalRole)) throw new Error("Choose a client role.");
  const name = input.name.trim();
  const address = input.address.trim();
  const token = normalizeToken(input.token);
  if (name.length < 2 || !address || !TOKEN_RE.test(token)) {
    throw new Error("Add a name, address and link token.");
  }
  const book = (await loadHostedAgencyBook(input.orgId))!;
  const portal: PortalRecord = {
    token,
    role: input.role as PortalRole,
    name,
    address,
    listingId: input.listingId?.trim() || undefined,
    leadId: input.leadId?.trim() || undefined,
    lettingsToken: input.lettingsToken?.trim() || undefined,
  };
  const next = {
    ...book,
    portals: [portal, ...book.portals.filter((item) => item.token !== token)],
  };
  await saveHostedAgencyBook(input.orgId, next);
  return portal;
}

export async function hostedBooking(input: {
  bookToken: string;
  kind: AppointmentKind;
  at: string;
  clientName: string;
  email?: string;
  phone?: string;
  address: string;
  notes?: string;
}): Promise<Appointment> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) throw new Error("Hosted mode required");
  const orgId = await orgIdForLinkToken(supabase, input.bookToken, "booking");
  if (!orgId) throw new Error("This booking link is not recognised.");
  const book = (await loadHostedAgencyBook(orgId))!;
  const appointment = createAppointment({ ...input, bookToken: normalizeToken(input.bookToken) });
  await saveHostedAgencyBook(orgId, {
    ...book,
    appointments: [appointment, ...book.appointments],
  });
  return appointment;
}

export async function hostedOffer(input: {
  token: string;
  buyerName: string;
  amount: number;
  notes?: string;
}): Promise<ClientOffer> {
  const portal = await hostedPortal(input.token);
  if (!portal) throw new Error("This client link is not recognised.");
  const book = (await loadHostedAgencyBook(portal.orgId))!;
  const offer = createOffer({
    address: portal.address,
    buyerName: input.buyerName,
    amount: input.amount,
    notes: input.notes,
  });
  await saveHostedAgencyBook(portal.orgId, {
    ...book,
    offers: [offer, ...book.offers],
  });
  return offer;
}

export async function hostedApproval(token: string, feedback?: string) {
  const portal = await hostedPortal(token);
  if (!portal) throw new Error("This client link is not recognised.");
  const book = (await loadHostedAgencyBook(portal.orgId))!;
  const at = new Date().toISOString();
  await saveHostedAgencyBook(portal.orgId, {
    ...book,
    portals: book.portals.map((item) =>
      item.token === portal.token
        ? { ...item, approvedAt: at, feedback: feedback?.trim() || item.feedback }
        : item,
    ),
  });
}

export async function hostedAppointment(token: string, id: string): Promise<Appointment | null> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) return null;
  const orgId = await orgIdForLinkToken(supabase, token, "booking");
  if (!orgId) return null;
  const book = await loadHostedAgencyBook(orgId);
  return book?.appointments.find((item) => item.id === id) ?? null;
}
