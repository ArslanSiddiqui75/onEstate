import { z } from "zod";
import { cookies } from "next/headers";
import { requireAdminRole } from "@/lib/admin/request-admin";
import { adminJson } from "@/lib/admin/json";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  IMPERSONATION_COOKIE,
  impersonationCookieOptions,
  issueImpersonationToken,
  verifyImpersonationToken,
} from "@/lib/admin/impersonation";

const bodySchema = z.object({
  userId: z.string().min(1),
});

export async function GET() {
  const jar = await cookies();
  const session = verifyImpersonationToken(jar.get(IMPERSONATION_COOKIE)?.value);
  if (!session) {
    return adminJson({ active: false });
  }
  return adminJson({ active: true, session });
}

export async function POST(request: Request) {
  const check = await requireAdminRole("super_admin", "support_admin");
  if (!check.ok) {
    return adminJson({ error: check.error }, { status: check.status });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return adminJson({ error: "userId is required" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return adminJson(
      { error: "Hosted auth is not configured" },
      { status: 503 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, org_id, role, organizations(name)")
    .eq("id", parsed.data.userId)
    .maybeSingle();
  if (profileError || !profile) {
    return adminJson({ error: "Member not found" }, { status: 404 });
  }

  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(parsed.data.userId);
  const email = userData.user?.email;
  if (userError || !email) {
    return adminJson(
      { error: "This member has not accepted their invite yet" },
      { status: 409 },
    );
  }

  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    return adminJson(
      { error: linkError?.message || "Could not start impersonation" },
      { status: 502 },
    );
  }

  const orgJoin = profile.organizations as { name?: string } | { name?: string }[] | null;
  const orgName = Array.isArray(orgJoin) ? orgJoin[0]?.name : orgJoin?.name;

  const token = issueImpersonationToken({
    adminId: check.admin.id,
    adminEmail: check.admin.email,
    adminName: check.admin.name,
    targetUserId: String(profile.id),
    targetEmail: email,
    targetName: String(profile.full_name || email),
    orgId: String(profile.org_id),
    orgName: String(orgName || "Workspace"),
  });
  if (!token) {
    return adminJson({ error: "Session secret missing" }, { status: 500 });
  }

  await supabase.from("platform_audit_events").insert({
    actor_email: check.admin.email,
    action: "impersonation.started",
    entity_type: "member",
    entity_id: parsed.data.userId,
    summary: `Opened workspace as ${email}`,
    metadata: { orgId: profile.org_id, role: profile.role },
  });

  const response = adminJson({
    tokenHash,
    email,
    orgName: orgName || "Workspace",
    userName: profile.full_name || email,
  });
  response.cookies.set(IMPERSONATION_COOKIE, token, impersonationCookieOptions());
  return response;
}

export async function DELETE() {
  const check = await requireAdminRole("super_admin", "support_admin");
  if (!check.ok) {
    return adminJson({ error: check.error }, { status: check.status });
  }

  const jar = await cookies();
  const session = verifyImpersonationToken(jar.get(IMPERSONATION_COOKIE)?.value);
  const supabase = createServiceSupabaseClient();
  if (supabase && session) {
    await supabase.from("platform_audit_events").insert({
      actor_email: check.admin.email,
      action: "impersonation.ended",
      entity_type: "member",
      entity_id: session.targetUserId,
      summary: `Ended impersonation of ${session.targetEmail}`,
      metadata: { orgId: session.orgId },
    });
  }

  const response = adminJson({ ok: true });
  response.cookies.set(IMPERSONATION_COOKIE, "", {
    ...impersonationCookieOptions(),
    maxAge: 0,
  });
  return response;
}
