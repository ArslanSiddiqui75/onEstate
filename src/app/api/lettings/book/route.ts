import { NextResponse } from "next/server";
import { z } from "zod";
import {
  lettingsHostedAvailable,
  loadHostedLettingsBook,
  saveHostedLettingsBook,
} from "@/lib/lettings/hosted";
import type { LettingsBook } from "@/lib/lettings/types";
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
});

export async function GET(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const denied = forbiddenIfNoModule(profile, "crm", "view");
  if (denied) return denied;
  if (!lettingsHostedAvailable()) {
    return NextResponse.json({ available: false, book: null });
  }
  try {
    const book = await loadHostedLettingsBook(profile.orgId);
    return NextResponse.json({ available: true, book });
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
  try {
    const book = await saveHostedLettingsBook(
      profile.orgId,
      parsed.data as unknown as LettingsBook,
    );
    return NextResponse.json({ book });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save lettings" },
      { status: 400 },
    );
  }
}
