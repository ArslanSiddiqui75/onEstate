import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const writeRoles = new Set(["owner", "broker", "team_lead"]);
const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  addMemberId: z.string().optional(),
  removeMemberId: z.string().optional(),
});

async function assertTeam(
  supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>,
  teamId: string,
  orgId: string,
) {
  const { data } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("org_id", orgId)
    .maybeSingle();
  return Boolean(data);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!writeRoles.has(profile.role)) {
    return NextResponse.json({ error: "Owner, Broker, or Team Lead required" }, { status: 403 });
  }
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });
  }
  if (!(await assertTeam(supabase, id, profile.orgId))) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (parsed.data.name) {
    const { error } = await supabase
      .from("teams")
      .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  }
  if (parsed.data.addMemberId) {
    const { data: member } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", parsed.data.addMemberId)
      .eq("org_id", profile.orgId)
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ error: "Member is not in this workspace" }, { status: 400 });
    }
    const { error } = await supabase
      .from("team_members")
      .upsert({ team_id: id, profile_id: parsed.data.addMemberId });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  }
  if (parsed.data.removeMemberId) {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", id)
      .eq("profile_id", parsed.data.removeMemberId);
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!writeRoles.has(profile.role)) {
    return NextResponse.json({ error: "Owner, Broker, or Team Lead required" }, { status: 403 });
  }
  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });
  }
  if (!(await assertTeam(supabase, id, profile.orgId))) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}
