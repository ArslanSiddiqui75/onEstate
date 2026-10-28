import { NextResponse } from "next/server";
import { hydrateLeadRouting } from "@/lib/crm/routing";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { forbiddenIfNoModule } from "@/lib/server/require-module";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const denied = forbiddenIfNoModule(profile, "crm", "edit");
  if (denied) return denied;

  const json = await request.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "Invalid routing settings" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Lead routing can’t be saved yet." }, { status: 503 });
  }

  const settings = hydrateLeadRouting(json as Record<string, unknown>);
  const { error } = await supabase
    .from("organizations")
    .update({ lead_routing: settings })
    .eq("id", profile.orgId);
  if (error) {
    return NextResponse.json({ error: "Could not save lead routing." }, { status: 502 });
  }
  return NextResponse.json({ settings });
}
