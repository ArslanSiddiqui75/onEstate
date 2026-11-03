import { NextResponse } from "next/server";
import { z } from "zod";
import {
  agencyHostedAvailable,
  loadHostedAgencyBookSnap,
  saveHostedAgencyBook,
} from "@/lib/agency/hosted";
import type { AgencyBook } from "@/lib/agency/types";
import { isBookConflict } from "@/lib/books/conflict";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";

const TOKEN = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-zA-Z0-9._-]+$/, "Invalid token characters");

const appointmentSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["viewing", "valuation"]),
  status: z.enum(["requested", "confirmed", "done", "cancelled"]),
  at: z.string().min(1),
  clientName: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  address: z.string().min(1).max(240),
  listingId: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
  bookToken: TOKEN,
});

const offerSchema = z.object({
  id: z.string().min(1).max(80),
  listingId: z.string().max(80).optional(),
  address: z.string().min(1).max(240),
  buyerName: z.string().min(1).max(120),
  amount: z.number().finite().nonnegative(),
  currency: z.enum(["GBP", "USD"]),
  status: z.enum(["submitted", "accepted", "declined"]),
  at: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

const portalSchema = z.object({
  token: TOKEN,
  role: z.enum(["vendor", "buyer", "landlord", "tenant"]),
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(240),
  listingId: z.string().max(80).optional(),
  leadId: z.string().max(80).optional(),
  lettingsToken: z.string().max(80).optional(),
  approvedAt: z.string().optional(),
  feedback: z.string().max(2000).optional(),
});

const feeSchema = z.object({
  id: z.string().min(1).max(80),
  dealId: z.string().max(80).optional(),
  address: z.string().min(1).max(240),
  label: z.string().min(1).max(120),
  amount: z.number().finite().nonnegative(),
  currency: z.enum(["GBP", "USD"]),
  status: z.enum(["requested", "received"]),
  at: z.string().min(1),
});

const referralSchema = z.object({
  id: z.string().min(1).max(80),
  dealId: z.string().max(80).optional(),
  address: z.string().min(1).max(240),
  introducer: z.string().min(1).max(120),
  status: z.enum(["introduced", "agreed", "paid"]),
  fee: z.number().finite().nonnegative(),
  currency: z.enum(["GBP", "USD"]),
});

const bookSchema = z.object({
  version: z.literal(1),
  bookingToken: TOKEN,
  appointments: z.array(appointmentSchema).max(500),
  offers: z.array(offerSchema).max(500),
  portals: z.array(portalSchema).max(500),
  fees: z.array(feeSchema).max(500),
  referrals: z.array(referralSchema).max(500),
  expectedUpdatedAt: z.string().min(1).nullable().optional(),
});

export async function GET(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const denied = forbiddenIfNoModule(profile, "crm", "view");
  if (denied) return denied;
  if (!agencyHostedAvailable()) {
    return NextResponse.json({ available: false, book: null, updatedAt: null });
  }
  try {
    const snap = await loadHostedAgencyBookSnap(profile.orgId);
    return NextResponse.json({
      available: true,
      book: snap?.book ?? null,
      updatedAt: snap?.updatedAt ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load the diary" },
      { status: 502 },
    );
  }
}

export async function PUT(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const denied = forbiddenIfNoModule(profile, "crm", "edit");
  if (denied) return denied;
  if (!agencyHostedAvailable()) {
    return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });
  }
  const parsed = bookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid diary payload" }, { status: 400 });
  }
  const { expectedUpdatedAt, ...book } = parsed.data;
  try {
    const snap = await saveHostedAgencyBook(profile.orgId, book as AgencyBook, {
      expectedUpdatedAt: expectedUpdatedAt ?? undefined,
    });
    return NextResponse.json({ book: snap.book, updatedAt: snap.updatedAt });
  } catch (err) {
    if (isBookConflict(err)) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save the diary" },
      { status: 400 },
    );
  }
}
