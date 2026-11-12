import { readModuleGrants } from "@/lib/access";
import type { ModuleGrants } from "@/types";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export interface RequestProfile {
  userId: string;
  email: string;
  orgId: string;
  role: string;
  plan: string;
  subscriptionStatus?: string;
  moduleAccess?: ModuleGrants;
}

type OrgJoin = { plan?: string; subscription_status?: string | null };
type ProfileRow = {
  id: string;
  org_id: string;
  role: string;
  module_access?: unknown;
  organizations?: OrgJoin | OrgJoin[] | null;
};

// Browser sessions live in the Supabase JS client's own storage, not an
// httpOnly cookie, so route handlers can't read "the current user" for free.
// The client sends its access token as a Bearer header (and, for social
// connect, again in the JSON body in case a proxy drops the header). We
// verify that token and resolve the caller's real org from `profiles`.
export async function resolveProfileFromRequest(
  request: Request,
  fallbackToken?: string | null,
): Promise<RequestProfile | null> {
  const token = bearerToken(request, fallbackToken);
  if (!token) return null;

  const service = createServiceSupabaseClient();
  const user = await userFromToken(token, service);
  if (!user) return null;

  const profile =
    (service ? await loadProfile(service, user.id) : null) ??
    (await loadProfile(userScopedClient(token), user.id));
  if (!profile) return null;

  const orgJoin = profile.organizations as OrgJoin | OrgJoin[] | null;
  const org = Array.isArray(orgJoin) ? orgJoin[0] : orgJoin;

  return {
    userId: user.id,
    email: user.email,
    orgId: String(profile.org_id),
    role: String(profile.role),
    plan: String(org?.plan || "solo"),
    subscriptionStatus: org?.subscription_status ? String(org.subscription_status) : undefined,
    moduleAccess: readModuleGrants(profile.module_access),
  };
}

function bearerToken(request: Request, fallback?: string | null): string {
  const header = request.headers.get("authorization") || "";
  const fromHeader = header.replace(/^Bearer\s+/i, "").trim();
  if (fromHeader) return fromHeader;
  return (fallback || "").trim();
}

async function userFromToken(
  token: string,
  service: SupabaseClient | null,
): Promise<{ id: string; email: string } | null> {
  if (service) {
    const { data, error } = await service.auth.getUser(token);
    if (!error && data.user?.id) {
      return { id: data.user.id, email: String(data.user.email || "") };
    }
  }

  // Same check the browser already passed: anon key + the user access token.
  // A service-role client that cannot validate the JWT must not look like
  // "signed out" when Auth itself accepts the session.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { id?: unknown; email?: unknown } | null;
  if (!body || typeof body.id !== "string") return null;
  return { id: body.id, email: typeof body.email === "string" ? body.email : "" };
}

function userScopedClient(token: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadProfile(
  supabase: SupabaseClient | null,
  userId: string,
): Promise<ProfileRow | null> {
  if (!supabase) return null;

  const full = await supabase
    .from("profiles")
    .select("id, org_id, role, module_access, organizations(plan, subscription_status)")
    .eq("id", userId)
    .maybeSingle();
  if (full.data) return full.data as ProfileRow;
  if (!full.error) return null;

  // A missing column or a broken embed used to collapse into "Sign in required"
  // even though the workspace had already loaded this same profile in the browser.
  const basic = await supabase
    .from("profiles")
    .select("id, org_id, role, module_access")
    .eq("id", userId)
    .maybeSingle();
  let row = (basic.data as ProfileRow | null) ?? null;
  if (basic.error) {
    const narrower = await supabase
      .from("profiles")
      .select("id, org_id, role")
      .eq("id", userId)
      .maybeSingle();
    row = (narrower.data as ProfileRow | null) ?? null;
  }
  if (!row) return null;

  const org = await supabase
    .from("organizations")
    .select("plan, subscription_status")
    .eq("id", row.org_id)
    .maybeSingle();
  return { ...row, organizations: (org.data as OrgJoin | null) ?? null };
}
