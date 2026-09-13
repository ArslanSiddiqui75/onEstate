import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const writeRoles = new Set(["owner", "broker", "team_lead"]);

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function GET(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ teams: [] });
  }

  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name, created_at")
    .eq("org_id", profile.orgId)
    .order("name");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  const ids = (teams || []).map((t) => t.id);
  const { data: members } = ids.length
    ? await supabase
        .from("team_members")
        .select("team_id, profile_id")
        .in("team_id", ids)
    : { data: [] };

  return NextResponse.json({
    canManage: writeRoles.has(profile.role),
    teams: (teams || []).map((team) => ({
      id: team.id,
      name: team.name,
      createdAt: team.created_at,
      memberIds: (members || [])
        .filter((m) => m.team_id === team.id)
        .map((m) => String(m.profile_id)),
    })),
  });
}

export async function POST(request: Request) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!writeRoles.has(profile.role)) {
    return NextResponse.json({ error: "Owner, Broker, or Team Lead required" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a team name" }, { status: 400 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });
  }
  const { data, error } = await supabase
    .from("teams")
    .insert({ org_id: profile.orgId, name: parsed.data.name })
    .select("id, name")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json({ team: data });
}
