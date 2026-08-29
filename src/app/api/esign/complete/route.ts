import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  completeEsignByToken,
  getEsignByToken,
} from "@/lib/esign/service";

const bodySchema = z.object({
  token: z.string().min(16),
});

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (token.length < 16) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const doc = await getEsignByToken(supabase, token);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    name: doc.name,
    status: doc.status,
    signerName: doc.signerName,
    listingTitle: doc.listingTitle,
    summary: doc.summary,
    signedAt: doc.signedAt,
  });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const result = await completeEsignByToken(supabase, parsed.data.token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Failed" }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    status: result.document?.status,
    signedAt: result.document?.signedAt,
  });
}
