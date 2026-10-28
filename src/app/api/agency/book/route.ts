import { NextResponse } from "next/server";
import { z } from "zod";
import {
  agencyHostedAvailable,
  loadHostedAgencyBook,
  saveHostedAgencyBook,
} from "@/lib/agency/hosted";
import type { AgencyBook } from "@/lib/agency/types";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";

const bookSchema = z.object({
  version: z.literal(1),
  bookingToken: z.string().min(3).max(80),
  appointments: z.array(z.record(z.string(), z.unknown())),
  offers: z.array(z.record(z.string(), z.unknown())),
  portals: z.array(z.record(z.string(), z.unknown())),
  fees: z.array(z.record(z.string(), z.unknown())),
  referrals: z.array(z.record(z.string(), z.unknown())),
});

export async function GET(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const denied = forbiddenIfNoModule(profile, "crm", "view");
  if (denied) return denied;
  if (!agencyHostedAvailable()) {
    return NextResponse.json({ available: false, book: null });
  }
  try {
    const book = await loadHostedAgencyBook(profile.orgId);
    return NextResponse.json({ available: true, book });
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
  try {
    const book = await saveHostedAgencyBook(profile.orgId, parsed.data as unknown as AgencyBook);
    return NextResponse.json({ book });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save the diary" },
      { status: 400 },
    );
  }
}
