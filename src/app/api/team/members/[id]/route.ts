import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageModuleAccess, readModuleGrants } from "@/lib/access";
import { resolveProfileFromRequest } from "@/lib/server/request-profile";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "@/types";

const ASSIGNABLE = ["broker", "team_lead", "agent", "assistant", "accountant"] as const;

const patchSchema = z
  .object({
    role: z.enum(ASSIGNABLE).optional(),
    moduleAccess: z.record(z.string(), z.boolean()).optional(),
  })
  .refine((value) => value.role !== undefined || value.moduleAccess !== undefined, {
    message: "Nothing to update",
  });

function inviteId(id: string) {
  return id.startsWith("invite_") ? id.slice("invite_".length) : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a role or a module" }, { status: 400 });
  if (parsed.data.role && profile.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can change roles" }, { status: 403 });
  }
  if (parsed.data.moduleAccess && !canManageModuleAccess(profile.role as Role)) {
    return NextResponse.json({ error: "Only the owner and brokers can change module access" }, { status: 403 });
  }
  if (id === profile.userId) {
    return NextResponse.json({ error: "You can't change your own access" }, { status: 400 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });

  const pendingId = inviteId(id);
  if (pendingId) {
    if (!parsed.data.role) {
      return NextResponse.json({ error: "Modules apply after this person joins" }, { status: 400 });
    }
    const { error } = await supabase
      .from("team_invites")
      .update({ role: parsed.data.role })
      .eq("id", pendingId)
      .eq("org_id", profile.orgId)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  const { data: member } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .eq("org_id", profile.orgId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "That person is not on the team" }, { status: 404 });
  if (member.role === "owner") {
    return NextResponse.json({ error: "The owner's access stays with the owner role" }, { status: 400 });
  }
  const patch: { role?: Role; module_access?: ReturnType<typeof readModuleGrants> } = {};
  if (parsed.data.role) patch.role = parsed.data.role;
  if (parsed.data.moduleAccess) patch.module_access = readModuleGrants(parsed.data.moduleAccess) || {};
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .eq("org_id", profile.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const profile = await resolveProfileFromRequest(request);
  if (!profile) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (profile.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can remove someone" }, { status: 403 });
  }
  const { id } = await context.params;
  if (id === profile.userId) {
    return NextResponse.json({ error: "You can't remove yourself" }, { status: 400 });
  }
  const supabase = createServiceSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Hosted mode required" }, { status: 503 });

  const pendingId = inviteId(id);
  if (pendingId) {
    const { error } = await supabase
      .from("team_invites")
      .delete()
      .eq("id", pendingId)
      .eq("org_id", profile.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  const { data: member } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .eq("org_id", profile.orgId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "That person is not on the team" }, { status: 404 });
  if (member.role === "owner") {
    return NextResponse.json({ error: "The owner stays on the team" }, { status: 400 });
  }
  const { error } = await supabase.from("profiles").delete().eq("id", id).eq("org_id", profile.orgId);
  if (error) {
    return NextResponse.json(
      { error: "This person is still on records. Change their role instead." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
