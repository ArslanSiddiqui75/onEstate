import { NextResponse } from "next/server";
import { z } from "zod";
import {
  lettingsHostedAvailable,
  loadHostedLettingsBookSnap,
  saveHostedLettingsBook,
} from "@/lib/lettings/hosted";
import type { LettingsBook } from "@/lib/lettings/types";
import { isBookConflict } from "@/lib/books/conflict";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";

const bookSchema = z.object({
  version: z.literal(1),
  properties: z.array(z.record(z.string(), z.unknown())),
  repairs: z.array(z.record(z.string(), z.unknown())),
  compliance: z.array(z.record(z.string(), z.unknown())),
  inspections: z.array(z.record(z.string(), z.unknown())),
  contractors: z.array(z.record(z.string(), z.unknown())),
  keys: z.array(z.record(z.string(), z.unknown())),
  expectedUpdatedAt: z.string().min(1).nullable().optional(),
});

export async function GET(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const denied = forbiddenIfNoModule(profile, "crm", "view");
  if (denied) return denied;
  if (!lettingsHostedAvailable()) {
    return NextResponse.json({ available: false, book: null, updatedAt: null });
  }
  try {
    const snap = await loadHostedLettingsBookSnap(profile.orgId);
    return NextResponse.json({
      available: true,
      book: snap?.book ?? null,
      updatedAt: snap?.updatedAt ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load lettings" },
      { status: 502 },
    );
  }
}

export async function PUT(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const denied = forbiddenIfNoModule(profile, "crm", "edit");
  if (denied) return denied;
  if (!lettingsHostedAvailable()) {
    return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });
  }
  const parsed = bookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lettings payload" }, { status: 400 });
  }
  const { expectedUpdatedAt, ...book } = parsed.data;
  try {
    const snap = await saveHostedLettingsBook(
      profile.orgId,
      book as unknown as LettingsBook,
      { expectedUpdatedAt: expectedUpdatedAt ?? undefined },
    );
    return NextResponse.json({ book: snap.book, updatedAt: snap.updatedAt });
  } catch (err) {
    if (isBookConflict(err)) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save lettings" },
      { status: 400 },
    );
  }
}
