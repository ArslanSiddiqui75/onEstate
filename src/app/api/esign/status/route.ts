import { NextResponse } from "next/server";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { listEsignDocuments } from "@/lib/esign/service";
import { getEsignCapabilities } from "@/lib/esign/capabilities";

export async function GET(request: Request) {
  const caps = getEsignCapabilities();
  const url = new URL(request.url);
  const dealId = url.searchParams.get("dealId");

  if (!dealId) {
    return NextResponse.json({
      mode: caps.mode,
      provider: caps.provider,
      canEmailInvite: caps.canEmailInvite,
    });
  }

  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({
      mode: caps.mode,
      provider: caps.provider,
      canEmailInvite: caps.canEmailInvite,
      documents: [],
    });
  }

  const documents = await listEsignDocuments(supabase, {
    orgId: profile.orgId,
    dealId,
  });

  return NextResponse.json({
    mode: caps.mode,
    provider: caps.provider,
    canEmailInvite: caps.canEmailInvite,
    documents,
  });
}
