import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { voidEsignDocument } from "@/lib/esign/service";

const bodySchema = z.object({
  dealId: z.string().min(1),
  documentId: z.string().min(1),
});

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const result = await voidEsignDocument(supabase, {
    orgId: profile.orgId,
    dealId: parsed.data.dealId,
    documentId: parsed.data.documentId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Failed" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
