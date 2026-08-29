import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { requestEsign } from "@/lib/esign/service";
import { getEsignCapabilities } from "@/lib/esign/capabilities";

const bodySchema = z.object({
  dealId: z.string().min(1),
  documentName: z.string().min(1).max(200).optional(),
  signerName: z.string().min(1).max(120),
  signerEmail: z.string().email(),
  summary: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid e-sign request" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured — e-sign needs a hosted workspace" },
      { status: 503 },
    );
  }

  const result = await requestEsign(supabase, {
    orgId: profile.orgId,
    dealId: parsed.data.dealId,
    documentName: parsed.data.documentName || "Sale contract",
    signerName: parsed.data.signerName,
    signerEmail: parsed.data.signerEmail,
    summary: parsed.data.summary,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Failed" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    mode: result.mode || getEsignCapabilities().mode,
    document: result.document,
    signUrl: result.signUrl,
    emailed: result.emailed,
  });
}
